# Simulador de Reorganización — Equipo Payroll H&A

Sandbox para simular reasignaciones de clientes entre analistas/jefaturas y reacomodar fechas de proceso. **Solo lectura sobre Monday**: el output de cada sesión es un "Plan de Cambios" para aplicar a mano. NUNCA usar mutaciones de la API de Monday (create/change/delete) sobre los tableros de producción.

## Estado del proyecto
- **MVP entregado (v1)**: `src/simulador-reorg.jsx` — vista de equipo por jefatura, score de carga con pesos ajustables, reasignación por selector, comparador antes/después, plan de cambios exportable, filtro de analistas activos, slots de liquidación editables por cliente (Cut Off / v1 / Comentarios v1 / v2 / Aprobación). Datos embebidos como snapshot del 10/06/2026. Build con Vite + deploy automático a GitHub Pages vía `.github/workflows/deploy.yml`.
- **v2 entregado (parcial)**: motor de ciclos puro `src/ciclos.js` (días hábiles + feriados AR, eventos fechados a partir de cut-off, carga diaria en horas, choques duro/advertencia, indicadores), heatmap analista × día `src/HeatmapCarga.jsx` con gradiente celeste→amarillo→rojo, indicadores antes/después (pico, choques duros, advertencias), toggle ×complejidad (factor C/3), panel de pendientes (clientes sin cut-off), popover de detalle por celda. Cut-offs por liquidación cargados a mano vía `<input type="date">` en el panel del cliente. Horas default por etapa (fuente PO Pilar 8179343211, `n_meros__1` = horas, confirmado por usuario): Mensual = Cut Off 1 · v1 6 · Comentarios 3 · v2 6 · Aprobación 2; Quincena = 1 · 3 · 2 · 3 · 1.
- **v2 pendiente / pausado**: (a) integración Monday API: workflow `.github/workflows/refresh-snapshot.yml` ya pusheado, secret `MONDAY_API_TOKEN` NO creado todavía; botón "Aplicar cut-offs de Monday" del paso 3 del PLAN-V2.md sin implementar. (b) Escenarios guardados en localStorage. (c) Sugeridor greedy. Ver `PLAN-V2.md` para el detalle y `memory/v2_alcance_sin_api.md` para el motivo de la pausa de (a).
- Regla de trabajo con el usuario: **brainstorming y acuerdo antes de codear cualquier feature nueva**. Presentar opciones con clasificación 1–10. Español rioplatense. Citar siempre tablero/columna de cada dato; nunca inventar valores.

## Fuentes de datos (Monday, solo lectura)

### Matrix Complejidad Clientes — board `6552205482` (fuente de verdad de asignaciones)
| Dato | Column ID | Notas |
|---|---|---|
| Consultor Actual | `consultor2__1` | "Baja" = cliente excluido |
| Jefatura | `color_mkpexfx8` | Candela / Melina / Matías / Franco; puede venir vacía |
| Complejidad 1–5 | `clasificaci_n__1` | |
| Pays | `n_meros__1` | |
| Tipo de Liquidación | `tipo_de_liquidaci_n__1` | texto libre, POCO CONFIABLE; el ciclo real se infiere del crono |
| Estado Prox Mes / Estado Final | (ver get_board_info) | no usados en v1 |

~34 ítems. Cabe en una página (`limit: 100`). Con `limit: 500` + columnas la query excede el límite de complejidad de la API (error `REQUEST_MAX_COMPLEXITY_EXCEEDED`): paginar con limit ≤100 cuando se piden columnas.

### Cronogramas 2026 (rollups) — Cande `8182363880`, Melina `8182350792`, Sergio `7999686781`
**Hallazgo crítico (verificado 10/06/2026):** las columnas de fecha/estado/asignado de los rollups son **mirror** (`reflejo*`) y la API/MCP devuelve `"Column value type is not supported"`. **No leer fechas del rollup.** En cambio:

