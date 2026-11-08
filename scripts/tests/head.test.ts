/**
 * 多行表头（注释里的 head）和冻结标题列（freeze）：读写、插删行跟着加减、排序合计不算表头、
 * 合并不跨表头分界线；冻结只跟着标题列走
 */
import assert from "node:assert/strict";
import test from "node:test";
import { findTables } from "../../src/core/find";
import {
  calcColumn,
  canSetHead,
  canSortRows,
  deleteRow,
  fillRange,
  headRows,
  insertRow,
  mergeCells,
  moveRow,
  setTableLook,
  sortRows,
} from "../../src/core/ops";
import { parseMetaLine, parseRange, parseTable, serializeBlock, type Table } from "../../src/core/table";

const SRC = `| 产品 | 第一季度 | 第一季度 |
| --- | --- | --- |
| 产品 | 1月 | 2月 |
| 乙 | 3 | 20 |
| 甲 | 1 | 10 |
<!-- gogoga-table: {"head":2,"merge":["B1:C1"]} -->`;
const load = (md = SRC): Table => {
  const lines = md.split("\n");
  const b = findTables(lines)[0];
  return parseTable(lines.slice(b.start, b.end), b.meta)!;
};
const R = (s: string) => parseRange(s)!;

test("读写：head 认 2 和 3，别的值丢掉；写回原样带着", () => {
  const t = load();
  assert.equal(headRows(t), 2);
  assert.ok(serializeBlock(t, []).join("\n").includes('"head":2'));
  assert.equal(parseMetaLine('<!-- gogoga-table: {"head":5} -->')?.head, undefined);
  assert.equal(parseMetaLine('<!-- gogoga-table: {"head":"2"} -->')?.head, undefined);
  assert.equal(parseMetaLine('<!-- gogoga-table: {"head":3,"freeze":1} -->')?.head, 3);
  assert.equal(parseMetaLine('<!-- gogoga-table: {"freeze":true} -->')?.freeze, undefined);
});

test("表头行数至少留一行数据", () => {
  const t = load("| A |\n| --- |\n| a |\n<!-- gogoga-table: {\"head\":3} -->");
  assert.equal(headRows(t), 1);
  assert.equal(canSetHead(load(), 3), true);
  assert.equal(canSetHead(load(), 4), false);
});

test("在表头区里插行、删行：表头跟着加减；在正文里不变", () => {
  const t = load();
  assert.equal(headRows(insertRow(t, 1)), 3);
  assert.equal(headRows(insertRow(t, 2)), 2);
  assert.equal(headRows(insertRow(t, 4)), 2);
  assert.equal(headRows(deleteRow(t, 1)), 1);
  assert.equal(deleteRow(t, 1).meta.head, undefined);
  assert.equal(headRows(deleteRow(t, 3)), 2);
});

test("正文只剩一行时删不掉；第一行表头删不掉", () => {
  const t = deleteRow(load(), 3);
  assert.equal(deleteRow(t, 2), t);
  assert.equal(deleteRow(t, 0), t);
});

test("移动行只在正文里：表头的行不动，正文的行也挪不进表头", () => {
  const t = load();
  assert.equal(moveRow(t, 1, 3), t);
  const moved = moveRow(t, 3, 0);
  assert.equal(moved.cells[2][0], "甲");
  assert.equal(moved.cells[1][1], "1月");
});

test("排序、合计都不算表头的行", () => {
  const t = load();
  assert.ok(canSortRows(t), "表头里的合并不妨碍排序");
  const s = sortRows(t, 0, false);
  assert.deepEqual(s.cells.map((r) => r[0]), ["产品", "产品", "甲", "乙"]);
  // calcColumn 算的是合计行上面的数据行（最后一行是合计行）：这里只有「乙」那一行，表头的「2月」不算
  assert.equal(calcColumn(t, 2, "sum"), "20");
  assert.equal(calcColumn(t, 1, "count"), "1");
});

test("合并不跨表头和正文的分界线；设表头行数时有跨线的合并就不让设", () => {
  const t = load();
  assert.equal(mergeCells(t, R("A2:A3")), t);
  assert.notEqual(mergeCells(t, R("A1:A2")), t);
  const one = setTableLook(t, { head: 1 });
  const m = mergeCells(one, R("A2:A3"));
  assert.equal(canSetHead(m, 2), false);
  assert.equal(setTableLook(m, { head: 2 }), m);
});

test("往上填充不填进表头", () => {
  const t = load();
  const { filled } = fillRange(t, { r1: 3, c1: 1, r2: 3, c2: 1 }, "up", 5);
  assert.equal(filled.r1, 2);
});

test("冻结是标题列的选项：标题列开着才能冻结，关掉标题列冻结也去掉", () => {
  const t = load();
  assert.equal(setTableLook(t, { freeze: true }).meta.freeze, undefined);
  const on = setTableLook(setTableLook(t, { headerCol: true }), { freeze: true });
  assert.equal(on.meta.freeze, 1);
  assert.equal(setTableLook(on, { headerCol: false }).meta.freeze, undefined);
  assert.equal(setTableLook(on, { freeze: false }).meta.freeze, undefined);
});
