#!/usr/bin/env node
/**
 * scripts/fetch_cutoffs.mjs — Descubre los boards fuente de cronograma desde los 3
 * rollups y extrae los CORTES DE NOVEDADES reales (fecha + tipo + horas) por cliente.
 * SOLO LECTURA. Output: data/cutoffs.json
 *
 * Uso:  MONDAY_API_TOKEN=xxx node scripts/fetch_cutoffs.mjs
 *
 * Mecánica (verificada 10/06/2026, ver CLAUDE.md):
 *  - Las fechas de los rollups son mirror (ilegibles por API) → se sigue
 *    conectar_tableros__1 al board fuente "<Cliente> - Cronograma de Liquidación".
 *  - El corte es el ítem "<sigla> - Recepción de Novedades" (+ " - 1Q" / " - 2Q").
 *  - El mes en curso puede no estar cargado (caso Carrier): la UI debe permitir
 *    cargar el cut-off a mano cuando falte.
 *  - Autodetecta self-contained: no importa fetch_monday.mjs porque ese script
 *    ejecuta main() al importarse.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN = process.env.MONDAY_API_TOKEN;
if (!TOKEN) { console.error("Falta MONDAY_API_TOKEN"); process.exit(1); }

const ROLLUPS = { cande: 8182363880, melina: 8182350792, sergio: 7999686781 };
// Solo cortes desde este mes hacia adelante (los históricos no sirven para planificar)
const DESDE = new Date(); DESDE.setUTCDate(1);
const DESDE_ISO = DESDE.toISOString().slice(0, 10);

async function gql(query, variables = {}) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: TOKEN, "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

/** Mapa { boardId → boardName } de boards fuente, descubierto desde un rollup. */
async function descubrirBoardsFuente(rollupId) {
  const query = `
    query ($board: ID!, $cursor: String) {
      boards(ids: [$board]) {
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items { name column_values(ids: ["conectar_tableros__1"]) {
            ... on BoardRelationValue { linked_items { board { id name } } }
          } }
        }
      }
    }`;
  const mapa = {};
  let cursor = null, pagina = 0;
  do {
    const data = await gql(query, { board: rollupId, cursor });
    const page = data.boards[0].items_page;
    for (const it of page.items) {
      const linked = it.column_values?.[0]?.linked_items?.[0]?.board;
      if (linked) mapa[linked.id] = linked.name;
    }
    cursor = page.cursor;
    pagina++;
  } while (cursor && pagina < 80); // tope de seguridad (~8000 ítems)
  return mapa;
}

/** Cortes de novedades futuros de un board fuente. */
async function fetchCortes(boardId, boardName) {
  const query = `
    query ($board: ID!, $cursor: String) {
      boards(ids: [$board]) {
        items_page(limit: 100, cursor: $cursor,
          query_params: { rules: [{ column_id: "name", compare_value: "Recepción de Novedades", operator: contains_text }] }) {
          cursor
          items { id name column_values(ids: ["date", "tipo_de_liquidaci_n_mkkvbzd4", "n_meros__1", "project_status"]) { id text } }
        }
      }
    }`;
  const cortes = [];
  let cursor = null;
  do {
    const data = await gql(query, { board: boardId, cursor });
    const page = data.boards[0].items_page;
    for (const it of page.items) {
      const c = Object.fromEntries(it.column_values.map((v) => [v.id, v.text || null]));
      const fecha = c.date ? c.date.slice(0, 10) : null;
      if (!fecha || fecha < DESDE_ISO) continue;
      cortes.push({
        itemId: it.id,
        hito: it.name,
        fecha,
        tipo: c.tipo_de_liquidaci_n_mkkvbzd4, // Mensual / Primera Quincena / Segunda Quincena
        horas: c.n_meros__1 ? Number(c.n_meros__1) : null,
        estado: c.project_status,
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return cortes.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const main = async () => {
  const boards = {};
  for (const [nombre, id] of Object.entries(ROLLUPS)) {
    process.stdout.write(`Descubriendo boards fuente en rollup ${nombre} (${id})... `);
    Object.assign(boards, await descubrirBoardsFuente(id));
    console.log("ok");
  }
  console.log(`Boards fuente encontrados: ${Object.keys(boards).length}`);

  const clientes = {};
  for (const [boardId, boardName] of Object.entries(boards)) {
    if (!/cronograma de liquidaci/i.test(boardName)) continue;
    const clienteNombre = boardName.replace(/\s*-\s*Cronograma de Liquidación.*/i, "").trim();
    try {
      const cortes = await fetchCortes(boardId, boardName);
      clientes[clienteNombre] = { boardId, boardName, cortes };
      console.log(`  ${clienteNombre}: ${cortes.length} cortes ≥ ${DESDE_ISO}`);
    } catch (e) {
      console.warn(`  ${clienteNombre}: ERROR ${e.message}`);
      clientes[clienteNombre] = { boardId, boardName, cortes: [], error: String(e.message) };
    }
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/cutoffs.json", JSON.stringify({
    generado: new Date().toISOString(),
    desde: DESDE_ISO,
    fuente: "Boards fuente '<Cliente> - Cronograma de Liquidación' descubiertos vía conectar_tableros__1 de los rollups",
    clientes,
  }, null, 2));
  console.log(`OK → data/cutoffs.json (${Object.keys(clientes).length} clientes)`);
};
main().catch((e) => { console.error(e); process.exit(1); });