1. Cada ítem del rollup tiene `conectar_tableros__1` (board_relation) que apunta al ítem real en el **tablero fuente por cliente**, llamado `"<Cliente> - Cronograma de Liquidación"`.
2. Leer las fechas directamente del tablero fuente. **Boards fuente confirmados (10/06/2026):**
   - PO Pilar `8179343211`, Copetro `8173298697`, AYSA `8179394859`, Ford `8179400541`, Carrier `8179403617`, Allegro `8022978910`.
   - Pendientes de mapear: Plastic Omnium Florida, Sportline, Piano, DLA, Marval, y los de jefatura Sergio/Matías (PGI, Lowsedo, Bonafide, Campari, Coty, GSMA) → correr `descubrirBoardsFuente()` sobre los 3 rollups al inicio de la sesión.
3. Columnas verificadas en los tableros fuente: `date` (fecha del hito), `tipo_de_liquidaci_n_mkkvbzd4` (Mensual / Primera Quincena / Segunda Quincena), `project_status`, `project_owner` y `personas` (asignados), `estado_1_mkkzbjk9` (H&A / Cliente), `n_meros0` (año). El campo `n_meros` existe pero su significado no está confirmado: **verificar antes de usar**.
4. **Cortes de novedades + periodicidad (confirmado leíble así):** el ítem del corte se llama `"<sigla> - Recepción de Novedades"` (mensual) y `"... - 1Q"` / `"... - 2Q"` para quincenas. **La periodicidad se infiere contando las variantes**: solo "Mensual" → mensual; aparecen 1Q/2Q → mixto/quincenal. Verificado: Carrier = mensual (corte ~día 20-23); Copetro y Pilar = mixto (mensual + 2 quincenas).
5. **El corte del mes en curso puede no estar cargado aún** en el fuente (ej.: Carrier al 10/06 tenía hasta mayo). Cuando falte el corte del mes objetivo, caer al flujo de pedir cut-off al usuario.
6. Pipeline v2: recorrer cada rollup pidiendo SOLO `conectar_tableros__1`, armar el mapa cliente → board fuente, y luego paginar cada fuente pidiendo solo los column IDs de arriba. Cachear el mapa dentro de la sesión; **nunca cachear datos entre sesiones**.
7. Las siglas de ítem (POP, COP, CAR, AYS, FOR…) NO siempre matchean el nombre de la Matrix → matchear por nombre del board fuente.

### Alcance actual (26 clientes, definido por el usuario el 10/06/2026)
PGI, Siasa Logística, COELSA, Red Bull, Merz, Plastic Omnium Pilar, Finadiet, Epiroc, Geopagos, Poincenot, Plastic Omnium Florida, TIM, Piano, Marval, Sportline, Copetro, AYSA, Ford, DLA, Carrier, Lowsedo, Bonafide, Campari, Coty, GSMA, Toyota.
- **Toyota** (Team TASA / Franco, 8.000 pays) está incluido por pedido explícito, pero distorsiona la normalización de Pays → la UI trae un toggle "Excluir Toyota del score" activado por default.
- **Pablo** (jefatura Matías) queda como analista disponible sin clientes en el alcance: es un destino válido de reasignación.
- Quedan fuera del alcance respecto del snapshot anterior: Allegro, Credencial, Galerías, TPA, Internos, y los Baja (PRISMA, Carestream, Lepic).

### Feriados
`data/feriados-ar.json` — 22 fechas AR 2026 + 01/01/2027, provistas por el usuario (mezcla feriados nacionales + días no laborables que observa H&A). Para el cálculo de días hábiles del SLA, sumar a sábados/domingos. Reconfirmar con el usuario cada año.

## Reglas de negocio

