import { useMemo, useState } from "react";

// PanelCutoffs — carga rápida de cut-offs pegado al calendario (acordado 10/06/2026):
//  - Defaults por tipo sobre un "mes objetivo": Mensual día 18, Q1 día 16,
//    Q2 día 1 del MES SIGUIENTE (regla del usuario). Editables; solo llenan vacías.
//  - Semáforo por fila: verde = confirmado (dato real), amarillo = default sin
//    confirmar (tentativo), gris = sin fecha. Editar una fecha la confirma;
//    el ✓ confirma sin cambiarla.
//  - "Pegar desde Excel": filas Cliente | Liquidación | Fecha (tab/;/,) con fechas
//    DD/MM/YYYY o YYYY-MM-DD. Lo importado entra como confirmado.
//  - "Copiar plantilla": copia la grilla exacta (tab-separated) para completar en Excel.

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes 1-12

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function fechaDefault(mesObjetivo, dia, mesSiguiente) {
  let [anio, mes] = mesObjetivo.split("-").map(Number);
  if (mesSiguiente) { mes += 1; if (mes > 12) { mes = 1; anio += 1; } }
  const d = Math.min(Math.max(1, Math.round(dia || 1)), ultimoDia(anio, mes));
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// mensual / q1 / q2 — por sufijo del id determinístico, con fallback por etiqueta.
function claseLiq(liq) {
  const id = String(liq.id);
  if (id.endsWith(":q1")) return "q1";
  if (id.endsWith(":q2")) return "q2";
  if (id.endsWith(":mensual")) return "mensual";
  const e = norm(liq.etiqueta);
  if (/quincena\s*1|1q|primera quincena/.test(e)) return "q1";
  if (/quincena\s*2|2q|segunda quincena/.test(e)) return "q2";
  if (/mensual/.test(e)) return "mensual";
  return null; // liquidación extra sin clasificar → no se autollena con el default
}

/** "18/06/2026" o "2026-06-18" → ISO, o null si inválida. */
function parseFecha(txt) {
  const t = (txt || "").trim();
  let anio, mes, dia;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) [anio, mes, dia] = [+m[1], +m[2], +m[3]];
  else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (m) [dia, mes, anio] = [+m[1], +m[2], +m[3]];
    else return null;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDia(anio, mes)) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Parsea texto pegado (Excel/CSV) contra las filas vigentes del panel.
 * Acepta: Cliente|Liquidación|Fecha, o Cliente|Fecha si el cliente tiene UNA sola liq.
 * Filas de la plantilla sin fecha se saltean en silencio (permite round-trip).
 */
