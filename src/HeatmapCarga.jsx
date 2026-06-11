import { useMemo, useState, Fragment } from "react";
import {
  generarEventosCliente,
  cargaDiaria,
  detectarChoques,
  indicadores,
  esHabil,
  aISO,
  aDate,
} from "./ciclos.js";

// HeatmapCarga — calendario analista × día con horas, choques e indicadores antes/después.
// Diseño acordado en PLAN-V2.md (Q1-A, Q2-A, Q3-A, Q4-A, Q5-A, Q6 confirmado, Q7-A).

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW = ["D", "L", "M", "X", "J", "V", "S"];

export default function HeatmapCarga({
  clientes,
  baseAsignacion,
  asignacion,
  configClientes,
  cutoffs,
  feriadosSet,
  analistasVisibles,
  nombresVisibles,
  ordenJefaturas,
  ajustarPorComplejidad,
  setAjustarPorComplejidad,
  nSinConfirmar = 0,
  C,
  font,
}) {
  const [expanded, setExpanded] = useState(true);
  const [popover, setPopover] = useState(null);

  // Resuelve eventos para una asignación dada, repartiendo entre integrantes si es equipo (Toyota).
  const resolverEventos = (asig) => {
    const out = [];
    for (const c of clientes) {
      const cfg = configClientes[c.id];
      if (!cfg) continue;
      const evs = generarEventosCliente(c, cfg, cutoffs, feriadosSet, { ajustarPorComplejidad });
      if (evs.length === 0) continue;
      const anRaw = asig[c.id];
      const an = nombresVisibles.has(anRaw) ? anRaw : "Sin asignar";
      const usandoEquipo = c.equipo && an === c.consultor;
      let integrantes;
      if (usandoEquipo) {
        integrantes = [c.consultor, ...c.equipo].filter((n) => nombresVisibles.has(n));
        if (integrantes.length === 0) integrantes = ["Sin asignar"];
      } else {
        integrantes = [an];
      }
      const div = integrantes.length;
      for (const ev of evs) {
        for (const nom of integrantes) {
          out.push({ ...ev, analista: nom, horas: +(ev.horas / div).toFixed(2) });
        }
      }
    }
    return out;
  };

  const depsResolver = [clientes, configClientes, cutoffs, feriadosSet, nombresVisibles, ajustarPorComplejidad];
  const eventosBase = useMemo(() => resolverEventos(baseAsignacion), [baseAsignacion, ...depsResolver]);
  const eventosAsig = useMemo(() => resolverEventos(asignacion), [asignacion, ...depsResolver]);

  // Indicadores: ignoran "Sin asignar" porque no es un destino real.
  const sinSinAsig = (evs) => evs.filter((e) => e.analista !== "Sin asignar");
  const indBase = useMemo(() => indicadores(sinSinAsig(eventosBase), feriadosSet, []), [eventosBase, feriadosSet]);
  const indAsig = useMemo(() => indicadores(sinSinAsig(eventosAsig), feriadosSet, []), [eventosAsig, feriadosSet]);

  const carga = useMemo(() => cargaDiaria(eventosAsig), [eventosAsig]);
  const choques = useMemo(() => detectarChoques(sinSinAsig(eventosAsig), feriadosSet), [eventosAsig, feriadosSet]);

  // Mapa choques por celda (analista|fecha) → "duro" | "advertencia". Duro pisa advertencia.
  const choquesMap = useMemo(() => {
    const m = {};
    for (const ch of choques) {
      for (const ev of ch.eventos) {
        const k = `${ch.analista}|${ev.fecha}`;
        if (ch.tipo === "duro" || !m[k]) m[k] = ch.tipo;
      }
    }
    return m;
  }, [choques]);

  // Eventos por celda para el popover.
  const evPorCelda = useMemo(() => {
    const m = {};
    for (const ev of eventosAsig) {
      const k = `${ev.analista}|${ev.fecha}`;
      (m[k] ??= []).push(ev);
    }
    return m;
  }, [eventosAsig]);

  // Rango: días hábiles entre min y max de eventos del escenario actual.
  const fechas = useMemo(() => {
    if (eventosAsig.length === 0) return [];
    const isos = eventosAsig.map((e) => e.fecha).sort();
    const ini = aDate(isos[0]);
    const fin = aDate(isos[isos.length - 1]);
    const out = [];
    let d = new Date(ini);
    while (d <= fin) {
      const iso = aISO(d);
      if (esHabil(iso, feriadosSet)) out.push(iso);
      d = new Date(d.getTime() + 86400000);
    }
    return out;
  }, [eventosAsig, feriadosSet]);

  // Filas: analistas visibles agrupados por jefatura. "Sin asignar" como grupo aparte si tiene eventos.
  const grupos = useMemo(() => {
    const gs = [];
    for (const jef of ordenJefaturas) {
      const ans = analistasVisibles.filter((a) => a.jefatura === jef);
      if (ans.length) gs.push({ jef, analistas: ans });
    }
    if (eventosAsig.some((e) => e.analista === "Sin asignar")) {
      gs.push({ jef: "Sin analista activo", analistas: [{ nombre: "Sin asignar", jefatura: "Sin analista activo" }] });
    }
    return gs;
  }, [ordenJefaturas, analistasVisibles, eventosAsig]);

  // Escala de color: techo = max(maxHorasDia, 8h) para que un solo evento liviano no se vea rojo.
  const max = Math.max(carga.maxHorasDia, 8);

  // Gradiente celeste #00ACD4 → amarillo #F59E0B → rojo #E85518
  const colorCelda = (h) => {
    if (!h) return "transparent";
    const t = Math.min(1, h / max);
    let r, g, b;
    if (t < 0.5) {
      const f = t / 0.5;
      r = Math.round(0 + f * 245);
      g = Math.round(172 + f * (158 - 172));
      b = Math.round(212 + f * (11 - 212));
    } else {
      const f = (t - 0.5) / 0.5;
      r = Math.round(245 + f * (232 - 245));
      g = Math.round(158 + f * (85 - 158));
      b = Math.round(11 + f * (24 - 11));
    }
    return `rgb(${r},${g},${b})`;
  };
  const textoCelda = (h) => (h && h / max > 0.45 ? "#FFF" : C.navy);

  const fmt = (iso) => {
    const d = aDate(iso);
    return {
      dia: String(d.getUTCDate()).padStart(2, "0"),
      mes: d.getUTCMonth(),
      anio: d.getUTCFullYear(),
      dow: DOW[d.getUTCDay()],
    };
  };

  // Header agrupado por mes.
  const headerMeses = useMemo(() => {
    const out = [];
    let cur = null;
    for (const iso of fechas) {
      const f = fmt(iso);
      const key = `${f.anio}-${f.mes}`;
      if (!cur || cur.key !== key) {
        cur = { key, label: `${MESES[f.mes]} ${f.anio}`, count: 1 };
        out.push(cur);
      } else {
        cur.count++;
      }
    }
    return out;
  }, [fechas]);

  // Helpers visuales internos.
  const Chip = ({ titulo, antes, despues, delta, mejor }) => {
    const color = delta === 0 ? C.txt3 : mejor ? C.ok : C.err;
    const arrow = delta === 0 ? "·" : delta > 0 ? "▲" : "▼";
    return (
      <div style={{ background: C.off, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 12px", minWidth: 130, flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.txt3 }}>{titulo}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.navy, lineHeight: 1 }}>{despues}</span>
          {delta !== 0 ? (
            <span style={{ fontSize: 11, fontWeight: 700, color }}>
              {arrow} {Math.abs(delta)} <span style={{ color: C.txt3, fontWeight: 600 }}>(antes {antes})</span>
            </span>
          ) : (
            <span style={{ fontSize: 11, color: C.txt3 }}>= antes</span>
          )}
        </div>
      </div>
    );
  };

  const deltaPico = +(indAsig.pico.horas - indBase.pico.horas).toFixed(1);
  const deltaDuros = indAsig.choquesDuros - indBase.choquesDuros;
  const deltaAdv = indAsig.advertencias - indBase.advertencias;

  return (
    <section style={{ ...font, marginTop: 26 }}>
      <div style={{ background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, boxShadow: "0 1px 4px rgba(30,58,95,0.06)", overflow: "hidden" }}>
        {/* Header plegable */}
        <div style={{ background: C.navy, padding: "12px 18px", color: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{ ...font, background: "none", border: "none", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}
          >
            Calendario de carga {expanded ? "▾" : "▸"}
          </button>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11.5, fontWeight: 600, color: "#FFF", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={ajustarPorComplejidad}
                onChange={(e) => setAjustarPorComplejidad(e.target.checked)}
                style={{ accentColor: C.celeste }}
              />
              Ajustar horas por complejidad (×C/3)
            </label>
            <span style={{ fontSize: 11, color: C.txt3 }}>
              {fechas.length} días hábiles · {eventosAsig.length} hitos
            </span>
          </div>
        </div>

        {expanded && (
          <div style={{ padding: "14px 18px" }}>
            {/* Indicadores antes/después */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip titulo="Pico (horas/día)" antes={`${indBase.pico.horas || 0}h`} despues={`${indAsig.pico.horas || 0}h`} delta={deltaPico} mejor={deltaPico < 0} />
              <Chip titulo="Choques duros" antes={indBase.choquesDuros} despues={indAsig.choquesDuros} delta={deltaDuros} mejor={deltaDuros < 0} />
              <Chip titulo="Advertencias (≤2d)" antes={indBase.advertencias} despues={indAsig.advertencias} delta={deltaAdv} mejor={deltaAdv < 0} />
              <div style={{ background: C.off, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 12px", minWidth: 200, flex: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.txt3 }}>Pico actual</div>
                {indAsig.pico.analista ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginTop: 4 }}>
                    {indAsig.pico.analista} · {indAsig.pico.fecha} ·{" "}
                    <span style={{ color: C.celeste }}>{indAsig.pico.horas}h</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.txt3, marginTop: 4 }}>Sin pico — cargá cut-offs en alguna liquidación.</div>
                )}
              </div>
            </div>

            {/* Advertencia: cut-offs default sin confirmar (cargados por el panel de carga rápida) */}
            {nSinConfirmar > 0 && (
              <div style={{ marginBottom: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.32)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "#7A5104" }}>
                ⚠ {nSinConfirmar} cut-off{nSinConfirmar === 1 ? "" : "s"} con fecha default sin confirmar: el pico y los choques incluyen fechas tentativas. Confirmalas en el panel «Carga de cut-offs».
              </div>
            )}

            {/* Heatmap */}
            {fechas.length === 0 ? (
              <div style={{ background: C.off, border: `1px dashed ${C.borde}`, borderRadius: 10, padding: "22px 14px", fontSize: 13, color: C.txt2, textAlign: "center" }}>
                Sin eventos generados — cargá cut-offs en el panel <strong>Carga de cut-offs</strong> de arriba (defaults, pegado desde Excel o fecha a fecha) para empezar.
              </div>
            ) : (
              <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, overflow: "auto", maxHeight: 540 }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 11, color: C.navy, width: "max-content", minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          position: "sticky", left: 0, top: 0, zIndex: 4, background: "#FFF",
                          borderBottom: `1px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`,
                          padding: "6px 10px", minWidth: 130, textAlign: "left",
                          fontSize: 10, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        }}
                      >
                        Analista
                      </th>
                      {headerMeses.map((m, i) => (
                        <th
                          key={i}
                          colSpan={m.count}
                          style={{
                            position: "sticky", top: 0, zIndex: 2, background: "#FFF",
                            borderBottom: `1px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`,
                            padding: "6px 4px", fontSize: 10, color: C.celeste, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.07em",
                          }}
                        >
                          {m.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th
                        style={{
                          position: "sticky", left: 0, top: 30, zIndex: 4, background: "#FFF",
                          borderBottom: `2px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`,
                        }}
                      />
                      {fechas.map((iso) => {
                        const f = fmt(iso);
                        return (
                          <th
                            key={iso}
                            style={{
                              position: "sticky", top: 30, zIndex: 2, background: "#FFF",
                              borderBottom: `2px solid ${C.borde}`,
                              padding: "4px 0", minWidth: 30, textAlign: "center", fontWeight: 700,
                            }}
                          >
                            <div style={{ fontSize: 11, color: C.navy }}>{f.dia}</div>
                            <div style={{ fontSize: 9, color: C.txt3, fontWeight: 600 }}>{f.dow}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <Fragment key={g.jef}>
                        <tr>
                          <td
                            style={{
                              position: "sticky", left: 0, zIndex: 1, background: C.off,
                              borderBottom: `1px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`,
                              padding: "4px 10px",
                              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.txt3,
                            }}
                          >
                            Jef. {g.jef}
                          </td>
                          <td colSpan={fechas.length} style={{ background: C.off, borderBottom: `1px solid ${C.borde}` }} />
                        </tr>
                        {g.analistas.map((a) => (
                          <tr key={a.nombre}>
                            <td
                              style={{
                                position: "sticky", left: 0, zIndex: 1, background: "#FFF",
                                borderBottom: `1px solid ${C.borde}`, borderRight: `1px solid ${C.borde}`,
                                padding: "4px 10px", fontWeight: 600, fontSize: 12,
                              }}
                            >
                              {a.nombre}
                            </td>
                            {fechas.map((iso) => {
                              const k = `${a.nombre}|${iso}`;
                              const horas = carga.porAnalista[a.nombre]?.[iso] || 0;
                              const ch = choquesMap[k];
                              const items = evPorCelda[k];
                              return (
                                <td
                                  key={iso}
                                  onClick={items ? (e) => setPopover({ analista: a.nombre, fecha: iso, items, x: e.clientX, y: e.clientY }) : undefined}
                                  title={horas > 0 ? `${a.nombre} · ${iso} · ${horas}h` : ""}
                                  style={{
                                    background: colorCelda(horas),
                                    color: textoCelda(horas),
                                    fontSize: 10.5, fontWeight: 700, textAlign: "center",
                                    minWidth: 30, height: 30,
                                    borderBottom: `1px solid ${C.borde}`,
                                    cursor: items ? "pointer" : "default",
                                    boxShadow:
                                      ch === "duro"
                                        ? `inset 0 0 0 2px ${C.err}`
                                        : ch === "advertencia"
                                        ? `inset 0 0 0 2px ${C.warn}`
                                        : undefined,
                                  }}
                                >
                                  {horas >= 1 ? Math.round(horas) : horas > 0 ? "·" : ""}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Leyenda */}
            <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: C.txt2, alignItems: "center" }}>
              <span>
                <span style={{ display: "inline-block", width: 12, height: 12, background: C.celeste, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Liviano
              </span>
              <span>
                <span style={{ display: "inline-block", width: 12, height: 12, background: C.warn, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Medio
              </span>
              <span>
                <span style={{ display: "inline-block", width: 12, height: 12, background: C.err, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Sobrecarga
              </span>
              <span>
                <span style={{ display: "inline-block", width: 12, height: 12, background: "#FFF", boxShadow: `inset 0 0 0 2px ${C.err}`, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Choque duro
              </span>
              <span>
                <span style={{ display: "inline-block", width: 12, height: 12, background: "#FFF", boxShadow: `inset 0 0 0 2px ${C.warn}`, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Advertencia (≤2d)
              </span>
              <span style={{ color: C.txt3 }}>★ hito crítico (cut-off / v1 / v2)</span>
            </div>
          </div>
        )}
      </div>

      {/* Popover de celda */}
      {popover && (
        <>
          <div onClick={() => setPopover(null)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div
            style={{
              position: "fixed",
              left: Math.min(popover.x + 8, (typeof window !== "undefined" ? window.innerWidth : 1200) - 340),
              top: Math.min(popover.y + 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 280),
              zIndex: 51,
              background: "#FFF",
              border: `1px solid ${C.borde}`,
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(15,33,51,0.25)",
              padding: "12px 14px",
              minWidth: 280,
              maxWidth: 340,
              ...font,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.celeste, marginBottom: 4 }}>
              {popover.analista} · {popover.fecha}
            </div>
            <div style={{ fontSize: 12, color: C.txt2, marginBottom: 8 }}>
              {popover.items.length} hito{popover.items.length === 1 ? "" : "s"} · {popover.items.reduce((s, x) => s + x.horas, 0).toFixed(1)}h total
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {popover.items.map((ev, i) => (
                <div key={i} style={{ background: C.off, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: C.navy }}>
                    {ev.clienteNombre} <span style={{ color: C.txt3, fontWeight: 600 }}>· {ev.liqEtiqueta}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: C.txt2 }}>
                    <span>
                      {ev.instancia}
                      {ev.critico ? " ★" : ""}
                    </span>
                    <span style={{ color: C.celeste, fontWeight: 700 }}>{ev.horas}h</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPopover(null)}
              style={{ ...font, marginTop: 10, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "5px 14px", fontSize: 11, fontWeight: 600, color: C.txt2, cursor: "pointer", display: "block", marginLeft: "auto" }}
            >
              Cerrar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
