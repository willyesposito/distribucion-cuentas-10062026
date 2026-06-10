# PLAN-V2 — Calendario de carga + escenarios + sugeridor

Acordado con el usuario el 10/06/2026: features 1 a 6 del brainstorm, con **A1 + B2 + C1**.
Decisiones confirmadas: `n_meros__1` de los boards fuente **es esfuerzo en horas** (estándar
hoy en Monday) con **toggle para ajustar por complejidad**; cut-offs **a mano la primera vez**
con botón para traerlos de Monday a demanda; el heatmap muestra el **ciclo completo** aunque
cruce de mes.

## Archivos que llegan listos (entregados por Claude.ai, ya testeados)
- `src/ciclos.js` — motor puro: días hábiles + feriados, generación de eventos desde
  cut-off + instancias de `configClientes`, horas default reales de Pilar, factor de
  complejidad (C/3), `detectarChoques` (duro = mismo día, advertencia ≤2 hábiles),
  `indicadores` (pico, choques, desvío). **Validado contra el ciclo real de POP junio 2026**
  (corte 22/06 → v1 24/06 → 25/06 → 26/06 → aprobación 29/06) y contra el feriado 09/07.
- `.github/workflows/refresh-snapshot.yml` — cron L-V 07:00 AR + workflow_dispatch; corre
  `fetch_monday.mjs` y `scripts/fetch_cutoffs.mjs`, commitea `data/` y re-dispara deploy.yml
  (los push con GITHUB_TOKEN no disparan workflows solos). **Requiere crear el secret
  `MONDAY_API_TOKEN` en el repo.**
- `scripts/fetch_cutoffs.mjs` — descubre boards fuente desde los 3 rollups y extrae los
  cortes de novedades futuros (fecha, Mensual/1Q/2Q, horas, estado) → `data/cutoffs.json`.

## Pasos de implementación (en orden)

### 1. Estado nuevo en `simulador-reorg.jsx`
```js
const [cutoffs, setCutoffs] = useState({});            // {liqId: "YYYY-MM-DD"} — a mano la 1ª vez
const [ajustarPorComplejidad, setAjustarPorComplejidad] = useState(false); // toggle horas × C/3
const [mesAncla, setMesAncla] = useState("2026-07");   // mes de los cut-offs que se planifica
```
- En el panel "Liquidaciones de {cliente}" (ya existe): agregar un `<input type="date">` de
  **Cut Off** por liquidación. Esa fecha es el ancla; el resto de instancias se fecha solo
  con `generarEventosCliente` de `src/ciclos.js`.
- Cargar `feriados-ar.json` una vez: `const FERIADOS = new Set(feriados.feriados)`.

### 2. Heatmap (C1) — componente nuevo `src/HeatmapCarga.jsx`
- Eventos: por cada cliente incluido → `generarEventosCliente(cliente, configClientes[id],
  cutoffs, FERIADOS, { ajustarPorComplejidad })`, luego resolver analista con la `asignacion`
  actual. **Toyota/equipo:** si el cliente tiene `equipo` y sigue en su consultor original,
  duplicar cada evento entre los miembros visibles con `horas / integrantes` (misma regla
  que ya usa `cargaPor`).
- Grilla: filas = analistas visibles (agrupados por jefatura, mismo orden que las tarjetas);
  columnas = **todas las fechas hábiles entre el mínimo y el máximo de los eventos** (ciclo
  completo, cruza de mes; los findes/feriados se omiten o se pintan grises angostos).
- Celda: intensidad celeste→rojo proporcional a horas (`maxHorasDia` del motor como techo);
  número de horas si ≥1. Borde rojo grueso si la celda participa de un **choque duro**,
  borde ámbar punteado si **advertencia** (usar `detectarChoques`).
- Click en celda → popover con el detalle: cliente · liquidación · instancia · horas.
- Encima del heatmap, los **indicadores antes/después** (feature 4): pico (analista, fecha,
  horas), choques duros, advertencias, desvío de scores. "Antes" se calcula con la
  asignación base y los mismos cutoffs; "después" con la asignación actual.
- Panel de **pendientes**: clientes con liquidaciones sin cut-off (`liquidacionesSinCutoff`)
  listados con botón que abre su panel para cargar la fecha.

### 3. Botón "Traer cut-offs de Monday" (dos vías)
- **Vía A (base):** botón que linkea a la GH Action
  `https://github.com/<org>/<repo>/actions/workflows/refresh-snapshot.yml` ("Run workflow").
  Al redeployar, la app importa `data/cutoffs.json` (import JSON de Vite) y ofrece
  "Aplicar cut-offs de Monday": para cada cliente matchear por nombre
  (cutoffs.json usa el nombre del board fuente, ej. "PO Pilar" ≠ "Plastic Omnium Pilar" →
  mantener un diccionario `ALIAS` editable en `src/alcance.js`), y por cada liquidación
  tomar el corte futuro más próximo cuyo `tipo` corresponda (Mensual → liq "Mensual",
  Primera/Segunda Quincena → "Quincena 1/2"). Los aplicados pisan `cutoffs[liqId]` y se
  marcan visualmente como "de Monday" vs. "manual".
