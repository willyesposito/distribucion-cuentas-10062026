# Tareas pendientes — v2 del Simulador

**Estado actual (10/06/2026):** Heatmap + indicadores antes/después + cut-offs manuales **entregado**. Integración API pausada. Escenarios y sugeridor sin empezar.

---

## Paso 3 — Integración Monday API (PAUSADO por el momento)

**Checklist:**
- [ ] Crear secret `MONDAY_API_TOKEN` en GitHub repo Settings → Secrets.
- [ ] Validar que el workflow `.github/workflows/refresh-snapshot.yml` corre en verde (genera `data/cutoffs.json`).
- [ ] Implementar botón "Aplicar cut-offs de Monday" en el heatmap (vía A: linkea al workflow).
- [ ] Opcional: validar CORS y considerar vía B (modal con token en localStorage).

**Razón de la pausa:** El usuario quiere validar primero la mecánica del heatmap con datos manuales antes de invertir en la integración automática.

---

## Paso 4 — Escenarios guardados (localStorage)

**Checklist:**
- [ ] Estructura: `{ nombre, creado, asignacion, configClientes, cutoffs, pesos, excluirToyota, analistasExcluidos, ajustarPorComplejidad }` bajo key `reorg:escenarios` (array).
- [ ] UI: select de escenarios + botones Guardar / Guardar como / Eliminar.
- [ ] Exportar/Importar JSON para compartir por mail.
- [ ] Al cargar un escenario sobre snapshot más nuevo: validar que los `liqId` existan; descartar orphans con aviso.

**Notas:**
- Los escenarios persisten entre sesiones (cliente es el dueño de los datos).
- Tamaño potencial: con 26 clientes × 3 liqs × 5 instancias ≈ 390 entrada de configClientes + asignacion (26) + cutoffs (78) + pesos (3) ≈ 500 valores por escenario. A unos 50 escenarios históricos = 25KB JSON. localStorage típicamente permite 5–10MB, así que sin problema.

---

## Paso 5 — Sugeridor de movimientos (greedy)

**Checklist:**
- [ ] Botón "Sugerir movimientos" debajo del heatmap (o en el header).
- [ ] Lógica: greedy sobre el motor —
  1. Calcular indicadores actuales.
  2. Para el analista del pico y el de mayor score, probar mover cada cliente a cada destino visible.
  3. Re-calcular indicadores + score.
  4. Rankear por (Δpico, Δchoques duros, Δdesvío) y mostrar top 3 como botones "Aplicar".
- [ ] **No mover clientes con `equipo`** en las sugerencias automáticas (Toyota es decisión humana).
- [ ] Con 26 clientes × ~11 destinos = <300 simulaciones. Cheap.

**Notas:**
- El resultado son 3 opciones que el usuario puede aplicar de un click, o ignorar y hacer ajustes manuales.
- El algoritmo es simple pero efectivo para balancear pico y choques.

---

## Testing (para toda la v2)

**Checklist manual:**
- [ ] El ciclo mensual generado para POP con corte 22/06 da 24/06 · 25/06 · 26/06 · 29/06 (los 4 eventos de liquidación). Verificar con el usuario en browser.
- [ ] Un corte 07/07 +2 hábiles cae 10/07 (salta el feriado 09/07). Comprobar en browser.
- [ ] Dos v1 de clientes distintos el mismo día sobre el mismo analista marcan choque duro con borde rojo.
- [ ] Mover un cliente actualiza heatmap + indicadores + plan de cambios **al mismo click** (sin lag).
- [ ] Popover en celdas con muchos eventos (>3 hitos) mantiene scroll legible.
- [ ] Toggle "Ajustar por complejidad" recalcula el heatmap en tiempo real.
- [ ] Panel de pendientes abre el cliente cuando se clickea un botón.

---

## Documentación

- [ ] Agregar instrucciones de "Cómo cargar cut-offs" en la UI (tooltip o pequeña sección de ayuda en el heatmap).
- [ ] Actualizar README si existe (o crear uno).
- [ ] Documentar el formato del cutoff JSON en `PLAN-V2.md`.

---

## Revisiones y mejoras futuras (v3+)

- Línea de tiempo/vista semanal como alternativa al grid diario.
- Comparador antes/después más visual (gráficos de carga por día).
- Integración con Slack para notificaciones de cambios.
- Export a iCal o Google Calendar para los analistas.
