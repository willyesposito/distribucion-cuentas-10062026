// src/ciclos.js — Motor de ciclos de liquidación (funciones puras, sin React).
// Genera eventos fechados a partir de: cut-off del cliente + cadena de instancias
// (configClientes) + feriados AR. Calcula carga diaria en HORAS, choques e indicadores.
//
// Fuentes:
//  - Horas default por etapa: valores reales de PO Pilar, board fuente 8179343211,
//    columna n_meros__1 (confirmado por el usuario como esfuerzo en horas, estándar).
//  - Feriados: feriados-ar.json (provisto por el usuario, 10/06/2026).
//  - Regla de choques: CLAUDE.md → 2+ hitos críticos mismo día (duro) o a ≤2 días
//    hábiles (advertencia), por analista.

// ---------- Días hábiles ----------

/** "YYYY-MM-DD" → Date UTC (evita corrimientos de timezone). */
export const aDate = (iso) => new Date(`${iso}T00:00:00Z`);
export const aISO = (d) => d.toISOString().slice(0, 10);

export function esHabil(iso, feriadosSet) {
  const dow = aDate(iso).getUTCDay(); // 0 dom, 6 sáb
  return dow !== 0 && dow !== 6 && !feriadosSet.has(iso);
}

/** Suma n días hábiles (n entero ≥ 0) a una fecha ISO. n=0 devuelve la misma fecha
 *  (o el hábil siguiente si la fecha cae en feriado/finde). */
export function sumarHabiles(iso, n, feriadosSet) {
  let d = aDate(iso);
  // normalizar el punto de partida a día hábil
  while (!esHabil(aISO(d), feriadosSet)) d = new Date(d.getTime() + 86400000);
  let restan = Math.max(0, Math.round(n));
  while (restan > 0) {
    d = new Date(d.getTime() + 86400000);
    if (esHabil(aISO(d), feriadosSet)) restan--;
  }
  return aISO(d);
}

/** Días hábiles entre dos ISO (a < b), exclusivo del inicio, inclusivo del fin. */
export function habilesEntre(isoA, isoB, feriadosSet) {
  if (isoA === isoB) return 0;
  let [ini, fin, signo] = isoA < isoB ? [isoA, isoB, 1] : [isoB, isoA, -1];
  let d = aDate(ini), count = 0;
  while (aISO(d) < fin) {
    d = new Date(d.getTime() + 86400000);
    if (esHabil(aISO(d), feriadosSet)) count++;
  }
  return count * signo;
}

// ---------- Horas de esfuerzo ----------

// Default por etapa. Fuente: PO Pilar (8179343211, n_meros__1), ciclo junio 2026.
// Mensual: Recepción Novedades 1 · Envío v1 6 · Comentarios 3 · v2 6 · Aprobación 2.
// Quincenal: Novedades 1 · Envío 3 · Comentarios 2 · Aprobación 1.
export const HORAS_DEFAULT_MENSUAL = { "cut off": 1, "v1": 6, "comentarios v1": 3, "v2": 6, "aprobación": 2 };
export const HORAS_DEFAULT_QUINCENA = { "cut off": 1, "v1": 3, "comentarios v1": 2, "v2": 3, "aprobación": 1 };
const HORAS_FALLBACK = 1;

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const lookupHoras = (tabla, nombre) => {
  const n = norm(nombre);
  for (const [k, v] of Object.entries(tabla)) if (norm(k) === n) return v;
  return HORAS_FALLBACK;
};

/** Factor por complejidad del cliente: C3 = 1.0x (neutro), C1 ≈ 0.33x, C5 ≈ 1.67x. */
export const factorComplejidad = (complejidad) => (complejidad || 3) / 3;

// ---------- Generación de eventos ----------

const esQuincena = (etiqueta) => /quincena|1q|2q/i.test(etiqueta || "");
/** Hitos críticos para choques: cut-offs y envíos de liquidación (v1/v2). */
export const esCritico = (nombreInstancia) => /cut ?off|^v1$|^v2$|env[ií]o/i.test(norm(nombreInstancia));

/**
 * Genera los eventos fechados de UN cliente.
 * @param cliente   {id, nombre, complejidad}
 * @param cfg       configClientes[cliente.id] → {tipoLiq, liquidaciones:[{id, etiqueta, instancias:[{id, nombre, slaHabiles, horas?}]}]}
 * @param cutoffs   {[liqId]: "YYYY-MM-DD"} — fecha de cut-off por liquidación (manual o traída de Monday)
 * @param feriadosSet Set<string ISO>
 * @param opts      {ajustarPorComplejidad?: boolean, horasMensual?, horasQuincena?}
 * @returns eventos [{clienteId, clienteNombre, complejidad, liqId, liqEtiqueta, instId, instancia, fecha, horas, critico, generado:true}]
 *          Las liquidaciones SIN cut-off cargado no generan eventos (reportarlas como pendientes).
 */