- **Vía B (inmediata, opcional):** modal "Conectar Monday": input de token (solo lectura),
  guardado SOLO en localStorage del navegador del usuario, y fetch directo a
  `https://api.monday.com/v2` con las mismas queries de `scripts/fetch_cutoffs.mjs`.
  **Verificar CORS desde browser antes de prometerla**; si CORS bloquea, queda solo la vía A.
  Nunca commitear ni loguear el token.

### 4. Escenarios guardados (feature 6) — localStorage (app propia, permitido)
- Estructura: `{ nombre, creado, asignacion, configClientes, cutoffs, pesos, excluirToyota,
  analistasExcluidos: [...], ajustarPorComplejidad }` bajo la key `reorg:escenarios` (array).
- UI: select de escenarios + Guardar / Guardar como / Eliminar + Exportar/Importar JSON
  (para compartir por mail). Al cargar un escenario sobre un snapshot más nuevo, validar
  que los `liqId` existan; los que no, descartarlos con aviso.

### 5. Sugeridor de movimientos (feature 5)
- Botón "Sugerir movimientos": greedy puro sobre el motor —
  1) calcular indicadores actuales; 2) para el analista del pico y el de mayor score,
  probar mover cada uno de sus clientes a cada analista visible; 3) re-calcular
  `indicadores` + score; 4) rankear por (Δpico, Δchoques duros, Δdesvío) y mostrar el top 3
  como botones "Aplicar". Con 26 clientes × ~11 destinos es barato (<300 simulaciones).
- No mover clientes con `equipo` en las sugerencias automáticas (caso Toyota es decisión humana).

### 6. Pegar en CLAUde.md (actualización de estado)
```
- v2 (en curso): heatmap analista × día con horas de esfuerzo (n_meros__1 de boards
  fuente, CONFIRMADO como horas estándar), toggle ×complejidad (factor C/3), cut-offs
  manuales con import desde data/cutoffs.json (scripts/fetch_cutoffs.mjs), ciclo completo
  cruzando meses, choques duro/advertencia (src/ciclos.js, testeado contra POP junio),
  escenarios en localStorage, sugeridor greedy, refresh-snapshot.yml (cron + dispatch,
  secret MONDAY_API_TOKEN).
- Horas default por etapa (fuente POP 8179343211): Cut Off 1 · v1 6 · Comentarios 3 ·
  v2 6 · Aprobación 2; quincenas: 1 · 3 · 2 · 1.
```

## Checklist de verificación al terminar
- [ ] El ciclo mensual generado para POP con corte 22/06 da 24/06 · 25/06 · 26/06 · 29/06.
- [ ] Un corte 07/07 +2 hábiles cae 10/07 (salta el feriado 09/07).
- [ ] Dos v1 de clientes distintos el mismo día sobre el mismo analista marcan choque duro.
- [ ] Mover un cliente actualiza heatmap + indicadores + plan de cambios en el mismo click.
- [ ] `npm run build` pasa y la Action refresh corre en verde con el secret cargado.

---

## Decisiones de diseño — Heatmap (acordado 10/06/2026)

Las **opciones elegidas van en negrita**; las alternativas se conservan acá por si en una próxima iteración hay que cambiar.

### Q1 — Ubicación en la UI
- **A) Sección plegable nueva entre las tarjetas de jefatura y el plan de cambios, abierta por default.** [elegida]
- B) Tab/pestaña superior "Equipo / Calendario".
- C) Sección al final, después del plan de cambios.
- D) Drawer/modal a pantalla completa con botón "Ver calendario".

### Q2 — Rango y columnas
- **A) Una columna por día hábil (omite findes/feriados); rango automático = min..max de los eventos generados; scroll horizontal si no entra. Sin `mesAncla` (se dropea del estado planeado).** [elegida]
- B) Igual que A pero con findes/feriados como columnas grises angostas.
- C) Selector de mes ancla + flechas ← →; el heatmap se acota al mes.
- D) Agrupar por semana con drill-down al click.

### Q3 — Coloreado de celdas
- **A) Gradiente continuo celeste `#00ACD4` → amarillo `#F59E0B` → rojo `#E85518`, proporcional a `horas / maxHorasDia`. Número de horas centrado, color de texto según contraste.** [elegida]
- B) 4 escalones discretos (vacío / liviano / medio / cargado).
- C) Solo número de horas, sin fondo de color.

### Q4 — Indicadores antes/después
- **A) Banda de chips arriba del heatmap, antes vs. después lado a lado: Pico (analista · fecha · horas), Choques duros, Advertencias, Desvío de scores; delta en color.** [elegida]
- B) Sección comparador separada (no en heatmap).
- C) Indicadores dentro de cada tarjeta de jefatura, sin banda dedicada.

### Q5 — Pendientes (clientes sin cut-off)
- **A) Panel plegable arriba del heatmap (abierto si hay pendientes), con lista de clientes y botón "Cargar cut-off" que abre el panel de liquidaciones del cliente.** [elegida]
- B) Banner amarillo + modal con la lista.
- C) Sin panel; chips en las tarjetas de jefatura.

### Q6 — Qué eventos suman horas
- **Confirmado:** todos los eventos (Cut Off, v1, Comentarios v1, v2, Aprobación) suman en `cargaDiaria`. La marca `critico` solo se usa en `detectarChoques`.

### Q7 — Click en celda
- **A) Popover propio (div absoluto) con la lista de eventos del día/analista: cliente · liq · instancia · horas.** [elegida]
- B) Tooltip nativo con texto plano.
- C) Drawer lateral con detalle + atajos.
