/**
 * 表格上的各种改动。每个函数都返回一张新表，不改传进来的那张（撤销就是存旧表）。
 * 增删、移动行列时，注释里按坐标记的东西（底色）和按列记的东西（列宽）跟着挪。
 */

import { type Align, type CellColor, cellRef, parseRange, parseRef, rangeRef, type Rect, type Table, type TableDensity, type TableMeta, type TableStyle } from "./table";
import { fillSeries } from "./fill";

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
  if (m.merge) out.merge = m.merge.slice();
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

/**
 * 合并区域跟着行列变：fr / fc 给出旧行号 / 列号的新位置（null 是删掉了）。
 * grow：插入行列时，插在合并区域中间的新行列算进去（区域变大）；挪动时要求还连在一起，断开了就取消这个合并
 */
function remapMerges(meta: TableMeta, fr: (r: number) => number | null, fc: (c: number) => number | null, grow: boolean): void {
  if (!meta.merge) return;
  const out: string[] = [];
  const span = (a: number, b: number, f: (i: number) => number | null): [number, number] | null => {
    const v: number[] = [];
    for (let i = a; i <= b; i++) {
      const x = f(i);
      if (x !== null) v.push(x);
    }
    if (!v.length) return null;
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    if (!grow && hi - lo + 1 !== v.length) return null;
    return [lo, hi];
  };
  for (const m of meta.merge) {
    const r = parseRange(m);
    if (!r) continue;
    const rows = span(r.r1, r.r2, fr);
    const cols = span(r.c1, r.c2, fc);
    if (!rows || !cols || (rows[0] === rows[1] && cols[0] === cols[1])) continue;
    out.push(rangeRef({ r1: rows[0], r2: rows[1], c1: cols[0], c2: cols[1] }));
  }
  meta.merge = out;
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
  remapMerges(n.meta, (r) => (r >= i ? r + 1 : r), (c) => c, true);
  return n;
}

/** 删第 r 行；表头和最后一行数据删不掉（至少留一行数据） */
export function deleteRow(t: Table, r: number): Table {
  if (r < 1 || r >= rowCount(t) || rowCount(t) <= 2) return t;
  const n = cloneTable(t);
  n.cells.splice(r, 1);
  remapCells(n.meta, (rr, c) => (rr === r ? null : [rr > r ? rr - 1 : rr, c]));
  remapMerges(n.meta, (rr) => (rr === r ? null : rr > r ? rr - 1 : rr), (c) => c, false);
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
  remapMerges(n.meta, (r) => r, (c) => (c >= i ? c + 1 : c), true);
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
  remapMerges(n.meta, (r) => r, (cc) => (cc === c ? null : cc > c ? cc - 1 : cc), false);
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
  remapMerges(n.meta, (r) => movedIndex(r, from, dest), (c) => c, false);
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
  remapMerges(n.meta, (r) => r, (c) => movedIndex(c, from, dest), false);
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

// ---------- 合并 ----------

export function merges(t: Table): Rect[] {
  return (t.meta.merge ?? []).map(parseRange).filter((r): r is Rect => r !== null && r.r2 < rowCount(t) && r.c2 < colCount(t));
}

/** (r, c) 所在的合并区域 */
export function mergeAt(t: Table, r: number, c: number): Rect | null {
  return merges(t).find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) ?? null;
}

const overlaps = (a: Rect, b: Rect) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;

/**
 * 合并一片格子：碰到的已有合并区域整块并进来（区域跟着扩大）。各格的内容都不动：合并后显示左上角那格，
 * 其余格子的内容原样留在文件里（被盖住、不显示），取消合并就原样回来；没装插件看到的还是原来的表格。只有一格时不动
 */
export function mergeCells(t: Table, rect: Rect): Table {
  let r = { ...rect };
  for (let grew = true; grew; ) {
    grew = false;
    for (const m of merges(t)) {
      if (overlaps(m, r) && (m.r1 < r.r1 || m.c1 < r.c1 || m.r2 > r.r2 || m.c2 > r.c2)) {
        r = { r1: Math.min(r.r1, m.r1), c1: Math.min(r.c1, m.c1), r2: Math.max(r.r2, m.r2), c2: Math.max(r.c2, m.c2) };
        grew = true;
      }
    }
  }
  r = { r1: Math.max(0, r.r1), c1: Math.max(0, r.c1), r2: Math.min(rowCount(t) - 1, r.r2), c2: Math.min(colCount(t) - 1, r.c2) };
  if (r.r1 === r.r2 && r.c1 === r.c2) return t;
  const n = cloneTable(t);
  n.meta.merge = [...merges(t).filter((m) => !overlaps(m, r)).map(rangeRef), rangeRef(r)];
  return n;
}

/** (r, c) 是不是被合并盖住的格子（在合并区域里、但不是左上角） */
export function isCovered(t: Table, r: number, c: number): boolean {
  const m = mergeAt(t, r, c);
  return !!m && (m.r1 !== r || m.c1 !== c);
}

/** 取消 (r, c) 所在的合并：被盖住的格子重新显示出原来的内容 */
export function unmergeAt(t: Table, r: number, c: number): Table {
  const m = mergeAt(t, r, c);
  if (!m) return t;
  const n = cloneTable(t);
  n.meta.merge = merges(t)
    .filter((x) => x !== m && rangeRef(x) !== rangeRef(m))
    .map(rangeRef);
  return n;
}

// ---------- 批量 ----------

