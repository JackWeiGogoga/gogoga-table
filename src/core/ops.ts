/**
 * 表格上的各种改动。每个函数都返回一张新表，不改传进来的那张（撤销就是存旧表）。
 * 增删、移动行列时，注释里按坐标记的东西（底色）和按列记的东西（列宽）跟着挪。
 */

import { type Align, type CellColor, cellRef, parseRef, type Table, type TableMeta } from "./table";

export function cloneTable(t: Table): Table {
  return {
    cells: t.cells.map((r) => r.slice()),
    align: t.align.slice(),
    meta: cloneMeta(t.meta),
    style: { ...t.style },
  };
}

function cloneMeta(m: TableMeta): TableMeta {
  const out: TableMeta = { ...m };
  if (m.w) out.w = m.w.slice();
  if (m.bg) out.bg = { ...m.bg };
  return out;
}

export const rowCount = (t: Table) => t.cells.length;
export const colCount = (t: Table) => t.align.length;

/** 按坐标记的设置换位置：map 返回新的 (行, 列)，null 表示这格没了 */
function remapCells(meta: TableMeta, map: (r: number, c: number) => [number, number] | null): void {
  if (!meta.bg) return;
  const next: Record<string, CellColor> = {};
  for (const [k, v] of Object.entries(meta.bg)) {
    const p = parseRef(k);
    const to = p && map(p.r, p.c);
    if (to) next[cellRef(to[0], to[1])] = v;
  }
  meta.bg = next;
}

/** 列宽数组补到 n 列，方便按列号增删 */
function widths(meta: TableMeta, n: number): (number | null)[] {
  const w = (meta.w ?? []).slice(0, n);
  while (w.length < n) w.push(null);
  return w;
}

export function setCell(t: Table, r: number, c: number, text: string): Table {
  if (t.cells[r]?.[c] === undefined || t.cells[r][c] === text) return t;
  const n = cloneTable(t);
  n.cells[r][c] = text;
  return n;
}

/** 在第 at 行前面插入一行（at = 行数时加在最后）。表头（第 0 行）前面不能插 */
export function insertRow(t: Table, at: number): Table {
  const i = Math.max(1, Math.min(at, rowCount(t)));
  const n = cloneTable(t);
  n.cells.splice(i, 0, Array.from({ length: colCount(t) }, () => ""));
  remapCells(n.meta, (r, c) => [r >= i ? r + 1 : r, c]);
  return n;
}

/** 删第 r 行；表头和最后一行数据删不掉（至少留一行数据） */
export function deleteRow(t: Table, r: number): Table {
  if (r < 1 || r >= rowCount(t) || rowCount(t) <= 2) return t;
  const n = cloneTable(t);
  n.cells.splice(r, 1);
  remapCells(n.meta, (rr, c) => (rr === r ? null : [rr > r ? rr - 1 : rr, c]));
  return n;
}

export function insertCol(t: Table, at: number): Table {
  const i = Math.max(0, Math.min(at, colCount(t)));
  const n = cloneTable(t);
  for (const row of n.cells) row.splice(i, 0, "");
  n.align.splice(i, 0, null);
  if (n.meta.w) {
    const w = widths(n.meta, colCount(t));
    w.splice(i, 0, null);
    n.meta.w = w;
  }
  remapCells(n.meta, (r, c) => [r, c >= i ? c + 1 : c]);
  return n;
}

/** 删第 c 列；只剩一列时不删 */
export function deleteCol(t: Table, c: number): Table {
  if (c < 0 || c >= colCount(t) || colCount(t) <= 1) return t;
  const n = cloneTable(t);
  for (const row of n.cells) row.splice(c, 1);
  n.align.splice(c, 1);
  if (n.meta.w) {
    const w = widths(n.meta, colCount(t));
    w.splice(c, 1);
    n.meta.w = w;
  }
  remapCells(n.meta, (r, cc) => (cc === c ? null : [r, cc > c ? cc - 1 : cc]));
  return n;
}

/** 把第 from 行挪到第 to 的位置（都是数据行，表头不动） */
export function moveRow(t: Table, from: number, to: number): Table {
  const last = rowCount(t) - 1;
  if (from < 1 || from > last) return t;
  const dest = Math.max(1, Math.min(to, last));
  if (dest === from) return t;
  const n = cloneTable(t);
  const [row] = n.cells.splice(from, 1);
  n.cells.splice(dest, 0, row);
  remapCells(n.meta, (r, c) => [movedIndex(r, from, dest), c]);
  return n;
}

export function moveCol(t: Table, from: number, to: number): Table {
  const last = colCount(t) - 1;
  if (from < 0 || from > last) return t;
  const dest = Math.max(0, Math.min(to, last));
  if (dest === from) return t;
  const n = cloneTable(t);
  for (const row of n.cells) row.splice(dest, 0, ...row.splice(from, 1));
  n.align.splice(dest, 0, ...n.align.splice(from, 1));
  if (n.meta.w) {
    const w = widths(n.meta, colCount(t));
    w.splice(dest, 0, ...w.splice(from, 1));
    n.meta.w = w;
  }
  remapCells(n.meta, (r, c) => [r, movedIndex(c, from, dest)]);
  return n;
}

/** 一项从 from 挪到 to 之后，原来在 i 的那一项现在在哪 */
function movedIndex(i: number, from: number, to: number): number {
  if (i === from) return to;
  if (from < to && i > from && i <= to) return i - 1;
  if (from > to && i >= to && i < from) return i + 1;
  return i;
}

export function setAlign(t: Table, c: number, a: Align): Table {
  if (c < 0 || c >= colCount(t) || t.align[c] === a) return t;
  const n = cloneTable(t);
  n.align[c] = a;
  return n;
}

/** 列宽：null 是自动 */
export function setWidth(t: Table, c: number, w: number | null): Table {
  if (c < 0 || c >= colCount(t)) return t;
  const n = cloneTable(t);
  const ws = widths(n.meta, colCount(t));
  ws[c] = w == null ? null : Math.max(40, Math.min(2000, Math.round(w)));
  n.meta.w = ws;
  return n;
}

/** 给一片格子设底色，color 为 null 是去掉 */
export function setBg(t: Table, cells: readonly { r: number; c: number }[], color: CellColor | null): Table {
  const n = cloneTable(t);
  const bg = { ...(n.meta.bg ?? {}) };
  for (const { r, c } of cells) {
    if (r < 0 || r >= rowCount(t) || c < 0 || c >= colCount(t)) continue;
    const k = cellRef(r, c);
    if (color) bg[k] = color;
    else delete bg[k];
  }
  n.meta.bg = bg;
  return n;
}

export function bgOf(t: Table, r: number, c: number): CellColor | null {
  return t.meta.bg?.[cellRef(r, c)] ?? null;
}

export function widthOf(t: Table, c: number): number | null {
  return t.meta.w?.[c] ?? null;
}