function parsePegado(texto, filas) {
  // norm(nombre) → { nombre, porLabel: Map(norm(etiqueta) → [liqId...]), total }
  // porLabel es lista de ids: un cliente puede tener 2 liqs con la misma etiqueta
  // (ej. dos "Mensual"); las consumimos en orden de aparición para no pisar datos.
  const porCliente = new Map();
  for (const f of filas) {
    const k = norm(f.cliente.nombre);
    if (!porCliente.has(k)) porCliente.set(k, { nombre: f.cliente.nombre, porLabel: new Map(), total: 0 });
    const e = porCliente.get(k);
    const lbl = norm(f.liq.etiqueta);
    if (!e.porLabel.has(lbl)) e.porLabel.set(lbl, []);
    e.porLabel.get(lbl).push(f.liq.id);
    e.total++;
  }
  const buscarCliente = (nombreNorm) => {
    if (porCliente.has(nombreNorm)) return porCliente.get(nombreNorm);
    const candidatos = [...porCliente.entries()].filter(([k]) => k.includes(nombreNorm));
    if (candidatos.length === 1) return candidatos[0][1];
    return candidatos.length > 1 ? "ambiguo" : null;
  };
  // resuelve {key, ids} de una etiqueta (match exacto o ignorando espacios). No consume.
  const matchLabel = (cli, etiquetaNorm) => {
    if (cli.porLabel.has(etiquetaNorm)) return { key: etiquetaNorm, ids: cli.porLabel.get(etiquetaNorm) };
    const sin = etiquetaNorm.replace(/\s/g, "");
    for (const [k, v] of cli.porLabel.entries()) if (k.replace(/\s/g, "") === sin) return { key: k, ids: v };
    return null;
  };

  const aplicar = {};
  const errores = [];
  const usados = new Map(); // `${nombreNorm}|${labelKey}` → ids ya consumidos (etiquetas duplicadas)
  let ok = 0;
  const tomarId = (nombreNorm, match) => {
    const mapKey = `${nombreNorm}|${match.key}`;
    const idx = usados.get(mapKey) || 0;
    usados.set(mapKey, idx + 1);
    return match.ids[Math.min(idx, match.ids.length - 1)];
  };

  texto.split(/\r?\n/).forEach((linea, i) => {
    const raw = linea.trim();
    if (!raw) return;
    const sep = raw.includes("\t") ? "\t" : raw.includes(";") ? ";" : ",";
    const celdas = raw.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    if (norm(celdas[0]) === "cliente") return; // header de la plantilla
    if (celdas.length < 2) { errores.push(`Línea ${i + 1}: esperaba Cliente | Liquidación | Fecha`); return; }
    const nombreNorm = norm(celdas[0]);
    const cli = buscarCliente(nombreNorm);
    if (!cli) { errores.push(`Línea ${i + 1}: cliente "${celdas[0]}" no encontrado en el alcance`); return; }
    if (cli === "ambiguo") { errores.push(`Línea ${i + 1}: "${celdas[0]}" matchea más de un cliente — usá el nombre completo`); return; }

    let liqId, fechaTxt;
    if (celdas.length === 2) {
      // Cliente | Fecha — válido solo si el cliente tiene una única liquidación.
      // Si la 2ª celda es una etiqueta de liq (fila de plantilla sin fecha), saltear.
      if (parseFecha(celdas[1])) {
        if (cli.total !== 1) { errores.push(`Línea ${i + 1}: ${cli.nombre} tiene ${cli.total} liquidaciones — indicá cuál (Cliente | Liquidación | Fecha)`); return; }
        liqId = [...cli.porLabel.values()][0][0];
        fechaTxt = celdas[1];
      } else if (matchLabel(cli, norm(celdas[1]))) {
        return; // plantilla sin fecha → pendiente, no es error
      } else {
        errores.push(`Línea ${i + 1}: "${celdas[1]}" no es ni fecha ni liquidación de ${cli.nombre}`);
        return;
      }
    } else {
      const match = matchLabel(cli, norm(celdas[1]));
      if (!match) { errores.push(`Línea ${i + 1}: ${cli.nombre} no tiene liquidación "${celdas[1]}" (tiene: ${[...cli.porLabel.keys()].join(", ")})`); return; }
      fechaTxt = celdas[2];
      if (!fechaTxt) return; // plantilla con fecha vacía → pendiente, no es error
      liqId = tomarId(nombreNorm, match);
    }
    const iso = parseFecha(fechaTxt);
    if (!iso) { errores.push(`Línea ${i + 1}: fecha "${fechaTxt}" inválida (usá DD/MM/YYYY o YYYY-MM-DD)`); return; }
    aplicar[liqId] = iso;
    ok++;
  });
  return { aplicar, ok, errores };
}