export function generarEventosCliente(cliente, cfg, cutoffs, feriadosSet, opts = {}) {
  const { ajustarPorComplejidad = false, horasMensual = HORAS_DEFAULT_MENSUAL, horasQuincena = HORAS_DEFAULT_QUINCENA } = opts;
  const eventos = [];
  if (!cfg) return eventos;
  const factor = ajustarPorComplejidad ? factorComplejidad(cliente.complejidad) : 1;

  for (const liq of cfg.liquidaciones || []) {
    const cutoff = cutoffs?.[liq.id];
    if (!cutoff) continue; // sin ancla, no se puede fechar → pendiente
    const tabla = esQuincena(liq.etiqueta) ? horasQuincena : horasMensual;
    let fecha = sumarHabiles(cutoff, 0, feriadosSet); // cut-off normalizado a hábil
    liq.instancias.forEach((inst, idx) => {
      if (idx > 0) fecha = sumarHabiles(fecha, inst.slaHabiles || 0, feriadosSet);
      const horasBase = inst.horas ?? lookupHoras(tabla, inst.nombre);
      eventos.push({
        clienteId: cliente.id, clienteNombre: cliente.nombre, complejidad: cliente.complejidad,
        liqId: liq.id, liqEtiqueta: liq.etiqueta, instId: inst.id, instancia: inst.nombre,
        fecha, horas: +(horasBase * factor).toFixed(2), critico: esCritico(inst.nombre), generado: true,
      });
    });
  }
  return eventos;
}

/** Liquidaciones de un cliente que NO tienen cut-off cargado (para el panel de pendientes). */
export function liquidacionesSinCutoff(cfg, cutoffs) {
  return (cfg?.liquidaciones || []).filter((l) => !cutoffs?.[l.id]).map((l) => l.etiqueta);
}

// ---------- Carga diaria, choques e indicadores ----------

/**
 * Agrupa eventos YA resueltos a un analista (la UI resuelve asignación y reparto de
 * equipo, p. ej. Toyota → Franco/Eileen/Laura con horas/3) en una matriz de carga.
 * @param eventosConAnalista [{...evento, analista, horas}]
 * @returns { porAnalista: {analista: {fechaISO: horas}}, fechas: [ISO ordenadas], maxHorasDia }
 */
export function cargaDiaria(eventosConAnalista) {
  const porAnalista = {};
  const fechasSet = new Set();
  for (const e of eventosConAnalista) {
    fechasSet.add(e.fecha);
    porAnalista[e.analista] ??= {};
    porAnalista[e.analista][e.fecha] = +((porAnalista[e.analista][e.fecha] || 0) + e.horas).toFixed(2);
  }
  const fechas = [...fechasSet].sort();
  let maxHorasDia = 0;
  for (const dias of Object.values(porAnalista))
    for (const h of Object.values(dias)) maxHorasDia = Math.max(maxHorasDia, h);
  return { porAnalista, fechas, maxHorasDia };
}

/**
 * Choques por analista sobre hitos críticos de CLIENTES DISTINTOS:
 *  - "duro": 2+ críticos el mismo día.
 *  - "advertencia": críticos a ≤ventana días hábiles (default 2).
 */
export function detectarChoques(eventosConAnalista, feriadosSet, ventana = 2) {
  const choques = [];
  const porAnalista = {};
  for (const e of eventosConAnalista) {
    if (!e.critico) continue;
    (porAnalista[e.analista] ??= []).push(e);
  }
  for (const [analista, evs] of Object.entries(porAnalista)) {
    evs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const a = evs[i], b = evs[j];
        if (a.clienteId === b.clienteId) continue;
        const dist = Math.abs(habilesEntre(a.fecha, b.fecha, feriadosSet));
        if (dist > ventana) { if (b.fecha > a.fecha) break; else continue; }
        choques.push({ analista, tipo: dist === 0 ? "duro" : "advertencia", distHabiles: dist, eventos: [a, b] });
      }
    }
  }
  return choques;
}

/** Indicadores de escenario para el comparador antes/después. */
export function indicadores(eventosConAnalista, feriadosSet, scoresArray) {
  const { porAnalista, maxHorasDia } = cargaDiaria(eventosConAnalista);
  let pico = { analista: null, fecha: null, horas: 0 };
  for (const [analista, dias] of Object.entries(porAnalista))
    for (const [fecha, horas] of Object.entries(dias))
      if (horas > pico.horas) pico = { analista, fecha, horas };
  const choques = detectarChoques(eventosConAnalista, feriadosSet);
  const duros = choques.filter((c) => c.tipo === "duro").length;
  const advertencias = choques.length - duros;
  let desvio = 0;
  if (scoresArray?.length) {
    const m = scoresArray.reduce((s, x) => s + x, 0) / scoresArray.length;
    desvio = Math.sqrt(scoresArray.reduce((s, x) => s + (x - m) ** 2, 0) / scoresArray.length);
  }
  return { pico, choquesDuros: duros, advertencias, desvioScores: +desvio.toFixed(1), maxHorasDia };
}
