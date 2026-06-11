import { useState, useMemo } from "react";
import HeatmapCarga from "./HeatmapCarga.jsx";
import PanelCutoffs from "./PanelCutoffs.jsx";
import feriadosData from "../data/feriados-ar.json";

const FERIADOS = new Set(feriadosData.feriados);
const STORAGE_KEY = "reorg:escenarios";

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
  { id: "6682992697", nombre: "AYSA (Externos)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 1, pays: 2, tipo: "Quincenal" },
  { id: "6683370671", nombre: "Ford (Externos)", consultor: "Agustina C.", jefatura: "Melina", complejidad: 1, pays: 18, tipo: "Quincenal" },
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

const BASE_ASIGNACION = Object.fromEntries(CLIENTES.map(c => [c.id, c.consultor]));

const VALIDACIONES = [
  "Toyota tiene 8.000 pays (vs. 623 del segundo más alto): domina la normalización de Pays. Usá el toggle para excluirlo del cálculo y comparar.",
  "Toyota se modela como equipo Franco + Eileen + Laura: la carga del cliente se reparte 1/3 entre los tres mientras esté asignado a Franco. Si lo movés a otro analista, todo va al destino.",
  "10 clientes sin Tipo de Liquidación en Monday (tipo vacío): arrancan como Mensual por default. AYSA y Ford identificados como quincenales. Ajustá en el panel de cada cliente.",
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

// IDs de liquidación determinísticos (clienteId:tipo): los cut-offs se guardan
// keyed por liq.id, así que con IDs estables sobreviven a regeneraciones del tipo
// de liquidación y sirven de clave para el import por Excel y los escenarios.
function genLiquidaciones(clienteId, tipo, slaQ) {
  const liqs = [];
  if (tipo === "mensual" || tipo === "ambos") {
    liqs.push({ id: `${clienteId}:mensual`, etiqueta: "Mensual", instancias: INSTANCIAS_MENSUAL() });
  }
  if (tipo === "quincenal" || tipo === "ambos") {
    liqs.push({ id: `${clienteId}:q1`, etiqueta: "Quincena 1", instancias: INSTANCIAS_QUINCENA(slaQ) });
    liqs.push({ id: `${clienteId}:q2`, etiqueta: "Quincena 2", instancias: INSTANCIAS_QUINCENA(slaQ) });
  }
  return liqs;
}

// tipo null/vacío → "mensual" (default para clientes sin dato en Monday).
function inferirTipo(tipoTexto) {
  if (!tipoTexto) return "mensual";
  const t = tipoTexto.toLowerCase();
  if (t.includes("mixto")) return "ambos";
  const tieneM = t.includes("mensual");
  const tieneQ = t.includes("quincen") || t.includes("1q") || t.includes("2q");
  if (tieneM && tieneQ) return "ambos";
  if (tieneQ) return "quincenal";
  if (tieneM) return "mensual";
  return "mensual";
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

const BTN_BASE = { ...font, cursor: "pointer", border: `1px solid ${C.borde}`, background: "#FFF", color: C.navy, borderRadius: 9999, padding: "7px 16px", fontSize: 12, fontWeight: 600 };

const loadEscenarios = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};

export default function SimuladorReorg() {
  // pesos crudos 0-100; se normalizan al calcular
  const [pesos, setPesos] = useState({ comp: 40, cant: 35, pays: 25 });
  const [excluirToyota, setExcluirToyota] = useState(true);
  const [asignacion, setAsignacion] = useState(() => Object.fromEntries(CLIENTES.map(c => [c.id, c.consultor])));
  const [seleccionado, setSeleccionado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [verValidacion, setVerValidacion] = useState(true);
  const [verAyuda, setVerAyuda] = useState(false);
  const [analistasExcluidos, setAnalistasExcluidos] = useState(() => new Set());
  const [verAnalistas, setVerAnalistas] = useState(false);
  const [slaQuincena, setSlaQuincena] = useState(1);
  const [cutoffs, setCutoffs] = useState({});
  const [cutoffsEstado, setCutoffsEstado] = useState({});
  const [ajustarPorComplejidad, setAjustarPorComplejidad] = useState(false);
  const [configClientes, setConfigClientes] = useState(() => {
    return Object.fromEntries(CLIENTES.map(c => {
      const tipoLiq = inferirTipo(c.tipo);
      return [c.id, { tipoLiq, liquidaciones: genLiquidaciones(c.id, tipoLiq, 1) }];
    }));
  });

  // Overrides de sesión: complejidad y pays editables por cliente (no persisten a Monday).
  const [overrides, setOverrides] = useState({});
  const getComp = (c) => overrides[c.id]?.complejidad ?? c.complejidad;
  const getPays = (c) => overrides[c.id]?.pays ?? c.pays;
  const setOverride = (clienteId, campo, valor) => {
    setOverrides(prev => ({ ...prev, [clienteId]: { ...(prev[clienteId] || {}), [campo]: valor } }));
  };

  // Drag-and-drop: chip → tarjeta de analista
  const [dragCliente, setDragCliente] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Escenarios guardados (localStorage)
  const [escenarios, setEscenarios] = useState(loadEscenarios);
  const [escenarioNombre, setEscenarioNombre] = useState("");
  const [escenarioActual, setEscenarioActual] = useState(null);
  const [verEscenarios, setVerEscenarios] = useState(false);

  const incluidos = useMemo(() => CLIENTES.filter(c => !(excluirToyota && c.distorsiona)), [excluirToyota]);

  const nSinConfirmar = useMemo(() => {
    const vigentes = new Set();
    for (const c of incluidos) for (const l of (configClientes[c.id]?.liquidaciones || [])) vigentes.add(l.id);
    return Object.entries(cutoffsEstado).filter(([id, e]) => e === "default" && cutoffs[id] && vigentes.has(id)).length;
  }, [incluidos, configClientes, cutoffsEstado, cutoffs]);

  const analistasVisibles = useMemo(
    () => ANALISTAS.filter(a => !analistasExcluidos.has(a.nombre)),
    [analistasExcluidos]
  );
  const nombresVisibles = useMemo(() => new Set(analistasVisibles.map(a => a.nombre)), [analistasVisibles]);

  const sumaPesos = pesos.comp + pesos.cant + pesos.pays || 1;
  const w = { comp: pesos.comp / sumaPesos, cant: pesos.cant / sumaPesos, pays: pesos.pays / sumaPesos };

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
        m[nom].comp += getComp(c) / div;
        m[nom].pays += getPays(c) / div;
      });
    });
    return m;
  };

  const { scores, baseScores, media } = useMemo(() => {
    const base = cargaPor(BASE_ASIGNACION);
    const cur = cargaPor(asignacion);
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
  }, [asignacion, w.comp, w.cant, w.pays, incluidos, analistasVisibles, overrides]);

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
  const reiniciar = () => {
    setAsignacion(BASE_ASIGNACION);
    setSeleccionado(null);
    setOverrides({});
    setEscenarioActual(null);
  };

  // ---- Cut-offs ----
  const setCutoff = (liqId, isoFecha, estado = "confirmado") => {
    setCutoffs(prev => {
      if (!isoFecha) { const { [liqId]: _, ...rest } = prev; return rest; }
      return { ...prev, [liqId]: isoFecha };
    });
    setCutoffsEstado(prev => {
      if (!isoFecha) { const { [liqId]: _, ...rest } = prev; return rest; }
      return { ...prev, [liqId]: estado };
    });
  };
  const confirmarCutoff = (liqId) => setCutoffsEstado(prev => (prev[liqId] ? { ...prev, [liqId]: "confirmado" } : prev));
  const aplicarCutoffsLote = (entradas, estado) => {
    if (!entradas || Object.keys(entradas).length === 0) return;
    setCutoffs(prev => ({ ...prev, ...entradas }));
    setCutoffsEstado(prev => {
      const next = { ...prev };
      for (const id of Object.keys(entradas)) next[id] = estado;
      return next;
    });
  };

  const podarCutoffsHuerfanos = (clienteId, nuevasLiqs) => {
    const validos = new Set(nuevasLiqs.map(l => l.id));
    const esHuerfano = (id) => id.startsWith(`${clienteId}:`) && !validos.has(id);
    const podar = (obj) => {
      let cambio = false;
      const next = {};
      for (const [k, v] of Object.entries(obj)) { if (esHuerfano(k)) cambio = true; else next[k] = v; }
      return cambio ? next : obj;
    };
    setCutoffs(prev => podar(prev));
    setCutoffsEstado(prev => podar(prev));
  };

  // ---- Liquidaciones ----
  const setTipoLiqCliente = (clienteId, nuevoTipo) => {
    const nuevas = genLiquidaciones(clienteId, nuevoTipo, slaQuincena);
    podarCutoffsHuerfanos(clienteId, nuevas);
    setConfigClientes(prev => ({ ...prev, [clienteId]: { tipoLiq: nuevoTipo, liquidaciones: nuevas } }));
  };
  const regenerarDefault = (clienteId) => {
    const tipoLiq = configClientes[clienteId]?.tipoLiq || "mensual";
    const nuevas = genLiquidaciones(clienteId, tipoLiq, slaQuincena);
    podarCutoffsHuerfanos(clienteId, nuevas);
    setConfigClientes(prev => ({ ...prev, [clienteId]: { tipoLiq, liquidaciones: nuevas } }));
  };
  const editarInstancia = (clienteId, liqId, instId, campo, valor) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l, instancias: l.instancias.map(i => i.id !== instId ? i : ({ ...i, [campo]: valor })),
      }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const eliminarInstancia = (clienteId, liqId, instId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l, instancias: l.instancias.filter(i => i.id !== instId),
      }));
      return { ...prev, [clienteId]: { ...cfg, liquidaciones } };
    });
  };
  const agregarInstancia = (clienteId, liqId) => {
    setConfigClientes(prev => {
      const cfg = prev[clienteId];
      if (!cfg) return prev;
      const liquidaciones = cfg.liquidaciones.map(l => l.id !== liqId ? l : ({
        ...l, instancias: [...l.instancias, { id: rid(), nombre: "Nueva etapa", slaHabiles: 1 }],
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
    setCutoff(liqId, "");
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
      const usados = cfg.liquidaciones.map(l => { const m = /:extra-(\d+)$/.exec(String(l.id)); return m ? +m[1] : 0; });
      const nueva = { id: `${clienteId}:extra-${Math.max(0, ...usados) + 1}`, etiqueta: "Liquidación adicional", instancias: INSTANCIAS_MENSUAL() };
      return { ...prev, [clienteId]: { ...cfg, liquidaciones: [...cfg.liquidaciones, nueva] } };
    });
  };

  // ---- Analistas ----
  const toggleExcluido = (nombre) => {
    setAnalistasExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
      return next;
    });
  };
  const incluirTodos = () => setAnalistasExcluidos(new Set());

  // ---- Escenarios ----
  const guardarEscenario = (nombre) => {
    const nuevo = {
      nombre,
      creado: new Date().toLocaleString("es-AR"),
      asignacion: { ...asignacion },
      configClientes,
      cutoffs: { ...cutoffs },
      cutoffsEstado: { ...cutoffsEstado },
      pesos: { ...pesos },
      excluirToyota,
      analistasExcluidos: [...analistasExcluidos],
      ajustarPorComplejidad,
      overrides: { ...overrides },
      slaQuincena,
    };
    const arr = [nuevo, ...escenarios.filter(e => e.nombre !== nombre)];
    setEscenarios(arr);
    setEscenarioActual(nombre);
    setEscenarioNombre("");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {}
  };

  const cargarEscenario = (nombre) => {
    const esc = escenarios.find(e => e.nombre === nombre);
    if (!esc) return;
    setAsignacion(esc.asignacion);
    setConfigClientes(esc.configClientes);
    setCutoffs(esc.cutoffs || {});
    setCutoffsEstado(esc.cutoffsEstado || {});
    setPesos(esc.pesos);
    setExcluirToyota(esc.excluirToyota);
    setAnalistasExcluidos(new Set(esc.analistasExcluidos || []));
    setAjustarPorComplejidad(esc.ajustarPorComplejidad || false);
    setOverrides(esc.overrides || {});
    setSlaQuincena(esc.slaQuincena ?? 1);
    setEscenarioActual(nombre);
    setSeleccionado(null);
  };

  const eliminarEscenario = (nombre) => {
    const arr = escenarios.filter(e => e.nombre !== nombre);
    setEscenarios(arr);
    if (escenarioActual === nombre) setEscenarioActual(null);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {}
  };

  const exportarEscenarios = () => {
    const blob = new Blob([JSON.stringify(escenarios, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "escenarios-reorg.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importarEscenarios = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const arr = JSON.parse(ev.target.result);
        if (!Array.isArray(arr)) throw new Error();
        setEscenarios(arr);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      } catch { alert("El archivo no es válido."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---- Plan de cambios ----
  const planTexto = useMemo(() => {
    const fecha = new Date().toLocaleDateString("es-AR");
    const lineas = cambios.map((m, i) => `${i + 1}. ${m.cliente}: ${m.de} (Jef. ${m.jefDe}) → ${m.a} (Jef. ${m.jefA})${m.cambiaJef ? "  [CAMBIA JEFATURA]" : ""}`);
    const csv = ["cliente,analista_origen,jefatura_origen,analista_destino,jefatura_destino", ...cambios.map(m => `"${m.cliente}",${m.de},${m.jefDe},${m.a},${m.jefA}`)].join("\n");
    return `PLAN DE CAMBIOS — generado ${fecha} sobre snapshot Matrix del ${SNAPSHOT_DATE}\nAplicar a mano en Monday (board 6552205482, columnas consultor2__1 y color_mkpexfx8).\n\n${lineas.join("\n")}\n\n--- CSV ---\n${csv}`;
  }, [cambios]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(planTexto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { /* el textarea de abajo permite seleccionar todo */ }
  };

  const clienteSel = seleccionado ? CLIENTES.find(c => c.id === seleccionado) : null;
  const cfgSel = clienteSel ? configClientes[clienteSel.id] : null;

  const slider = (key, label) => (
    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150, flex: 1 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.navy }}>
        {label}
        <input type="number" min="0" max="100" value={pesos[key]}
          onChange={e => setPesos(p => ({ ...p, [key]: Math.max(0, Math.min(100, Math.round(+e.target.value || 0))) }))}
          style={{ ...font, width: 52, padding: "3px 6px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 12, fontWeight: 700, color: C.navy }}
        />
        <span style={{ color: C.celeste, fontWeight: 700 }}>= {Math.round(100 * pesos[key] / sumaPesos)}%</span>
      </span>
      <input type="range" min="0" max="100" value={pesos[key]} onChange={e => setPesos(p => ({ ...p, [key]: +e.target.value }))} style={{ accentColor: C.celeste }} />
    </label>
  );

  const sinAsignar = scores["Sin asignar"] || { n: 0, comp: 0, pays: 0, score: 0 };
  const clientesSinAsignar = incluidos.filter(c => !nombresVisibles.has(asignacion[c.id]));

  // Chip de cliente: draggable, seleccionable por click
  const chipCliente = (c, { movido, sel, tieneEquipo, esEquipo, lider }) => {
    const estilo = {
      ...font, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 9999,
      background: sel ? C.celeste : esEquipo ? "rgba(140,131,123,0.10)" : movido ? "rgba(0,172,212,0.12)" : C.off,
      color: sel ? "#FFF" : esEquipo ? C.txt2 : C.navy,
      border: sel ? `1px solid ${C.celesteDark}` : esEquipo ? `1px dashed ${C.borde}` : movido ? "1px solid rgba(0,172,212,0.45)" : `1px solid ${C.borde}`,
      fontStyle: esEquipo ? "italic" : "normal",
      opacity: dragCliente && dragCliente !== c.id ? 0.7 : 1,
    };
    const titulo = esEquipo
      ? `Apoyo del equipo · Líder: ${lider} · Complejidad ${getComp(c)} · ${getPays(c)} pays`
      : `Complejidad ${getComp(c)} · ${getPays(c)} pays · ${c.tipo || "tipo s/d"}${movido ? ` · venía de ${c.consultor}` : ""}${tieneEquipo ? ` · equipo: ${[c.consultor, ...c.equipo].join(", ")}` : ""}`;
    return (
      <button
        key={esEquipo ? `eq-${c.id}` : c.id}
        draggable={!esEquipo}
        onDragStart={!esEquipo ? (e) => { e.dataTransfer.effectAllowed = "move"; setDragCliente(c.id); } : undefined}
        onDragEnd={!esEquipo ? () => { setDragCliente(null); setDragOver(null); } : undefined}
        onClick={() => setSeleccionado(sel ? null : c.id)}
        title={titulo}
        style={estilo}
      >
        {c.nombre} <span style={{ opacity: 0.65 }}>·C{getComp(c)}</span>
        {tieneEquipo && " 👥"}{movido && " ↩"}{esEquipo && ` ·equipo de ${lider}`}
      </button>
    );
  };

  return (
    <div style={{ ...font, background: C.off, minHeight: "100vh", color: C.navy }}>
      {/* Header */}
      <header style={{ background: C.navyDeep, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.celeste, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 700, fontSize: 16, letterSpacing: "-0.5px", fontStyle: "italic" }}>H&A</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#FFF" }}>Simulador de Reorganización — Payroll</h1>
          <div style={{ fontSize: 12, color: C.txt3 }}>Sandbox de reasignaciones · nunca escribe en Monday · click o arrastrá chips para mover · escenarios persistentes</div>
        </div>
        <Badge color={C.celeste}>Snapshot Matrix · {SNAPSHOT_DATE}</Badge>
        {escenarioActual && <Badge color={C.ok}>Escenario: {escenarioActual}</Badge>}
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 20px 60px" }}>

        {/* Cómo usar */}
        <section style={{ marginBottom: 14, background: "rgba(0,172,212,0.06)", border: `1px solid rgba(0,172,212,0.22)`, borderRadius: 14, padding: "11px 18px" }}>
          <button onClick={() => setVerAyuda(v => !v)} style={{ ...font, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: C.celesteDark, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Cómo usar {verAyuda ? "▾" : "▸"}
          </button>
          {verAyuda && (
            <ol style={{ margin: "10px 0 2px", paddingLeft: 20, fontSize: 12.5, color: C.txt2, lineHeight: 1.7 }}>
              <li><strong>Mover clientes:</strong> hacé click en un chip para seleccionarlo y elegí el analista destino en la barra flotante. También podés arrastrarlo directo a otra tarjeta de analista.</li>
              <li><strong>Score de carga:</strong> cada analista tiene un puntaje basado en complejidad, cantidad de clientes y pays (pesos ajustables en la sección de arriba). Verde = equilibrado · Celeste = subcargado · Rojo = sobrecargado.</li>
              <li><strong>Editar complejidad / pays:</strong> cuando seleccionás un cliente, la barra flotante muestra campos C: y Pays: editables. Son overrides de sesión: afectan el score y el heatmap, pero no se graban en Monday.</li>
              <li><strong>Cut-offs y heatmap:</strong> en el panel "Carga de cut-offs" definís las fechas de inicio de cada ciclo; el heatmap muestra la carga diaria resultante y detecta choques duros (borde rojo) y advertencias (borde punteado).</li>
              <li><strong>Escenarios:</strong> dale un nombre al estado actual y guardalo para comparar distintas reorganizaciones. Se persisten en el navegador (localStorage). Exportá/importá como JSON para compartir.</li>
              <li><strong>Plan de cambios:</strong> al final de la página se genera la lista de movimientos para aplicar a mano en Monday (board 6552205482, columnas consultor2__1 / color_mkpexfx8).</li>
            </ol>
          )}
        </section>

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
            <button onClick={reiniciar} style={{ ...font, ...BTN_BASE }}>
              Reiniciar escenario
            </button>
          </div>
        </section>

        {/* Escenarios guardados */}
        <section style={{ marginTop: 14, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 14, padding: "12px 18px", boxShadow: "0 1px 4px rgba(30,58,95,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setVerEscenarios(v => !v)} style={{ ...font, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: C.celeste, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Escenarios ({escenarios.length}) {verEscenarios ? "▾" : "▸"}
            </button>
            {/* Guardar rápido */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 240 }}>
              <input
                value={escenarioNombre}
                onChange={e => setEscenarioNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && escenarioNombre.trim() && guardarEscenario(escenarioNombre.trim())}
                placeholder="Nombre del escenario…"
                style={{ ...font, flex: 1, padding: "6px 10px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12, color: C.navy }}
              />
              <button
                onClick={() => escenarioNombre.trim() && guardarEscenario(escenarioNombre.trim())}
                disabled={!escenarioNombre.trim()}
                style={{ ...font, background: C.navy, color: "#FFF", border: "none", borderRadius: 9999, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: escenarioNombre.trim() ? "pointer" : "default", opacity: escenarioNombre.trim() ? 1 : 0.4 }}
              >
                Guardar
              </button>
            </div>
            <button onClick={exportarEscenarios} style={{ ...font, ...BTN_BASE, fontSize: 11 }}>Exportar JSON</button>
            <label style={{ ...font, ...BTN_BASE, fontSize: 11, cursor: "pointer" }}>
              Importar JSON
              <input type="file" accept=".json" onChange={importarEscenarios} style={{ display: "none" }} />
            </label>
          </div>
          {verEscenarios && (
            <div style={{ marginTop: 12 }}>
              {escenarios.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.txt3, padding: "6px 0" }}>No hay escenarios guardados todavía.</div>
              )}
              {escenarios.map(e => (
                <div key={e.nombre} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.borde}` }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.navy }}>{e.nombre}</span>
                  <span style={{ fontSize: 11, color: C.txt3, minWidth: 120 }}>{e.creado}</span>
                  <button onClick={() => cargarEscenario(e.nombre)} style={{ ...font, background: e.nombre === escenarioActual ? C.celeste : C.off, color: e.nombre === escenarioActual ? "#FFF" : C.navy, border: `1px solid ${e.nombre === escenarioActual ? C.celesteDark : C.borde}`, borderRadius: 9999, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {e.nombre === escenarioActual ? "Activo" : "Cargar"}
                  </button>
                  <button onClick={() => eliminarEscenario(e.nombre)} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: C.err, cursor: "pointer" }}>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
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
            Notas de datos ({VALIDACIONES.length}) {verValidacion ? "▾" : "▸"}
          </button>
          {verValidacion && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#7A5104", lineHeight: 1.55 }}>
              {VALIDACIONES.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
        </section>

        {/* Panel flotante: Mover + Liquidaciones (sticky) */}
        {clienteSel && (
          <section style={{ position: "sticky", top: 8, zIndex: 20, marginTop: 14, borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(15,33,51,0.38)", border: `1px solid rgba(15,33,51,0.18)` }}>
            {/* Barra superior: mover + overrides */}
            <div style={{ background: C.navy, color: "#FFF", padding: "11px 18px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>Mover <strong>{clienteSel.nombre}</strong> (hoy: {asignacion[clienteSel.id]}) a:</span>
              <select key={clienteSel.id} defaultValue="" onChange={e => e.target.value && mover(clienteSel.id, e.target.value)}
                style={{ ...font, padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 13, color: C.navy }}>
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
              {/* Override complejidad */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                C:
                <input type="number" min="1" max="5" value={getComp(clienteSel)}
                  onChange={e => setOverride(clienteSel.id, "complejidad", Math.max(1, Math.min(5, +e.target.value || 1)))}
                  style={{ ...font, width: 46, padding: "4px 6px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, color: C.navy, textAlign: "center" }}
                />
                {overrides[clienteSel.id]?.complejidad !== undefined && (
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>(base {clienteSel.complejidad})</span>
                )}
              </label>
              {/* Override pays */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                Pays:
                <input type="number" min="0" value={getPays(clienteSel)}
                  onChange={e => setOverride(clienteSel.id, "pays", Math.max(0, +e.target.value || 0))}
                  style={{ ...font, width: 72, padding: "4px 6px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, color: C.navy, textAlign: "center" }}
                />
                {overrides[clienteSel.id]?.pays !== undefined && (
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>(base {clienteSel.pays})</span>
                )}
              </label>
              {(overrides[clienteSel.id]?.complejidad !== undefined || overrides[clienteSel.id]?.pays !== undefined) && (
                <button onClick={() => setOverrides(prev => { const { [clienteSel.id]: _, ...rest } = prev; return rest; })}
                  style={{ ...font, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 9999, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                  Restablecer
                </button>
              )}
              <button onClick={() => setSeleccionado(null)}
                style={{ ...font, marginLeft: "auto", background: "rgba(255,255,255,0.12)", color: "#FFF", border: "none", borderRadius: 9999, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>

            {/* Cuerpo: Liquidaciones (scrollable) */}
            {cfgSel && (
              <div style={{ background: "#FFF", color: C.navy, maxHeight: "44vh", overflowY: "auto", padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  <SectionLabel>Liquidaciones de {clienteSel.nombre}</SectionLabel>
                  <button onClick={() => regenerarDefault(clienteSel.id)} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "5px 14px", fontSize: 11, fontWeight: 600, color: C.txt2, cursor: "pointer" }}>
                    ⟳ Restaurar default
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {[
                    { v: "ninguno", l: "Sin liquidación regular" },
                    { v: "mensual", l: "Mensual" },
                    { v: "quincenal", l: "Quincenal" },
                    { v: "ambos", l: "Ambos (Mensual + Quincenas)" },
                  ].map(o => {
                    const activo = cfgSel.tipoLiq === o.v;
                    return (
                      <button key={o.v} onClick={() => setTipoLiqCliente(clienteSel.id, o.v)} style={{ ...font, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 9999, background: activo ? C.celeste : "#FFF", color: activo ? "#FFF" : C.navy, border: `1px solid ${activo ? C.celesteDark : C.borde}` }}>
                        {o.l}
                      </button>
                    );
                  })}
                </div>
                {cfgSel.liquidaciones.length === 0 && (
                  <div style={{ fontSize: 12.5, color: C.txt3, padding: "10px 0" }}>Sin liquidaciones definidas. Elegí un tipo o agregá una manualmente.</div>
                )}
                {cfgSel.liquidaciones.map(liq => (
                  <div key={liq.id} style={{ marginBottom: 12, padding: "10px 12px", background: C.off, borderRadius: 10, border: `1px solid ${C.borde}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <input value={liq.etiqueta} onChange={e => renombrarLiquidacion(clienteSel.id, liq.id, e.target.value)} style={{ ...font, fontSize: 13, fontWeight: 700, color: C.navy, border: "none", background: "transparent", borderBottom: `1px dashed ${C.borde}`, padding: "2px 4px", flex: 1, minWidth: 140 }} />
                      <label title="Fecha del corte de novedades" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: C.txt2 }}>
                        <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, color: C.celeste }}>Cut Off</span>
                        <input type="date" value={cutoffs[liq.id] || ""} onChange={e => setCutoff(liq.id, e.target.value)} style={{ ...font, padding: "3px 6px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 12, color: C.navy }} />
                        {cutoffs[liq.id] && (
                          <button onClick={() => setCutoff(liq.id, "")} style={{ ...font, background: "none", border: "none", color: C.txt3, cursor: "pointer", fontSize: 13, padding: "0 4px", lineHeight: 1 }}>×</button>
                        )}
                      </label>
                      <button onClick={() => eliminarLiquidacion(clienteSel.id, liq.id)} style={{ ...font, background: "none", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: C.err, cursor: "pointer" }}>Eliminar</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {liq.instancias.map((inst, idx) => (
                        <div key={inst.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FFF", border: `1px solid ${C.borde}`, borderRadius: 9999, padding: "3px 4px 3px 10px" }}>
                          <input value={inst.nombre} onChange={e => editarInstancia(clienteSel.id, liq.id, inst.id, "nombre", e.target.value)} style={{ ...font, fontSize: 11.5, fontWeight: 600, color: C.navy, border: "none", outline: "none", background: "transparent", width: Math.max(60, (inst.nombre?.length || 6) * 7) }} />
                          <span style={{ fontSize: 10, color: C.txt3, fontWeight: 600 }}>+</span>
                          <input type="number" min="0" step="0.5" value={inst.slaHabiles}
                            onChange={e => editarInstancia(clienteSel.id, liq.id, inst.id, "slaHabiles", Math.max(0, +e.target.value || 0))}
                            title={idx === 0 ? "Cut Off no usa SLA" : "Días hábiles desde la etapa anterior"}
                            style={{ ...font, width: 42, fontSize: 11.5, fontWeight: 700, color: C.celeste, textAlign: "right", border: "none", background: "transparent", outline: "none" }} />
                          <span style={{ fontSize: 10, color: C.txt3, fontWeight: 600 }}>d</span>
                          <button onClick={() => eliminarInstancia(clienteSel.id, liq.id, inst.id)} style={{ background: "none", border: "none", color: C.txt3, cursor: "pointer", fontSize: 13, padding: "0 6px", lineHeight: 1 }}>×</button>
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
                  SLA quincenas: <strong>{slaQuincena}</strong> día(s) hábil(es) entre etapas (editable en Controles).
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tarjeta "Sin asignar" */}
        {clientesSinAsignar.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <SectionLabel>Sin analista activo</SectionLabel>
            <div style={{ background: "#FFF", border: `1px dashed ${C.warn}`, borderRadius: 14, padding: "12px 15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Sin asignar</div>
                  <div style={{ fontSize: 11, color: C.txt2 }}>Clientes cuyo analista actual fue excluido del escenario.</div>
                </div>
                <Badge color={C.warn}>{formatN(sinAsignar.n)} clientes</Badge>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientesSinAsignar.map(c => chipCliente(c, { movido: false, sel: seleccionado === c.id, tieneEquipo: false, esEquipo: false }))}
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
                const clientesDirectos = incluidos.filter(c => asignacion[c.id] === a.nombre);
                const clientesEquipo = incluidos.filter(c => c.equipo
                  && asignacion[c.id] === c.consultor
                  && a.nombre !== c.consultor
                  && c.equipo.includes(a.nombre)
                  && nombresVisibles.has(c.consultor));
                const isDragTarget = dragCliente && dragOver === a.nombre;
                return (
                  <div key={a.nombre}
                    onDragOver={e => { if (!dragCliente) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(a.nombre); }}
                    onDragLeave={() => { if (dragOver === a.nombre) setDragOver(null); }}
                    onDrop={e => { e.preventDefault(); if (dragCliente) mover(dragCliente, a.nombre); setDragCliente(null); setDragOver(null); }}
                    style={{ position: "relative", background: isDragTarget ? "rgba(0,172,212,0.05)" : "#FFF", border: isDragTarget ? `2px solid ${C.celeste}` : `1px solid ${C.borde}`, borderRadius: 14, boxShadow: isDragTarget ? `0 0 0 3px rgba(0,172,212,0.15)` : "0 1px 4px rgba(30,58,95,0.06)", overflow: "hidden", transition: "border 0.12s, box-shadow 0.12s" }}>
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
                        {clientesDirectos.map(c => chipCliente(c, {
                          movido: asignacion[c.id] !== c.consultor,
                          sel: seleccionado === c.id,
                          tieneEquipo: !!(c.equipo && asignacion[c.id] === c.consultor),
                          esEquipo: false,
                        }))}
                        {clientesEquipo.map(c => chipCliente(c, {
                          movido: false, sel: seleccionado === c.id, tieneEquipo: false, esEquipo: true, lider: c.consultor,
                        }))}
                        {clientesDirectos.length === 0 && clientesEquipo.length === 0 && (
                          <span style={{ fontSize: 11.5, color: isDragTarget ? C.celeste : C.txt3, fontWeight: isDragTarget ? 700 : 400 }}>
                            {isDragTarget ? "Soltar acá →" : "Sin clientes asignados — podés moverle alguno."}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Carga rápida de cut-offs (v2) */}
        <PanelCutoffs
          clientes={incluidos}
          configClientes={configClientes}
          cutoffs={cutoffs}
          cutoffsEstado={cutoffsEstado}
          setCutoff={setCutoff}
          confirmarCutoff={confirmarCutoff}
          aplicarLote={aplicarCutoffsLote}
          abrirCliente={setSeleccionado}
          C={C}
          font={font}
        />

        {/* Heatmap de carga (v2) */}
        <HeatmapCarga
          clientes={incluidos}
          baseAsignacion={BASE_ASIGNACION}
          asignacion={asignacion}
          configClientes={configClientes}
          cutoffs={cutoffs}
          feriadosSet={FERIADOS}
          analistasVisibles={analistasVisibles}
          nombresVisibles={nombresVisibles}
          ordenJefaturas={ORDEN_JEFATURAS}
          ajustarPorComplejidad={ajustarPorComplejidad}
          setAjustarPorComplejidad={setAjustarPorComplejidad}
          nSinConfirmar={nSinConfirmar}
          C={C}
          font={font}
        />

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
              <span>Todavía no hay movimientos. Tocá un cliente o arrastralo a otra tarjeta. Acá se va a armar la lista para aplicar a mano en Monday.</span>
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