function ChipEstado({ tipo, C }) {
  const cfg = {
    confirmado: { rgb: "34,197,94", color: C.ok, label: "Confirmado" },
    default: { rgb: "245,158,11", color: "#B07408", label: "Default" },
    vacia: { rgb: "140,131,123", color: C.gris, label: "Sin fecha" },
  }[tipo];
  return (
    <span style={{ background: `rgba(${cfg.rgb},0.12)`, border: `1px solid rgba(${cfg.rgb},0.32)`, color: cfg.color, borderRadius: 9999, padding: "2px 10px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

export default function PanelCutoffs({
  clientes,
  configClientes,
  cutoffs,
  cutoffsEstado,
  setCutoff,
  confirmarCutoff,
  aplicarLote,
  abrirCliente,
  C,
  font,
}) {
  const [expanded, setExpanded] = useState(true);
  const [mesObjetivo, setMesObjetivo] = useState(mesActual);
  const [dias, setDias] = useState({ mensual: 18, q1: 16, q2: 1 }); // q2 = día del MES SIGUIENTE
  const [verPegado, setVerPegado] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const filas = useMemo(() => {
    const out = [];
    for (const c of clientes) {
      const liqs = configClientes[c.id]?.liquidaciones || [];
      liqs.forEach((liq, idx) => out.push({ cliente: c, liq, primera: idx === 0, span: liqs.length }));
    }
    return out;
  }, [clientes, configClientes]);

  const estadoDe = (liqId) => (!cutoffs[liqId] ? "vacia" : cutoffsEstado[liqId] === "default" ? "default" : "confirmado");

  const stats = useMemo(() => {
    const s = { confirmado: 0, default: 0, vacia: 0 };
    for (const f of filas) s[estadoDe(f.liq.id)]++;
    return s;
  }, [filas, cutoffs, cutoffsEstado]);

  // Vacías que el default SÍ puede llenar (Mensual/Q1/Q2). Los extras sin clasificar
  // (claseLiq null) no se autollenan: el usuario los carga a mano. Manda el conteo del botón.
  const vaciasAutollenables = useMemo(
    () => filas.filter((f) => !cutoffs[f.liq.id] && claseLiq(f.liq)).length,
    [filas, cutoffs]
  );

  // Clientes del alcance sin ninguna liquidación definida (tipo "ninguno"): no generan
  // ciclo y por eso no tienen fila acá, pero los listamos para que no se olviden.
  const sinLiq = useMemo(
    () => clientes.filter((c) => !(configClientes[c.id]?.liquidaciones || []).length),
    [clientes, configClientes]
  );

  const aplicarDefaults = () => {
    const entradas = {};
    for (const f of filas) {
      if (cutoffs[f.liq.id]) continue;
      const cl = claseLiq(f.liq);
      if (!cl) continue; // extra sin clasificar: no autollenar
      entradas[f.liq.id] = fechaDefault(mesObjetivo, dias[cl], cl === "q2");
    }
    aplicarLote(entradas, "default");
  };

  const copiarPlantilla = async () => {
    const fmtAR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
    const txt = ["Cliente\tLiquidación\tCut-off", ...filas.map((f) => `${f.cliente.nombre}\t${f.liq.etiqueta}\t${fmtAR(cutoffs[f.liq.id])}`)].join("\n");
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; }
    catch {
      // Fallback para entornos sin Clipboard API (http, iframe sandbox): textarea + execCommand.
      try {
        const ta = document.createElement("textarea");
        ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
  };

  const importar = () => {
    const r = parsePegado(textoPegado, filas);
    aplicarLote(r.aplicar, "confirmado");
    setResultado(r);
    if (r.ok > 0 && r.errores.length === 0) setTextoPegado("");
  };

  const btn = (extra = {}) => ({ ...font, cursor: "pointer", fontSize: 11.5, fontWeight: 600, borderRadius: 9999, padding: "6px 14px", border: `1px solid ${C.borde}`, background: "#FFF", color: C.navy, ...extra });
  const btnPrimario = (disabled) => ({ ...font, cursor: disabled ? "default" : "pointer", fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: "7px 16px", border: "none", background: disabled ? C.borde : C.celeste, color: disabled ? C.txt3 : "#FFF" });
  const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: C.navy };
  const inputCss = { ...font, padding: "5px 8px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12.5, color: C.navy, background: "#FFF" };

  return (
    <section style={{ ...font, marginTop: 26 }}>
      <div style={{ background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, boxShadow: "0 1px 4px rgba(30,58,95,0.06)", overflow: "hidden" }}>
        {/* Header plegable */}
        <div style={{ background: C.navy, padding: "12px 18px", color: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => setExpanded((e) => !e)} style={{ ...font, background: "none", border: "none", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            Carga de cut-offs {expanded ? "▾" : "▸"}
          </button>
          <span style={{ fontSize: 11, color: C.txt3 }}>
            {stats.confirmado} confirmadas · {stats.default} default · {stats.vacia} vacías
          </span>
        </div>

        {expanded && (
          <div style={{ padding: "14px 18px" }}>
            {/* Controles: mes objetivo + defaults + acciones */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={lbl}>
                <span>Mes objetivo</span>
                <input type="month" value={mesObjetivo} onChange={(e) => e.target.value && setMesObjetivo(e.target.value)} style={inputCss} />
              </label>
              <label style={lbl} title="Día default del cut-off mensual, dentro del mes objetivo">
                <span>Día Mensual</span>
                <input type="number" min="1" max="31" value={dias.mensual} onChange={(e) => setDias((d) => ({ ...d, mensual: +e.target.value || 1 }))} style={{ ...inputCss, width: 56 }} />
              </label>
              <label style={lbl} title="Día default del cut-off de la 1ª quincena, dentro del mes objetivo">
                <span>Día Q1</span>
                <input type="number" min="1" max="31" value={dias.q1} onChange={(e) => setDias((d) => ({ ...d, q1: +e.target.value || 1 }))} style={{ ...inputCss, width: 56 }} />
              </label>
              <label style={lbl} title="Día default del cut-off de la 2ª quincena — cae en el MES SIGUIENTE al objetivo">
                <span>Día Q2 <span style={{ color: C.txt3, fontWeight: 500 }}>(mes sig.)</span></span>
                <input type="number" min="1" max="31" value={dias.q2} onChange={(e) => setDias((d) => ({ ...d, q2: +e.target.value || 1 }))} style={{ ...inputCss, width: 56 }} />
              </label>
              <button onClick={aplicarDefaults} disabled={vaciasAutollenables === 0} style={btnPrimario(vaciasAutollenables === 0)} title="Llena solo las vacías de tipo Mensual / Q1 / Q2 con el día default del mes objetivo">
                Aplicar defaults ({vaciasAutollenables})
              </button>
              <button onClick={() => { setVerPegado((v) => !v); setResultado(null); }} style={btn()}>
                Pegar desde Excel {verPegado ? "▾" : "▸"}
              </button>
              <button onClick={copiarPlantilla} style={btn(copiado ? { borderColor: "rgba(34,197,94,0.45)", color: "#15803D" } : {})}>
                {copiado ? "Plantilla copiada ✓" : "Copiar plantilla"}
              </button>
            </div>

            {/* Pegado desde Excel */}
            {verPegado && (
              <div style={{ marginBottom: 12, background: C.off, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11.5, color: C.txt2, marginBottom: 6, lineHeight: 1.5 }}>
                  Pegá filas <strong>Cliente | Liquidación | Fecha</strong> (separadas por tab —copiar desde Excel—, «;» o «,»).
                  Fechas <strong>DD/MM/YYYY</strong> o <strong>YYYY-MM-DD</strong>. Tip: «Copiar plantilla» te da la grilla exacta para completar.
                  Lo importado entra como <strong>confirmado</strong>; las filas sin fecha se saltean.
                </div>
                <textarea
                  value={textoPegado}
                  onChange={(e) => setTextoPegado(e.target.value)}
                  rows={6}
                  placeholder={"PGI\tMensual\t18/06/2026\nCopetro\tQuincena 1\t16/06/2026"}
                  style={{ ...font, width: "100%", boxSizing: "border-box", padding: 10, border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12, color: C.navy, background: "#FFF" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={importar} disabled={!textoPegado.trim()} style={btnPrimario(!textoPegado.trim())}>Aplicar pegado</button>
                  <button onClick={() => { setVerPegado(false); setResultado(null); }} style={btn()}>Cerrar</button>
                </div>
                {resultado && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {resultado.ok > 0 && <div style={{ color: "#15803D", fontWeight: 700 }}>✓ {resultado.ok} cut-off{resultado.ok === 1 ? "" : "s"} aplicado{resultado.ok === 1 ? "" : "s"} como confirmado{resultado.ok === 1 ? "" : "s"}.</div>}
                    {resultado.errores.length > 0 && (
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: C.err }}>
                        {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                    {resultado.ok === 0 && resultado.errores.length === 0 && <div style={{ color: C.txt3 }}>No se encontraron filas con fecha para aplicar.</div>}
                  </div>
                )}
              </div>
            )}

            {/* Tabla cliente × liquidación */}
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12, color: C.navy }}>
                <thead>
                  <tr>
                    {["Cliente", "Liquidación", "Cut-off", "Estado", ""].map((h, i) => (
                      <th key={i} style={{ position: "sticky", top: 0, zIndex: 1, background: "#FFF", borderBottom: `2px solid ${C.borde}`, padding: "7px 10px", textAlign: "left", fontSize: 10, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const est = estadoDe(f.liq.id);
                    const bg = est === "confirmado" ? "rgba(34,197,94,0.07)" : est === "default" ? "rgba(245,158,11,0.10)" : "transparent";
                    return (
                      <tr key={f.liq.id} style={{ background: bg }}>
                        {f.primera && (
                          <td rowSpan={f.span} style={{ borderBottom: `1px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`, padding: "6px 10px", verticalAlign: "top", background: "#FFF" }}>
                            <button onClick={() => abrirCliente(f.cliente.id)} title="Abrir configuración del cliente (liquidaciones y etapas)" style={{ ...font, background: "none", border: "none", color: C.navy, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textAlign: "left" }}>
                              {f.cliente.nombre}
                            </button>
                          </td>
                        )}
                        <td style={{ borderBottom: `1px solid ${C.borde}`, padding: "6px 10px" }}>{f.liq.etiqueta}</td>
                        <td style={{ borderBottom: `1px solid ${C.borde}`, padding: "4px 10px" }}>
                          <input type="date" value={cutoffs[f.liq.id] || ""} onChange={(e) => setCutoff(f.liq.id, e.target.value)} style={{ ...font, padding: "3px 6px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12, color: C.navy, background: "#FFF" }} />
                        </td>
                        <td style={{ borderBottom: `1px solid ${C.borde}`, padding: "6px 10px" }}>
                          <ChipEstado tipo={est} C={C} />
                        </td>
                        <td style={{ borderBottom: `1px solid ${C.borde}`, padding: "4px 10px", whiteSpace: "nowrap" }}>
                          {est === "default" && (
                            <button onClick={() => confirmarCutoff(f.liq.id)} title="Confirmar esta fecha como real (sin cambiarla)" style={{ ...font, cursor: "pointer", fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "3px 12px", border: "1px solid rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.12)", color: "#15803D" }}>
                              ✓ Confirmar
                            </button>
                          )}
                          {cutoffs[f.liq.id] && (
                            <button onClick={() => setCutoff(f.liq.id, "")} title="Quitar cut-off" style={{ ...font, marginLeft: 6, background: "none", border: "none", color: C.txt3, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "14px 10px", color: C.txt3, fontSize: 12.5 }}>
                        Ningún cliente del alcance tiene liquidaciones definidas — configuralas tocando el cliente en las tarjetas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Clientes sin tipo de liquidación: no tienen fila arriba, pero hay que poder cargarlos */}
            {sinLiq.length > 0 && (
              <div style={{ marginTop: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.32)", borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ fontSize: 11.5, color: "#7A5104", fontWeight: 600, marginBottom: 6 }}>
                  {sinLiq.length} cliente{sinLiq.length === 1 ? "" : "s"} sin tipo de liquidación — no generan ciclo ni cut-off. Tocá uno para definir su tipo:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {sinLiq.map((c) => (
                    <button key={c.id} onClick={() => abrirCliente(c.id)} style={{ ...font, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.5)", color: "#7A5104" }}>
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: C.txt3, lineHeight: 1.5 }}>
              Los defaults son fechas <strong>tentativas</strong> (amarillo): confirmá cada una con ✓ o editándola — editar una fecha siempre la marca confirmada.
              Q2 usa el día indicado pero del mes siguiente al objetivo (regla acordada: el corte de la 2ª quincena corre con el cierre de mes).
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
