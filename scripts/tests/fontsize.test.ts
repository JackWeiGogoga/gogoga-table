/**
 * 文字大小（注释里的 fs 整表、fz 每格）：读写、坏值丢掉、正常（1）不写、插删挪行列和复制行列跟着走、截取一片时带上
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deleteCol, deleteRow, duplicateCol, duplicateRow, fontSizeOf, insertCol, insertRow, moveRow, setFontSize, setTableFontSize, subTable } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable } from "../../src/core/table";

const SRC = ["| a | b |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"];
const parse = (meta?: string) => parseTable(SRC, meta ? parseMetaLine(meta) : null)!;
const metaOf = (lines: string[]) => lines.find((l) => l.startsWith("<!-- gogoga-table")) ?? "";

test("设格子文字大小写进 fz，正常不写", () => {
  let t = setFontSize(parse(), [{ r: 1, c: 1 }, { r: 2, c: 0 }], 0.85);
  assert.equal(fontSizeOf(t, 1, 1), 0.85);
  assert.match(metaOf(serializeTable(t)), /"fz":\{"B2":0.85,"A3":0.85\}/);
  t = setFontSize(t, [{ r: 1, c: 1 }, { r: 2, c: 0 }], null);
  assert.equal(metaOf(serializeTable(t)), "");
  assert.equal(metaOf(serializeTable(setFontSize(parse(), [{ r: 1, c: 1 }], 1))), "");
});

test("整表文字大小写进 fs，正常不写", () => {
  const t = setTableFontSize(parse(), 1.15);
  assert.match(metaOf(serializeTable(t)), /"fs":1.15/);
  assert.equal(metaOf(serializeTable(setTableFontSize(t, null))), "");
  assert.equal(setTableFontSize(t, 1.15), t);
});

test("读注释：0.5～3 的倍数都认（别人手写、改过的版本写的也认），坏值丢掉", () => {
  const t = parse('<!-- gogoga-table: {"fs":0.5,"fz":{"B2":3,"A2":"大","A3":9,"B3":1,"ZZ":0.8,"x1":0.8}} -->');
  assert.equal(t.meta.fs, 0.5);
  assert.deepEqual(t.meta.fz, { B2: 3 });
  assert.equal(parse('<!-- gogoga-table: {"fs":1} -->').meta.fs, undefined);
  assert.equal(parse('<!-- gogoga-table: {"fs":"1.2"} -->').meta.fs, undefined);
  assert.equal(parse('<!-- gogoga-table: {"fz":[0.8]} -->').meta.fz, undefined);
});

test("插入、删除、挪动行列：文字大小跟着格子走", () => {
  const t = setFontSize(parse(), [{ r: 1, c: 1 }], 0.75);
  assert.equal(fontSizeOf(insertRow(t, 1), 2, 1), 0.75);
  assert.equal(fontSizeOf(insertCol(t, 0), 1, 2), 0.75);
  assert.equal(fontSizeOf(deleteRow(t, 1), 1, 1), null);
  assert.deepEqual(deleteCol(t, 1).meta.fz, {});
  assert.equal(fontSizeOf(moveRow(t, 1, 2), 2, 1), 0.75);
});

test("复制行、复制列：文字大小一起复制", () => {
  const t = setFontSize(parse(), [{ r: 1, c: 1 }], 1.3);
  const r = duplicateRow(t, 1);
  assert.deepEqual([fontSizeOf(r, 1, 1), fontSizeOf(r, 2, 1)], [1.3, 1.3]);
  const c = duplicateCol(t, 1);
  assert.deepEqual([fontSizeOf(c, 1, 1), fontSizeOf(c, 1, 2)], [1.3, 1.3]);
});

test("截取一片（复制一部分表格）：文字大小按新坐标带上", () => {
  const t = setTableFontSize(setFontSize(parse(), [{ r: 2, c: 1 }], 0.85), 1.15);
  const s = subTable(t, { r1: 1, c1: 1, r2: 2, c2: 1 });
  assert.deepEqual(s.meta.fz, { A2: 0.85 });
  assert.equal(s.meta.fs, 1.15);
});
