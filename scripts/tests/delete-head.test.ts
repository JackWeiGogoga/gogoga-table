import assert from "node:assert/strict";
import test from "node:test";
import { deleteRow, headRows, setCalc } from "../../src/core/ops";
import { parseTable, type Table } from "../../src/core/table";

const T = (rows: string[][]): Table => {
  const line = (r: string[]) => "| " + r.join(" | ") + " |";
  return parseTable([line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)])!;
};

test("#17 删掉唯一的表头行：下一行变成表头，坐标跟着往上挪", () => {
  const t = T([["", ""], ["名称", "数量"], ["苹果", "3"], ["梨", "5"]]);
  t.meta.bg = { A1: "red", B3: "yellow" };
  t.meta.merge = ["A3:B4"];
  const n = deleteRow(t, 0);
  assert.notEqual(n, t);
  assert.deepEqual(n.cells, [["名称", "数量"], ["苹果", "3"], ["梨", "5"]]);
  assert.equal(headRows(n), 1);
  // 原来第 1 行（表头）的底色没了，B3 变成 B2；合并 A3:B4 变成 A2:B3
  assert.deepEqual(n.meta.bg, { B2: "yellow" });
  assert.deepEqual(n.meta.merge, ["A2:B3"]);
});

test("#17 顶上来的那一行原来和下面合并着：合并拆开（不横跨表头和正文），字留着", () => {
  const t = T([["空", ""], ["甲", "乙"], ["丙", "丁"]]);
  t.meta.merge = ["A2:A3"];
  const n = deleteRow(t, 0);
  assert.deepEqual(n.cells, [["甲", "乙"], ["丙", "丁"]]);
  assert.equal(n.meta.merge, undefined);
});

test("#17 正文不到两行时不删（和删正文的行一样，正文至少留一行，合计行不算）", () => {
  const one = T([["名称", "数量"], ["苹果", "3"]]);
  assert.equal(deleteRow(one, 0), one);
  const withTotal = setCalc(T([["名称", "数量"], ["苹果", "3"]]), 1, "sum");
  assert.equal(deleteRow(withTotal, 0), withTotal);
  const two = setCalc(T([["名称", "数量"], ["苹果", "3"], ["梨", "5"]]), 1, "sum");
  assert.deepEqual(deleteRow(two, 0).cells.map((r) => r[0]), ["苹果", "梨", "合计"]);
});

test("多行表头里删第一行：表头少一行", () => {
  const t = T([["a", "b"], ["c", "d"], ["e", "f"]]);
  t.meta.head = 2;
  const n = deleteRow(t, 0);
  assert.deepEqual(n.cells, [["c", "d"], ["e", "f"]]);
  assert.equal(headRows(n), 1);
});
