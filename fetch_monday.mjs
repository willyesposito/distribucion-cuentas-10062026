#!/usr/bin/env node
/**
 * fetch_monday.mjs — Regenera data/snapshot.json desde la Matrix Complejidad Clientes.
 * SOLO LECTURA: este proyecto jamás muta tableros de Monday.
 *
 * Uso:  MONDAY_API_TOKEN=xxx node scripts/fetch_monday.mjs
 *
 * Notas de API (verificadas 10/06/2026):
 *  - limit ≤ 100 cuando se piden columnas; limit 500 dispara REQUEST_MAX_COMPLEXITY_EXCEEDED.
 *  - Las columnas mirror de los rollups de crono NO son legibles: para fechas,
 *    seguir conectar_tableros__1 hacia el board fuente "<Cliente> - Cronograma de Liquidación".
 */
import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN = process.env.MONDAY_API_TOKEN;
if (!TOKEN) { console.error("Falta MONDAY_API_TOKEN"); process.exit(1); }

const MATRIX_ID = 6552205482;
const COLS = ["consultor2__1", "color_mkpexfx8", "clasificaci_n__1", "n_meros__1", "tipo_de_liquidaci_n__1"];
const CRONOS = { cande: 8182363880, melina: 8182350792, sergio: 7999686781 };

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

async function fetchMatrix() {
  const query = `
    query ($board: ID!, $cols: [String!], $cursor: String) {
      boards(ids: [$board]) {
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items {
            id name group { title }
            column_values(ids: $cols) { id text }
          }
        }
      }
    }`;
  let cursor = null, items = [];
  do {
    const data = await gql(query, { board: MATRIX_ID, cols: COLS, cursor });
    const page = data.boards[0].items_page;
    items = items.concat(page.items);
    cursor = page.cursor;
  } while (cursor);

  return items.map((it) => {
    const c = Object.fromEntries(it.column_values.map((v) => [v.id, v.text || null]));
    const consultor = c.consultor2__1;
    const grupoMonday = it.group?.title || null;
    const esBaja = consultor === "Baja" || /baja/i.test(grupoMonday || "");
    const esTasaOtros = /tasa|migraci|otros/i.test(grupoMonday || "") || consultor === "Team TASA" || !c.color_mkpexfx8;
    return {
      id: it.id,
      nombre: it.name,
      grupoMonday,
      consultor,
      jefatura: c.color_mkpexfx8,
      complejidad: c.clasificaci_n__1 ? Number(c.clasificaci_n__1) : null,
      pays: c.n_meros__1 ? Number(c.n_meros__1) : null,
      tipo: c.tipo_de_liquidaci_n__1,
      grupo: esBaja ? "baja" : esTasaOtros ? "tasa_otros" : "activo",
    };
  });
}

// (v2) Descubre el board fuente de cronograma de cada cliente a partir de un rollup.
// Devuelve { siglaCliente → { boardId, boardName } } para luego paginar fechas del fuente.
export async function descubrirBoardsFuente(rollupId) {
  const query = `
    query ($board: ID!, $cursor: String) {
      boards(ids: [$board]) {
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items { id name column_values(ids: ["conectar_tableros__1"]) {
            ... on BoardRelationValue { linked_items { board { id name } } }
          } }
        }
      }
    }`;
  const mapa = {};
  let cursor = null;
  do {
    const data = await gql(query, { board: rollupId, cursor });
    const page = data.boards[0].items_page;
    for (const it of page.items) {
      const linked = it.column_values?.[0]?.linked_items?.[0]?.board;
      if (linked) {
        const sigla = it.name.split(" - ")[0].trim();
        mapa[sigla] = { boardId: linked.id, boardName: linked.name };
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return mapa;
}

// (v2) Fechas reales de un board fuente "<Cliente> - Cronograma de Liquidación".
export async function fetchCronoFuente(boardFuenteId) {
  const cols = ["date", "tipo_de_liquidaci_n_mkkvbzd4", "project_status", "project_owner", "personas", "estado_1_mkkzbjk9", "n_meros0"];
  const query = `
    query ($board: ID!, $cols: [String!], $cursor: String) {
      boards(ids: [$board]) {
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items { id name column_values(ids: $cols) { id text } }
        }
      }
    }`;
  let cursor = null, items = [];
  do {
    const data = await gql(query, { board: boardFuenteId, cols, cursor });
    const page = data.boards[0].items_page;
    items = items.concat(page.items.map((it) => ({
      id: it.id,
      hito: it.name,
      ...Object.fromEntries(it.column_values.map((v) => [v.id, v.text || null])),
    })));
    cursor = page.cursor;
  } while (cursor);
  return items;
}

const main = async () => {
  const clientes = await fetchMatrix();
  const snapshot = {
    generado: new Date().toISOString(),
    fuente: `Matrix Complejidad Clientes (${MATRIX_ID})`,
    cronos: CRONOS,
    clientes,
  };
  mkdirSync("data", { recursive: true });
  writeFileSync("data/snapshot.json", JSON.stringify(snapshot, null, 2));
  console.log(`OK: ${clientes.length} clientes → data/snapshot.json`);
  console.log("Recordá actualizar CLIENTES y SNAPSHOT_DATE en app/simulador-reorg.jsx");
};
main().catch((e) => { console.error(e); process.exit(1); });
