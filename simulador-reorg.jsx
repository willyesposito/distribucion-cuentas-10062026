import { useState, useMemo } from "react";

// ============================================================
// SNAPSHOT DE DATOS — Matrix Complejidad Clientes (board 6552205482)
// Leído vía MCP monday.com el 10/06/2026. NO editar a mano:
// regenerar con scripts/fetch_monday.mjs (ver CLAUDE.md).
// Columnas fuente: consultor2__1 (Consultor), color_mkpexfx8 (Jefatura),
// clasificaci_n__1 (Complejidad 1-5), n_meros__1 (Pays),
// tipo_de_liquidaci_n__1 (texto libre, poco confiable).
// ============================================================
const SNAPSHOT_DATE = "10/06/2026";

const CLIENTES = [
  { id: "6682992385", nombre: "PGI", consultor: "Sergio", jefatura: "Matías", complejidad: 2, pays: 143, tipo: "Quincenal, Mensual, Vacaciones, Ajustes" },
  { id: "7518435134", nombre: "Siasa Logística", consultor: "Celeste", jefatura: "Candela", complejidad: 3, pays: 130, tipo: null },
  { id: "6682992465", nombre: "COELSA", consultor: "Celeste", jefatura: "Candela", complejidad: 2, pays: 278, tipo: null },
  { id: "7501497399", nombre: "Red Bull", consultor: "Celeste", jefatura: "Candela", complejidad: 1, pays: 60, tipo: null },
  { id: "6682992350", nombre: "Merz", consultor: "Celeste", jefatura: "Candela", complejidad: 1, pays: 44, tipo: null },
  { id: "6682992375", nombre: "Plastic Omnium Pilar", consultor: "Micaela", jefatura: "Candela", complejidad: 4, pays: 370, tipo: "Mixto (verificado en crono: mensual + 2 quincenas)" },
  { id: "6682992427", nombre: "Finadiet", consultor: "Candela", jefatura: "Candela", complejidad: 3, pays: 362, tipo: null },
  { id: "6682992529", nombre: "Epiroc", consultor: "Micaela", jefatura: "Candela", complejidad: 2, pays: 46, tipo: null },
  { id: "6682992606", nombre: "Geopagos", consultor: "Agustina R.", jefatura: "Candela", complejidad: 2, pays: 220, tipo: "Mensual, Bonos" },
  { id: "6682992513", nombre: "Poincenot (2 Entidades)", consultor: "Agustina R.", jefatura: "Candela", complejidad: 1, pays: 84, tipo: "Mensual, Anticipos, Bonos" },
  { id: "6682992630", nombre: "Plastic Omnium Florida", consultor: "Candela", jefatura: "Candela", complejidad: 4, pays: 119, tipo: "Quincenal/mixto (pendiente verificar board fuente)" },
  { id: "6682992572", nombre: "TIM", consultor: "Agustina R.", jefatura: "Candela", complejidad: 2, pays: 165, tipo: "Mensual, Anticipos, Ajustes" },
  { id: "6682992668", nombre: "Piano", consultor: "Melina", jefatura: "Melina", complejidad: 1, pays: 23, tipo: "Mensual, Bonos" },
  { id: "6683601072", nombre: "Marval", consultor: "Araceli", jefatura: "Melina", complejidad: 4, pays: 580, tipo: "Mensual, Bonos, Liq. Adicionales" },
  { id: "6682992485", nombre: "Sportline (4 Entidades)", consultor: "Daiana", jefatura: "Melina", complejidad: 4, pays: 623, tipo: null },
  { id: "6682992420", nombre: "Copetro", consultor: "Araceli", jefatura: "Melina", complejidad: 4, pays: 120, tipo: "Mixto (verificado en crono: mensual + 2 quincenas)" },
  { id: "6682992697", nombre: "AYSA (Externos)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 1, pays: 2, tipo: null },
  { id: "6683370671", nombre: "Ford (Externos)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 1, pays: 18, tipo: null },
  { id: "6682992591", nombre: "DLA (Mixplay)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 3, pays: 280, tipo: "Bonos, Mensual, Anticipos" },
  { id: "6682992722", nombre: "Carrier (2 Entidades)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 4, pays: 424, tipo: "Mensual (verificado en crono, corte ~día 20)" },
  { id: "6682992685", nombre: "Lowsedo (3 Entidades)", consultor: "Sergio", jefatura: "Matías", complejidad: 2, pays: 72, tipo: "Mensual" },
  { id: "6682992358", nombre: "Bonafide", consultor: "Sergio", jefatura: "Matías", complejidad: 1, pays: 7, tipo: null },
  { id: "6682992399", nombre: "Campari", consultor: "Sergio", jefatura: "Matías", complejidad: 3, pays: 135, tipo: "Mensual" },
  { id: "6682992442", nombre: "Coty", consultor: "Sergio", jefatura: "Matías", complejidad: 2, pays: 116, tipo: "Mensual" },
  { id: "6682992495", nombre: "GSMA", consultor: "Sergio", jefatura: "Matías", complejidad: 1, pays: 9, tipo: null },
  // Toyota: equipo de 3 (Franco jefe + Eileen + Laura). La carga se reparte entre los tres
  // mientras esté asignado a Franco; si se reasigna, todo va al destino y el equipo deja de aplicar.
  { id: "6682992534", nombre: "Toyota", consultor: "Franco", equipo: ["Eileen", "Laura"], jefatura: "Franco", complejidad: 5, pays: 8000, tipo: null, distorsiona: true },
];

// Roster de analistas (consultores reales + targets válidos de reasignación).
// Cambio 10/06/2026: Pablo eliminado del roster; Team TASA reemplazado por Franco + Eileen + Laura.
const ANALISTAS = [
  { nombre: "Candela", jefatura: "Candela" },
  { nombre: "Micaela", jefatura: "Candela" },
  { nombre: "Celeste", jefatura: "Candela" },
  { nombre: "Agustina R.", jefatura: "Candela" },
  { nombre: "Melina", jefatura: "Melina" },
  { nombre: "Araceli", jefatura: "Melina" },
  { nombre: "Daiana", jefatura: "Melina" },
  { nombre: "Agustina C.", jefatura: "Melina" },
  { nombre: "Sergio", jefatura: "Matías" },
  { nombre: "Franco", jefatura: "Franco" },
  { nombre: "Eileen", jefatura: "Franco" },
  { nombre: "Laura", jefatura: "Franco" },
];

const ORDEN_JEFATURAS = ["Candela", "Melina", "Matías", "Franco"];

const VALIDACIONES = [
  "Toyota tiene 8.000 pays (vs. 623 del segundo más alto): domina la normalización de Pays. Usá el toggle para excluirlo del cálculo y comparar.",
  "Toyota se modela como equipo Franco + Eileen + Laura: la carga del cliente se reparte 1/3 entre los tres mientras esté asignado a Franco. Si lo movés a otro analista, todo va al destino.",
  "10 de los 26 clientes no tienen Tipo de Liquidación cargado (tipo_de_liquidaci_n__1 vacío); el ciclo real se infiere del crono en la v2.",
  "Plastic Omnium Florida: el patrón quincenal está sin verificar (no se llegó al board fuente). Se asume patrón Pilar hasta confirmar.",
  "El corte de novedades del mes en curso puede no estar cargado todavía en el crono fuente (caso Carrier): cuando falte, la v2 pide el cut-off.",
  "El tipo de liquidación de cada cliente arranca con una inferencia del campo `tipo` (Matrix). Confirmá / corregí en el panel del cliente para fijar instancias y SLA.",
];

// ---- Tokens de marca H&A (apps digitales internas) ----
const C = {
  navy: "#1E3A5F", navyDeep: "#0F2133", celeste: "#00ACD4", celesteDark: "#0090B4",
  txt2: "#4A6080", txt3: "#8FA3BA", borde: "#DDE5EF", off: "#F4F7FA",
  ok: "#22C55E", warn: "#F59E0B", err: "#E85518", gris: "#8C837B",
};
const font = { fontFamily: "'Source Sans Pro', Arial, Helvetica, sans-serif" };

// ---- Helpers de liquidaciones ----
let _idSeq = 0;
const rid = () => `i_${++_idSeq}_${Math.random().toString(36).slice(2, 7)}`;

const INSTANCIAS_MENSUAL = () => [
  { id: rid(), nombre: "Cut Off",        slaHabiles: 0 },
  { id: rid(), nombre: "v1",             slaHabiles: 2 },
  { id: rid(), nombre: "Comentarios v1", slaHabiles: 1 },
  { id: rid(), nombre: "v2",             slaHabiles: 1 },
  { id: rid(), nombre: "Aprobación",     slaHabiles: 1 },
];

const INSTANCIAS_QUINCENA = (slaQ) => [
  { id: rid(), nombre: "Cut Off",        slaHabiles: 0 },
  { id: rid(), nombre: "v1",             slaHabiles: slaQ },
  { id: rid(), nombre: "Comentarios v1", slaHabiles: slaQ },
  { id: rid(), nombre: "v2",             slaHabiles: slaQ },
  { id: rid(), nombre: "Aprobación",     slaHabiles: slaQ },
];

function genLiquidaciones(tipo, slaQ) {
  const liqs = [];
  if (tipo === "mensual" || tipo === "ambos") {
    liqs.push({ id: rid(), etiqueta: "Mensual", instancias: INSTANCIAS_MENSUAL() });
  }
  if (tipo === "quincenal" || tipo === "ambos") {
    liqs.push({ id: rid(), etiqueta: "Quincena 1", instancias: INSTANCIAS_QUINCENA(slaQ) });
    liqs.push({ id: rid(), etiqueta: "Quincena 2", instancias: INSTANCIAS_QUINCENA(slaQ) });
  }
  return liqs;
}

function inferirTipo(tipoTexto) {
  if (!tipoTexto) return "ninguno";
  const t = tipoTexto.toLowerCase();
  if (t.includes("mixto")) return "ambos";
  const tieneM = t.includes("mensual");
  const tieneQ = t.includes("quincen") || t.includes("1q") || t.includes("2q");
  if (tieneM && tieneQ) return "ambos";
  if (tieneQ) return "quincenal";
  if (tieneM) return "mensual";
  return "ninguno";
}

const formatN = (n) => Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".0", "");

function Badge({ color, children }) {
  const rgb = { [C.ok]: "34,197,94", [C.warn]: "245,158,11", [C.err]: "232,85,24", [C.celeste]: "0,172,212", [C.gris]: "140,131,123" }[color] || "0,172,212";
  return (
    <span style={{ background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.32)`, color, borderRadius: 9999, padding: "3px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: C.celeste, marginBottom: 10 }}>{children}</div>;
}

export default function SimuladorReorg() {
  // pesos crudos 0-100; se normalizan al calcular
  const [pesos, setPesos] = useState({ comp: 40, cant: 35, pays: 25 });
  const [excluirToyota, setExcluirToyota] = useState(true);
  const [asignacion, setAsignacion] = useState(() => Object.fromEntries(CLIENTES.map(c => [c.id, c.consultor])));
  const [seleccionado, setSeleccionado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [verValidacion, setVerValidacion] = useState(true);
  const [analistasExcluidos, setAnalistasExcluidos] = useState(() => new Set());
  const [verAnalistas, setVerAnalistas] = useState(false);
  const [slaQuincena, setSlaQuincena] = useState(1); // días hábiles por defecto entre instancias quincenales (24 hs = 1)
  const [configClientes, setConfigClientes] = useState(() => {
    return Object.fromEntries(CLIENTES.map(c => {
      const tipoLiq = inferirTipo(c.tipo);
      return [c.id, { tipoLiq, liquidaciones: genLiquidaciones(tipoLiq, 1) }];
    }));
  });

  const incluidos = useMemo(() => CLIENTES.filter(c => !(excluirToyota && c.distorsiona)), [excluirToyota]);

  const analistasVisibles = useMemo(
    () => ANALISTAS.filter(a => !analistasExcluidos.has(a.nombre)),
    [analistasExcluidos]
  );
  const nombresVisibles = useMemo(() => new Set(analistasVisibles.map(a => a.nombre)), [analistasVisibles]);

  const sumaPesos = pesos.comp + pesos.cant + pesos.pays || 1;
  const w = { comp: pesos.comp / sumaPesos, cant: pesos.cant / sumaPesos, pays: pesos.pays / sumaPesos };

  // Carga por analista para una asignación dada.
  // Si el asignado es excluido → cliente va a "Sin asignar".
  // Si el cliente tiene `equipo` Y sigue asignado al consultor original → se reparte entre los miembros visibles.
  const cargaPor = (asig) => {
    const m = {};
    analistasVisibles.forEach(a => { m[a.nombre] = { n: 0, comp: 0, pays: 0 }; });
    m["Sin asignar"] = { n: 0, comp: 0, pays: 0 };

    incluidos.forEach(c => {
      const anRaw = asig[c.id];
      const an = nombresVisibles.has(anRaw) ? anRaw : "Sin asignar";

      const usandoEquipo = c.equipo && an === c.consultor;
      let integrantes;
      if (usandoEquipo) {
        integrantes = [c.consultor, ...c.equipo].filter(n => nombresVisibles.has(n));
        if (integrantes.length === 0) integrantes = ["Sin asignar"];
      } else {
        integrantes = [an];
      }
      const div = integrantes.length;
      integrantes.forEach(nom => {
        if (!m[nom]) m[nom] = { n: 0, comp: 0, pays: 0 };
        m[nom].n += 1 / div;
        m[nom].comp += (c.complejidad || 0) / div;
        m[nom].pays += (c.pays || 0) / div;
      });
    });
    return m;
  };

  const { scores, baseScores, media } = useMemo(() => {
    const base = cargaPor(Object.fromEntries(CLIENTES.map(c => [c.id, c.consultor])));
    const cur = cargaPor(asignacion);
    // Denominadores FIJOS del escenario base → los scores son comparables antes/después
    const dComp = Math.max(...Object.values(base).map(x => x.comp), 1);
    const dN = Math.max(...Object.values(base).map(x => x.n), 1);
    const dPays = Math.max(...Object.values(base).map(x => x.pays), 1);
    const calc = (x) => Math.round(100 * (w.comp * x.comp / dComp + w.cant * x.n / dN + w.pays * x.pays / dPays));
    const scores = {}, baseScores = {};
    Object.keys(cur).forEach(a => { scores[a] = { ...cur[a], score: calc(cur[a]) }; });
    Object.keys(base).forEach(a => { baseScores[a] = calc(base[a]); });
    const activos = Object.entries(scores).filter(([k, s]) => k !== "Sin asignar" && s.n > 0).map(([, s]) => s);
    const media = activos.length ? activos.reduce((s, x) => s + x.score, 0) / activos.length : 0;
    return { scores, baseScores, media };
  }, [asignacion, w.comp, w.cant, w.pays, incluidos, analistasVisibles]);

  const semaforo = (score, n) => {
    if (n === 0) return { color: C.gris, label: "Sin clientes" };
    if (score > media * 1.15) return { color: C.err, label: "Sobrecargado" };
    if (score < media * 0.85) return { color: C.celeste, label: "Subcargado" };
    return { color: C.ok, label: "Equilibrado" };
  };

  const cambios = useMemo(() => CLIENTES.filter(c => asignacion[c.id] !== c.consultor).map(c => {
    const destino = asignacion[c.id];
    const jefDestino = (ANALISTAS.find(a => a.nombre === destino) || {}).jefatura || "?";
    return { cliente: c.nombre, de: c.consultor, jefDe: c.jefatura || "Sin jefatura", a: destino, jefA: jefDestino, cambiaJef: (c.jefatura || "Sin jefatura") !== jefDestino, id: c.id };
  }), [asignacion]);

  const mover = (clienteId, destino) => {
    setAsignacion(prev => ({ ...prev, [clienteId]: destino }));
    setSeleccionado(null);
  };
  const deshacer = (clienteId) => {
    const c = CLIENTES.find(x => x.id === clienteId);
    setAsignacion(prev => ({ ...prev, [clienteId]: c.consultor }));
  };
  const reiniciar = () => { setAsignacion(Object.fromEntries(CLIENTES.map(c => [c.id, c.consultor]))); setSeleccionado(null); };

  // ---- Acciones sobre configClientes (tipo de liquidación + instancias) ----
  const setTipoLiqCliente = (clienteId, nuevoTipo) => {
    setConfigClientes(prev => ({
      ...prev,
      [clienteId]: { tipoLiq: nuevoTipo, liquidaciones: genLiquidaciones(nuevoTipo, slaQuincena) },
    }));
  };
  const regenerarDefault = (clienteId) => {
    const tipoLiq = configClientes[clienteId]?.tipoLiq || "ninguno";
    setConfigClientes(prev => ({
      ...prev,
      [clienteId]: { tipoLiq, liquidaciones: genLiquidaciones(tipoLiq, slaQuincena) },
    }));
  };
  const editarInstancia = (clienteId, liqId, instId, campo, valor) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l,
        instancias: l.instancias.map(i => i.id !== instId ? i : ({ ...i, [campo]: valor })),
      }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const eliminarInstancia = (clienteId, liqId, instId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l,
        instancias: l.instancias.filter(i => i.id !== instId),
      }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const agregarInstancia = (clienteId, liqId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l,
        instancias: [...l.instancias, { id: rid(), nombre: "Nueva etapa", slaHabiles: 1 }],
      }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const renombrarLiquidacion = (clienteId, liqId, etiqueta) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({ ...l, etiqueta }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const eliminarLiquidacion = (clienteId, liqId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      return { ...prev, [clienteId]: { ...cfg, liquidaciones: cfg.liquidaciones.filter(l => l.id !== liqId) } };
    });
  };
  const agregarLiquidacion = (clienteId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const nueva = { id: rid(), etiqueta: "Liquidación adicional", instancias: INSTANCIAS_MENSUAL() };
      return { ...prev, [clienteId]: { ...cfg, liquidaciones: [...cfg.liquidaciones, nueva] } };
    });
  };

  // ---- Filtro de analistas ----
  const toggleExcluido = (nombre) => {
    setAnalistasExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };
  const incluirTodos = () => setAnalistasExcluidos(new Set());

  const planTexto = useMemo(() => {
    const fecha = new Date().toLocaleDateString("es-AR");
    const lineas = cambios.map((m, i) => `${i + 1}. ${m.cliente}: ${m.de} (Jef. ${m.jefDe}) → ${m.a} (Jef. ${m.jefA})${m.cambiaJef ? "  [CAMBIA JEFATURA]" : ""}`);
    const csv = ["cliente,analista_origen,jefatura_origen,analista_destino,jefatura_destino", ...cambios.map(m => `"${m.cliente}",${m.de},${m.jefDe},${m.a},${m.jefA}`)].join("\n");
    return `PLAN DE CAMBIOS — generado ${fecha} sobre snapshot Matrix del ${SNAPSHOT_DATE}\nAplicar a mano en Monday (board 6552205482, columnas consultor2__1 y color_mkpexfx8).\n\n${lineas.join("\n")}\n\n--- CSV ---\n${csv}`;
  }, [cambios]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(planTexto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { /* fallback: el textarea de abajo permite seleccionar todo */ }
  };

  const clienteSel = seleccionado ? CLIENTES.find(c => c.id === seleccionado) : null;
  const cfgSel = clienteSel ? configClientes[clienteSel.id] : null;

  const slider = (key, label) => (
    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{label} <span style={{ color: C.celeste, fontWeight: 700 }}>{Math.round(100 * pesos[key] / sumaPesos)}%</span></span>
      <input type="range" min="0" max="100" value={pesos[key]} onChange={e => setPesos(p => ({ ...p, [key]: +e.target.value }))} style={{ accentColor: C.celeste }} />
    </label>
  );

  const sinAsignar = scores["Sin asignar"] || { n: 0, comp: 0, pays: 0, score: 0 };
  const clientesSinAsignar = incluidos.filter(c => !nombresVisibles.has(asignacion[c.id]));

  return (
    <div style={{ ...font, background: C.off, minHeight: "100vh", color: C.navy }}>
      {/* Header */}
      <header style={{ background: C.navyDeep, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.celeste, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 700, fontSize: 16, letterSpacing: "-0.5px", fontStyle: "italic" }}>H&A</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#FFF" }}>Simulador de Reorganización — Payroll</h1>
          <div style={{ fontSize: 12, color: C.txt3 }}>Sandbox de reasignaciones · nunca escribe en Monday · MVP (calendario de fechas llega en v2)</div>
        </div>
        <Badge color={C.celeste}>Snapshot Matrix · {SNAPSHOT_DATE}</Badge>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 20px 60px" }}>
        {/* Controles */}
        <section style={{ background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(30,58,95,0.06)", display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 3, minWidth: 320 }}>
            <SectionLabel>Pesos del score de carga (se normalizan solos)</SectionLabel>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {slider("comp", "Σ Complejidad")}{slider("cant", "Cant. clientes")}{slider("pays", "Σ Pays")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: C.navy }}>
              <span>SLA quincenas <span style={{ color: C.txt3, fontWeight: 500 }}>(días hábiles entre etapas)</span></span>
              <input type="number" min="0" step="0.5" value={slaQuincena} onChange={e => setSlaQuincena(Math.max(0, +e.target.value || 0))} style={{ ...font, width: 80, padding: "6px 8px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 13, color: C.navy }} />
            </label>
            <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={excluirToyota} onChange={e => setExcluirToyota(e.target.checked)} style={{ accentColor: C.celeste }} />
              Excluir Toyota del score
            </label>
            <button onClick={reiniciar} style={{ ...font, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9999, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.borde}`, background: "#FFF", color: C.navy, padding: "9px 20px", fontSize: 13 }}>
              Reiniciar escenario
            </button>
          </div>
        </section>

        {/* Filtro de analistas */}
        <section style={{ marginTop: 14, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, padding: "12px 18px", boxShadow: "0 1px 4px rgba(30,58,95,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setVerAnalistas(v => !v)} style={{ ...font, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: C.celeste, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Analistas activos ({ANALISTAS.length - analistasExcluidos.size} / {ANALISTAS.length}) {verAnalistas ? "▾" : "▸"}
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {analistasExcluidos.size > 0 && (
                <button onClick={incluirTodos} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "5px 14px", fontSize: 11, fontWeight: 600, color: C.txt2, cursor: "pointer" }}>
                  Incluir todos
                </button>
              )}
              {clientesSinAsignar.length > 0 && <Badge color={C.warn}>{clientesSinAsignar.length} clientes sin asignar</Badge>}
            </div>
          </div>
          {verAnalistas && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {ORDEN_JEFATURAS.map(jef => (
                <div key={jef} style={{ background: C.off, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.txt3, marginBottom: 6 }}>Jef. {jef}</div>
                  {ANALISTAS.filter(a => a.jefatura === jef).map(a => (
                    <label key={a.nombre} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.navy, padding: "3px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={!analistasExcluidos.has(a.nombre)} onChange={() => toggleExcluido(a.nombre)} style={{ accentColor: C.celeste }} />
                      {a.nombre}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Validación de datos */}
        <section style={{ marginTop: 14, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.32)", borderRadius: 14, padding: "12px 18px" }}>
          <button onClick={() => setVerValidacion(v => !v)} style={{ ...font, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: "#B07408", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Validación de datos ({VALIDACIONES.length}) {verValidacion ? "▾" : "▸"}
          </button>
          {verValidacion && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#7A5104", lineHeight: 1.55 }}>
              {VALIDACIONES.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
        </section>

        {/* Barra de movimiento */}
        {clienteSel && (
          <section style={{ position: "sticky", top: 8, zIndex: 10, marginTop: 14, background: C.navy, color: "#FFF", borderRadius: 14, padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", boxShadow: "0 10px 30px rgba(15,33,51,0.35)" }}>
            <span style={{ fontSize: 13 }}>Mover <strong>{clienteSel.nombre}</strong> (hoy: {asignacion[clienteSel.id]}) a:</span>
            <select defaultValue="" onChange={e => e.target.value && mover(clienteSel.id, e.target.value)} style={{ ...font, padding: "8px 12px", borderRadius: 8, border: "none", fontSize: 13, color: C.navy }}>
              <option value="" disabled>Elegí analista…</option>
              {ORDEN_JEFATURAS.map(j => {
                const grupo = analistasVisibles.filter(a => a.jefatura === j && a.nombre !== asignacion[clienteSel.id]);
                return grupo.length ? (
                  <optgroup key={j} label={`Jefatura ${j}`}>
                    {grupo.map(a => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
            <button onClick={() => setSeleccionado(null)} style={{ ...font, marginLeft: "auto", background: "rgba(255,255,255,0.12)", color: "#FFF", border: "none", borderRadius: 9999, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </section>
        )}

        {/* Panel de configuración del cliente seleccionado */}
        {clienteSel && cfgSel && (
          <section style={{ marginTop: 14, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(30,58,95,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <SectionLabel>Liquidaciones de {clienteSel.nombre}</SectionLabel>
              <button onClick={() => regenerarDefault(clienteSel.id)} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "5px 14px", fontSize: 11, fontWeight: 600, color: C.txt2, cursor: "pointer" }}>
                ⟳ Restaurar default
              </button>
            </div>

            {/* Selector de tipo */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { v: "ninguno", l: "Sin liquidación regular" },
                { v: "mensual", l: "Mensual" },
                { v: "quincenal", l: "Quincenal" },
                { v: "ambos", l: "Ambos (Mensual + Quincenas)" },
              ].map(o => {
                const sel = cfgSel.tipoLiq === o.v;
                return (
                  <button key={o.v} onClick={() => setTipoLiqCliente(clienteSel.id, o.v)} style={{ ...font, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 9999, background: sel ? C.celeste : "#FFF", color: sel ? "#FFF" : C.navy, border: `1px solid ${sel ? C.celesteDark : C.borde}` }}>
                    {o.l}
                  </button>
                );
              })}
            </div>

            {/* Liquidaciones */}
            {cfgSel.liquidaciones.length === 0 && (
              <div style={{ fontSize: 12.5, color: C.txt3, padding: "10px 0" }}>
                Sin liquidaciones definidas. Elegí un tipo o agregá una manualmente.
              </div>
            )}
            {cfgSel.liquidaciones.map(liq => (
              <div key={liq.id} style={{ marginBottom: 12, padding: "10px 12px", background: C.off, borderRadius: 10, border: `1px solid ${C.borde}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <input value={liq.etiqueta} onChange={e => renombrarLiquidacion(clienteSel.id, liq.id, e.target.value)} style={{ ...font, fontSize: 13, fontWeight: 700, color: C.navy, border: "none", background: "transparent", borderBottom: `1px dashed ${C.borde}`, padding: "2px 4px", flex: 1, minWidth: 140 }} />
                  <button onClick={() => eliminarLiquidacion(clienteSel.id, liq.id)} title="Eliminar liquidación" style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: C.err, cursor: "pointer" }}>
                    Eliminar
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {liq.instancias.map((inst, idx) => (
                    <div key={inst.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "3px 4px 3px 10px" }}>
                      <input value={inst.nombre} onChange={e => editarInstancia(clienteSel.id, liq.id, inst.id, "nombre", e.target.value)} style={{ ...font, fontSize: 11.5, fontWeight: 600, color: C.navy, border: "none", outline: "none", background: "transparent", width: Math.max(60, (inst.nombre?.length || 6) * 7) }} />
                      <span style={{ fontSize: 10, color: C.txt3, fontWeight: 600 }}>+</span>
                      <input type="number" min="0" step="0.5" value={inst.slaHabiles} onChange={e => editarInstancia(clienteSel.id, liq.id, inst.id, "slaHabiles", Math.max(0, +e.target.value || 0))}
                        title={idx === 0 ? "Cut Off no usa SLA (es el punto de partida)" : "Días hábiles desde la etapa anterior"}
                        style={{ ...font, width: 42, fontSize: 11.5, fontWeight: 700, color: C.celeste, textAlign: "right", border: "none", background: "transparent", outline: "none" }} />
                      <span style={{ fontSize: 10, color: C.txt3, fontWeight: 600 }}>d</span>
                      <button onClick={() => eliminarInstancia(clienteSel.id, liq.id, inst.id)} title="Eliminar etapa" style={{ background: "none", border: "none", color: C.txt3, cursor: "pointer", fontSize: 13, padding: "0 6px", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => agregarInstancia(clienteSel.id, liq.id)} style={{ ...font, background: "transparent", border: `1px dashed ${C.celeste}`, color: C.celesteDark, borderRadius: 9999, padding: "3px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Etapa</button>
                </div>
              </div>
            ))}
            <button onClick={() => agregarLiquidacion(clienteSel.id)} style={{ ...font, background: C.navy, color: "#FFF", border: "none", borderRadius: 9999, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              + Liquidación
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: C.txt3 }}>
              Las nuevas liquidaciones quincenales usan SLA <strong>{slaQuincena}</strong> día(s) hábil(es) entre etapas. Editá el SLA global arriba o cada etapa acá.
            </div>
          </section>
        )}

        {/* Tarjeta "Sin asignar" si corresponde */}
        {clientesSinAsignar.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <SectionLabel>Sin analista activo</SectionLabel>
            <div style={{ background: "#FFF", border: `1px dashed ${C.warn}`, borderRadius: 14, padding: "12px 15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Sin asignar</div>
                  <div style={{ fontSize: 11, color: C.txt2 }}>Clientes cuyo analista actual fue excluido del escenario. Reasignalos antes de armar el plan.</div>
                </div>
                <Badge color={C.warn}>{formatN(sinAsignar.n)} clientes</Badge>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientesSinAsignar.map(c => {
                  const sel = seleccionado === c.id;
                  return (
                    <button key={c.id} onClick={() => setSeleccionado(sel ? null : c.id)} title={`Estaba en ${asignacion[c.id]} · Complejidad ${c.complejidad} · ${c.pays} pays`}
                      style={{ ...font, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, background: sel ? C.celeste : "rgba(245,158,11,0.12)", color: sel ? "#FFF" : C.navy, border: sel ? `1px solid ${C.celesteDark}` : "1px solid rgba(245,158,11,0.45)" }}>
                      {c.nombre} <span style={{ opacity: 0.65 }}>·C{c.complejidad}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Tarjetas por jefatura */}
        {ORDEN_JEFATURAS.filter(j => analistasVisibles.some(a => a.jefatura === j)).map(jef => (
          <section key={jef} style={{ marginTop: 26 }}>
            <SectionLabel>Jefatura {jef}</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: 14 }}>
              {analistasVisibles.filter(a => a.jefatura === jef).map(a => {
                const s = scores[a.nombre] || { n: 0, comp: 0, pays: 0, score: 0 };
                const base = baseScores[a.nombre] ?? 0;
                const delta = s.score - base;
                const sem = semaforo(s.score, s.n);
                // Clientes "visibles" en esta tarjeta: los asignados directamente +
                // los del equipo que comparten (Toyota cuando este analista es Franco/Eileen/Laura).
                const clientesDirectos = incluidos.filter(c => asignacion[c.id] === a.nombre);
                const clientesEquipo = incluidos.filter(c => c.equipo
                  && asignacion[c.id] === c.consultor
                  && a.nombre !== c.consultor
                  && c.equipo.includes(a.nombre)
                  && nombresVisibles.has(c.consultor));
                return (
                  <div key={a.nombre} style={{ position: "relative", background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, boxShadow: "0 1px 4px rgba(30,58,95,0.06)", overflow: "hidden" }}>
                    <div style={{ height: 3, background: sem.color === C.gris ? C.borde : sem.color }} />
                    <div style={{ padding: "13px 15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nombre}</div>
                          <div style={{ fontSize: 10.5, color: C.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Jef. {a.jefatura}</div>
                        </div>
                        <Badge color={sem.color}>{sem.label}</Badge>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                        <span style={{ fontSize: 30, fontWeight: 700, color: C.celeste, lineHeight: 1 }}>{s.score}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.txt3 }}>Carga</span>
                        {delta !== 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: delta > 0 ? C.err : C.ok }}>
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} <span style={{ color: C.txt3, fontWeight: 600 }}>(antes {base})</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, color: C.txt2 }}>
                        <span><strong style={{ color: C.navy }}>{formatN(s.n)}</strong> clientes</span>
                        <span>Σ compl <strong style={{ color: C.navy }}>{formatN(s.comp)}</strong></span>
                        <span>Σ pays <strong style={{ color: C.navy }}>{Math.round(s.pays).toLocaleString("es-AR")}</strong></span>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {clientesDirectos.map(c => {
                          const movido = asignacion[c.id] !== c.consultor;
                          const sel = seleccionado === c.id;
                          const tieneEquipo = c.equipo && asignacion[c.id] === c.consultor;
                          return (
                            <button key={c.id} onClick={() => setSeleccionado(sel ? null : c.id)} title={`Complejidad ${c.complejidad} · ${c.pays} pays · ${c.tipo || "tipo s/d"}${movido ? ` · venía de ${c.consultor}` : ""}${tieneEquipo ? ` · equipo: ${[c.consultor, ...c.equipo].join(", ")}` : ""}`}
                              style={{ ...font, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 9999,
                                background: sel ? C.celeste : movido ? "rgba(0,172,212,0.12)" : C.off,
                                color: sel ? "#FFF" : C.navy,
                                border: sel ? `1px solid ${C.celesteDark}` : movido ? "1px solid rgba(0,172,212,0.45)" : `1px solid ${C.borde}` }}>
                              {c.nombre} <span style={{ opacity: 0.65 }}>·C{c.complejidad}</span>{tieneEquipo && " 👥"}{movido && " ↩"}
                            </button>
                          );
                        })}
                        {clientesEquipo.map(c => {
                          const sel = seleccionado === c.id;
                          return (
                            <button key={`eq-${c.id}`} onClick={() => setSeleccionado(sel ? null : c.id)} title={`Apoyo del equipo · Líder: ${c.consultor} · Complejidad ${c.complejidad} · ${c.pays} pays`}
                              style={{ ...font, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, background: sel ? C.celeste : "rgba(140,131,123,0.10)", color: sel ? "#FFF" : C.txt2, border: sel ? `1px solid ${C.celesteDark}` : `1px dashed ${C.borde}`, fontStyle: "italic" }}>
                              {c.nombre} <span style={{ opacity: 0.65 }}>·equipo de {c.consultor}</span>
                            </button>
                          );
                        })}
                        {clientesDirectos.length === 0 && clientesEquipo.length === 0 && (
                          <span style={{ fontSize: 11.5, color: C.txt3 }}>Sin clientes asignados — podés moverle alguno.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Plan de cambios */}
        <section style={{ marginTop: 30, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(30,58,95,0.06)" }}>
          <div style={{ background: C.navy, padding: "12px 18px", color: "#FFF", fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Plan de Cambios ({cambios.length}) — comparador antes / después</span>
            {cambios.length > 0 && (
              <button onClick={copiar} style={{ ...font, background: C.celeste, color: "#FFF", border: "none", borderRadius: 9999, padding: "7px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {copiado ? "Copiado ✓" : "Copiar plan"}
              </button>
            )}
          </div>
          <div style={{ padding: "14px 18px", fontSize: 13, color: C.txt2 }}>
            {cambios.length === 0 ? (
              <span>Todavía no hay movimientos. Tocá un cliente en cualquier tarjeta y elegí a quién moverlo. Acá se va a armar la lista para aplicar a mano en Monday.</span>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: C.txt3, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.07em" }}>
                      <th style={{ padding: "6px 8px" }}>Cliente</th><th style={{ padding: "6px 8px" }}>De</th><th style={{ padding: "6px 8px" }}>A</th><th style={{ padding: "6px 8px" }}>Jefatura</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambios.map(m => (
                      <tr key={m.id} style={{ borderTop: `1px solid ${C.borde}`, color: C.navy }}>
                        <td style={{ padding: "8px", fontWeight: 700 }}>{m.cliente}</td>
                        <td style={{ padding: "8px" }}>{m.de} <span style={{ color: C.txt3 }}>({m.jefDe})</span></td>
                        <td style={{ padding: "8px" }}>{m.a} <span style={{ color: C.txt3 }}>({m.jefA})</span></td>
                        <td style={{ padding: "8px" }}>{m.cambiaJef ? <Badge color={C.warn}>Cambia: {m.jefDe} → {m.jefA}</Badge> : <Badge color={C.gris}>Sin cambio</Badge>}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button onClick={() => deshacer(m.id)} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: C.txt2, cursor: "pointer" }}>Deshacer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <textarea readOnly value={planTexto} onClick={e => e.target.select()} rows={Math.min(12, cambios.length + 8)}
                  style={{ ...font, width: "100%", marginTop: 14, padding: 12, border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12, color: C.navy, background: C.off, boxSizing: "border-box" }} />
              </>
            )}
          </div>
        </section>

        <footer style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 10, color: C.gris, fontSize: 11.5 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.celeste, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 700, fontSize: 9, fontStyle: "italic" }}>H&A</div>
          <span>Hidalgo & Asociados · Fuente: Matrix Complejidad Clientes (6552205482) · Score = {Math.round(100 * w.comp)}% compl + {Math.round(100 * w.cant)}% cant + {Math.round(100 * w.pays)}% pays, normalizado contra el máximo del escenario base.</span>
        </footer>
      </main>
    </div>
  );
}