/** 清空一片格子的内容 */
export function clearCells(t: Table, cells: readonly { r: number; c: number }[]): Table {
  if (!cells.some(({ r, c }) => t.cells[r]?.[c])) return t;
  const n = cloneTable(t);
  for (const { r, c } of cells) if (n.cells[r]?.[c] !== undefined) n.cells[r][c] = "";
  return n;
}

/** 从 (r, c) 开始贴一片格子（复制来的表格）；超出范围就在后面加行加列 */
export function pasteGrid(t: Table, r: number, c: number, grid: readonly (readonly string[])[]): Table {
  if (!grid.length) return t;
  let n = cloneTable(t);
  const width = Math.max(...grid.map((row) => row.length));
  while (rowCount(n) < r + grid.length) n = insertRow(n, rowCount(n));
  while (colCount(n) < c + width) n = insertCol(n, colCount(n));
  grid.forEach((row, i) => row.forEach((v, j) => (n.cells[r + i][c + j] = v)));
  return n;
}

// ---------- 下拉填充 ----------

export type FillDir = "down" | "up" | "right" | "left";

/**
 * 把选区 src 往 dir 方向填 count 格：每一列（上下填）或每一行（左右填）各自按 fillSeries 推值。
 * 往下 / 往右超出表格就加行加列；往上填不进表头（除非选区本身就从表头开始）
 */
/** copy：一律照抄，不按规律（拖的时候按住 ⌥） */
export function fillRange(t: Table, src: Rect, dir: FillDir, count: number, copy = false): { table: Table; filled: Rect } {
  let n = cloneTable(t);
  const vertical = dir === "down" || dir === "up";
  let cnt = count;
  if (dir === "up") cnt = Math.min(count, src.r1 - (src.r1 > 0 ? 1 : 0));
  if (dir === "left") cnt = Math.min(count, src.c1);
  if (cnt <= 0) return { table: t, filled: src };
  if (dir === "down") while (rowCount(n) < src.r2 + 1 + cnt) n = insertRow(n, rowCount(n));
  if (dir === "right") while (colCount(n) < src.c2 + 1 + cnt) n = insertCol(n, colCount(n));
  if (vertical) {
    for (let c = src.c1; c <= src.c2; c++) {
      const source: string[] = [];
      for (let r = src.r1; r <= src.r2; r++) source.push(n.cells[r][c]);
      const vals = fillSeries(source, cnt, dir === "up", copy);
      vals.forEach((v, k) => (n.cells[dir === "down" ? src.r2 + 1 + k : src.r1 - 1 - k][c] = v));
    }
  } else {
    for (let r = src.r1; r <= src.r2; r++) {
      const source = n.cells[r].slice(src.c1, src.c2 + 1);
      const vals = fillSeries(source, cnt, dir === "left", copy);
      vals.forEach((v, k) => (n.cells[r][dir === "right" ? src.c2 + 1 + k : src.c1 - 1 - k] = v));
    }
  }
  const filled: Rect =
    dir === "down" ? { ...src, r2: src.r2 + cnt } : dir === "up" ? { ...src, r1: src.r1 - cnt } : dir === "right" ? { ...src, c2: src.c2 + cnt } : { ...src, c1: src.c1 - cnt };
  return { table: n, filled };
}

// ---------- 整张表 ----------

/** 这张表自己的样式 / 行距；null 是跟着设置走 */
export function setTableLook(t: Table, look: { style?: TableStyle | null; density?: TableDensity | null }): Table {
  const n = cloneTable(t);
  if (look.style !== undefined) {
    if (look.style) n.meta.style = look.style;
    else delete n.meta.style;
  }
  if (look.density !== undefined) {
    if (look.density) n.meta.density = look.density;
    else delete n.meta.density;
  }
  return n;
}

/** 整表对齐 */
export function alignAll(t: Table, a: Align): Table {
  const n = cloneTable(t);
  n.align = n.align.map(() => a);
  return n;
}

/** 去掉所有底色 */
export function clearAllBg(t: Table): Table {
  if (!t.meta.bg || !Object.keys(t.meta.bg).length) return t;
  const n = cloneTable(t);
  delete n.meta.bg;
  return n;
}

/** 所有列恢复自动宽度 */
export function autoWidthAll(t: Table): Table {
  if (!t.meta.w?.some((x) => x != null)) return t;
  const n = cloneTable(t);
  delete n.meta.w;
  return n;
}

/**
 * 合并格看到的内容：区域里各格不空的内容按顺序排、每格一行，一样的只留一个
 * （几行「Q1」合并成一格还是「Q1」）
 */
export function mergedText(t: Table, m: Rect): string {
  const seen: string[] = [];
  for (let r = m.r1; r <= m.r2; r++)
    for (let c = m.c1; c <= m.c2; c++) {
      const v = t.cells[r]?.[c] ?? "";
      if (v.trim() && !seen.includes(v)) seen.push(v);
    }
  return seen.join("\n");
}

/** 一格（或合并格）看到的内容 */
export function shownText(t: Table, r: number, c: number): string {
  const m = mergeAt(t, r, c);
  return m ? mergedText(t, m) : (t.cells[r]?.[c] ?? "");
}

/**
 * 改一格的文字。改的是合并格时：没改（和看到的一样）就不动；改了就写进左上角、其余格子清空（内容已经合成一段）
 */
export function editCell(t: Table, r: number, c: number, text: string): Table {
  const m = mergeAt(t, r, c);
  if (!m) return setCell(t, r, c, text);
  if (text === mergedText(t, m)) return t;
  const n = cloneTable(t);
  for (let i = m.r1; i <= m.r2; i++) for (let j = m.c1; j <= m.c2; j++) n.cells[i][j] = "";
  n.cells[m.r1][m.c1] = text;
  return n;
}
