/**
 * 大表格压测（核心层，不碰界面）：2000 行 × 20 列、50 个合并区、500 格底色、一列合计、一列状态，
 * 外加一篇有 200 张表的长笔记。每项量几次取中位数，打印耗时表。
 * 上限放得很宽（机器慢也不该误报），用来拦住「改出成倍变慢的写法」，不是比快慢
 */
import assert from "node:assert/strict";
import test from "node:test";
import { findTables } from "../../src/core/find";
import {
  deleteRow,
  editCell,
  fillRange,
  insertCol,
  insertRow,
  isCovered,
  mergeCells,
  merges,
  moveRow,
  normalize,
  pasteGrid,
  setBg,
  sortRows,
} from "../../src/core/ops";
import { cellRef, parseTable, serializeBlock, serializeTable, type Table } from "../../src/core/table";
import { fromTSV, toTSV } from "../../src/core/clipboard";

const ROWS = 2000;
const COLS = 20;

function bigMarkdown(rows = ROWS, cols = COLS): string {
  const head = "| " + Array.from({ length: cols }, (_, c) => (c === 0 ? "名称" : c === cols - 1 ? "状态" : `列${c}`)).join(" | ") + " |";
  const delim = "|" + " --- |".repeat(cols);
  const states = ["进行中", "已完成", "待开始", "暂停"];
  const body: string[] = [];
  for (let r = 1; r < rows; r++) {
    const cells = Array.from({ length: cols }, (_, c) =>
      c === 0 ? `项目 ${r}` : c === cols - 1 ? states[r % 4] : c % 3 === 0 ? `**${(r * 37 + c * 11) % 1000}**` : String((r * 37 + c * 11) % 1000),
    );
    body.push("| " + cells.join(" | ") + " |");
  }
  const bg: Record<string, string> = {};
  for (let i = 0; i < 500; i++) bg[cellRef(1 + ((i * 7) % (rows - 2)), 1 + (i % (cols - 2)))] = "yellow";
  const merge = Array.from({ length: 50 }, (_, i) => `B${3 + i * 30}:C${4 + i * 30}`);
  const calc = Array.from({ length: cols }, (_, c) => (c === 1 ? "sum" : null));
  const opts = Array.from({ length: cols }, (_, c) => (c === cols - 1 ? {} : null));
  const meta = JSON.stringify({ bg, merge, calc, opts, headerCol: true });
  return [head, delim, ...body, `<!-- gogoga-table: ${meta} -->`].join("\n");
}

function load(md: string): Table {
  const lines = md.split("\n");
  const b = findTables(lines)[0];
  return normalize(parseTable(lines.slice(b.start, b.end), b.meta)!);
}

const rows: [string, number, number][] = [];
/** 跑 n 次取中位数（毫秒），记进耗时表并检查上限 */
function time(name: string, limit: number, fn: () => unknown, n = 5): void {
  const ts: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    fn();
    ts.push(performance.now() - s);
  }
  ts.sort((a, b) => a - b);
  const ms = ts[Math.floor(n / 2)];
  rows.push([name, ms, limit]);
  assert.ok(ms < limit, `${name}：${ms.toFixed(1)}ms，超过上限 ${limit}ms`);
}

const MD = bigMarkdown();
const T = load(MD);

test("压测数据本身是对的", () => {
  assert.equal(T.cells.length, ROWS);
  assert.equal(T.cells[0].length, COLS);
  assert.equal(merges(T).length, 50);
  assert.equal(Object.keys(T.meta.opts![COLS - 1]!).length, 4);
});

test("2000×20 大表：解析、写回", () => {
  time("解析（找表 + parse + 合计/状态）", 300, () => load(MD));
  time("写回整张表（serializeBlock）", 300, () => serializeBlock(T, []));
  time("写回往返结果不变", 600, () => assert.equal(serializeTable(load(serializeTable(T).join("\n"))).join("\n"), serializeTable(T).join("\n")), 3);
});

test("2000×20 大表：常用改动（每次都要 normalize，和编辑器一样）", () => {
  time("改一格", 100, () => normalize(editCell(T, 1000, 5, "42")));
  time("在中间插入一行", 100, () => normalize(insertRow(T, 1000)));
  time("删除一行", 100, () => normalize(deleteRow(T, 1000)));
  time("插入一列", 150, () => normalize(insertCol(T, 10)));
  time("把一行从头挪到尾", 100, () => normalize(moveRow(T, 5, ROWS - 2)));
  // 正文里有合并区的表不让排序（会原样返回），排序在去掉合并的表上量
  const plain = { ...T, meta: { ...T.meta, merge: undefined } };
  assert.notEqual(sortRows(plain, 2, true), plain, "去掉合并后应能排序");
  time("按数字列排序", 300, () => normalize(sortRows(plain, 2, true)));
  time("按文字列排序", 300, () => normalize(sortRows(plain, 0, false)));
  time("合并一片格子（已有 50 个合并区）", 100, () => normalize(mergeCells(T, { r1: 1700, c1: 4, r2: 1705, c2: 8 })));
  const range = Array.from({ length: 500 }, (_, i) => ({ r: 100 + Math.floor(i / 10), c: 5 + (i % 10) }));
  time("给 500 格上底色", 150, () => normalize(setBg(T, range, "blue")));
  time("往下填充 500 行", 200, () => normalize(fillRange(T, { r1: 1, c1: 3, r2: 2, c2: 3 }, "down", 500).table));
});

test("2000×20 大表：复制粘贴", () => {
  const grid = T.cells.slice(1, 501).map((r) => r.slice(0, 10));
  const tsv = toTSV(grid);
  time("复制 500×10 成 TSV", 100, () => toTSV(grid));
  time("解析 500×10 的 TSV", 100, () => fromTSV(tsv));
  time("粘贴 500×10", 200, () => normalize(pasteGrid(T, 1000, 5, grid)));
});

test("2000×20 大表：逐格判断合并（编辑器画表时每格都要问）", () => {
  // 编辑器渲染时每一格都要知道「在不在合并区里」：这里量 4 万次查询的总时间
  time("4 万次 isCovered", 400, () => {
    let k = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isCovered(T, r, c)) k++;
    return k;
  }, 3);
});

test("长笔记：200 张 30×6 的表，夹着正文和代码块", () => {
  const parts: string[] = ["---", "type: note", "---", "# 长笔记"];
  for (let i = 0; i < 200; i++) {
    parts.push("", `## 第 ${i} 节`, "", "一段正文，说明下面这张表。".repeat(3), "");
    if (i % 10 === 0) parts.push("```", "| 代码块里的 | 不是表 |", "| --- | --- |", "```", "");
    parts.push(bigMarkdown(30, 6), "");
  }
  const lines = parts.join("\n").split("\n");
  let n = 0;
  time("找出全部表格", 200, () => (n = findTables(lines).length));
  assert.equal(n, 200);
});

test.after(() => {
  const w = Math.max(...rows.map((r) => r[0].length));
  console.log("\n大表格压测（中位数，毫秒）");
  for (const [name, ms, limit] of rows) console.log(`  ${name.padEnd(w)}  ${ms.toFixed(1).padStart(7)}  / 上限 ${limit}`);
});