### Score de carga
`Carga = w1·(Σ Complejidad / maxBase) + w2·(cant clientes / maxBase) + w3·(Σ Pays / maxBase)`
- Pesos default 0.40 / 0.35 / 0.25, **ajustables por sliders** (el usuario los está calibrando empíricamente). Se normalizan a suma 1.
- Denominadores = máximos por componente del **escenario base**, fijos durante la sesión → scores comparables antes/después.
- Semáforo: score > media+15% = sobrecargado (rojo #E85518), < media−15% = subcargado (celeste #00ACD4), resto equilibrado (verde #22C55E). Media sobre analistas con ≥1 cliente.

### SLA estándar (documentado el 10/06/2026; vale para ~95% de los clientes)
Días hábiles AR (saltear fines de semana y feriados argentinos).

**Mensual** (provisto por el usuario y verificado contra POP `8179343211` y COP `8173298697`, junio 2026):
- Corte de novedades → **Envío de Liquidación v1: +48 hs (2 hábiles)**
- → **Recepción de Comentarios v1: +24 hs** → **Envío v2: +24 hs** → **Aprobación de Nómina: +24 hs**
- Luego: Recibos/Acreditación ~+1 hábil, Fecha de Pago el hábil siguiente al cierre.

**Quincenal** (verificado en crono; el usuario solo recordaba el envío):
- Corte de novedades quincena → **Envío de Liquidación: +24 hs (1 hábil)** — confirmado en Plastic Pilar y Copetro.
- Después diverge por cliente: Pilar encadena Comentarios +24 hs y Aprobación +24 hs (pago/recibos el día de la aprobación); Copetro comprime Comentarios y Aprobación **el mismo día** del envío, recibos +1 hábil y pago +1 hábil más. La 2ª quincena se ancla al cierre de mes (corre junto con la mensual).
- **Plastic Florida quedó sin verificar** (no se llegó a su board fuente). Asumir patrón Pilar hasta confirmar; marcarlo como pendiente la primera vez que se procese.
- Default razonable cuando un cliente quincenal no tiene tareas en crono: corte → envío +1 hábil → comentarios +1 hábil → aprobación +1 hábil → pago +1 hábil.

**Si un cliente no tiene tareas en crono o el dato es ambiguo:** preguntar al usuario la fecha de cut-off y generar el ciclo con el SLA de arriba. Si el usuario corrige o completa el SLA, actualizar ESTA sección.

### Detección de conflictos (v2)
Hitos críticos = Envío de Liquidación (v1/v2/quincenas) y cortes de novedades. Marcar cuando un analista acumula 2+ hitos críticos el mismo día o en ventana de 2–3 días hábiles, considerando feriados de Argentina (mantener lista anual en `data/feriados-ar.json`).

## Flujo de cada sesión
1. Leer datos frescos de la Matrix (y cronos si la feature lo pide) — nunca reutilizar snapshots viejos.
2. Validar y reportar ANTES de simular: clientes sin Complejidad, sin Pays, sin Jefatura, sin tareas en crono. Pedir cut-off donde falte.
3. Brainstorm de la feature → acuerdo → recién ahí codear.
4. Regenerar `data/snapshot.json` con `node scripts/fetch_monday.mjs` (requiere `MONDAY_API_TOKEN` en el entorno) y actualizar la constante `CLIENTES`/`SNAPSHOT_DATE` del artifact.

## Estructura
```
src/simulador-reorg.jsx               # UI (componente principal, branding H&A apps internas)
src/HeatmapCarga.jsx                  # (v2) calendario analista × día + indicadores antes/después + popover
src/ciclos.js                         # (v2) motor puro: hábiles, eventos, carga, choques, indicadores
src/main.jsx                          # entry point Vite (monta SimuladorReorg en #root)
index.html                            # template HTML (carga Source Sans Pro)
vite.config.js                        # base path '/distribucion-cuentas-10062026/' para GH Pages
package.json                          # deps: react 18 + vite 5
.github/workflows/deploy.yml          # build + deploy a GitHub Pages en cada push a main
.github/workflows/refresh-snapshot.yml# (v2, sin habilitar) cron L-V 07:00 AR + dispatch; requiere secret MONDAY_API_TOKEN
fetch_monday.mjs                      # baja la Matrix (solo queries, cero mutaciones)
scripts/fetch_cutoffs.mjs             # (v2) descubre boards fuente y baja cortes → data/cutoffs.json
data/feriados-ar.json                 # (v2) feriados argentinos del año
PLAN-V2.md                            # plan detallado de la v2 + decisiones de diseño del heatmap
CLAUDE.md                             # este archivo
```

## Branding (apps internas H&A — ver skill hya-brand para el detalle)
Off-white `#F4F7FA` de fondo, navy `#1E3A5F`/`#0F2133` para headers, celeste `#00ACD4` como acento único de marca, bordes `#DDE5EF`, tokens de estado (ok `#22C55E`, warn `#F59E0B`, error `#E85518`), Source Sans Pro, sombras con tinte navy, sin icon-packs de terceros, sin left-border accents.
