/**
 * 垂直对齐（注释里的 va）：读写、坏值丢掉、顶端不写、插删挪列和复制列跟着走、整表设置
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deleteCol, duplicateCol, insertCol, moveCol, setVAlign, vAlignAll, vAlignOf } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable } from "../../src/core/table";

const SRC = ["| a | b | c |", "| --- | --- | --- |", "| 1 | 2 | 3 |"];
const parse = (meta?: string) => parseTable(SRC, meta ? parseMetaLine(meta) : null)!;
const metaOf = (lines: string[]) => lines.find((l) => l.startsWith("<!-- gogoga-table")) ?? "";

test("设垂直对齐写进 va，顶端不写", () => {
  let t = setVAlign(parse(), 1, "middle");
  assert.equal(vAlignOf(t, 1), "middle");
  assert.match(metaOf(serializeTable(t)), /"va":\[null,"middle"\]/);
  t = setVAlign(t, 1, null);
  assert.equal(metaOf(serializeTable(t)), "");
});

test("读注释：认识的值留下，坏值当顶端", () => {
  const t = parse('<!-- gogoga-table: {"va":["bottom","oops",3,"middle"]} -->');
  assert.deepEqual([0, 1, 2].map((c) => vAlignOf(t, c)), ["bottom", null, null]);
  assert.equal(vAlignOf(t, 3), "middle");
  assert.equal(vAlignOf(parse('<!-- gogoga-table: {"va":"middle"} -->'), 0), null);
});

test("插入、删除、挪动、复制列：va 跟着列走", () => {
  const t = setVAlign(parse(), 1, "bottom");
  assert.equal(vAlignOf(insertCol(t, 0), 2), "bottom");
  assert.equal(vAlignOf(insertCol(t, 0), 1), null);
  assert.equal(vAlignOf(deleteCol(t, 0), 0), "bottom");
  assert.equal(vAlignOf(moveCol(t, 1, 2), 2), "bottom");
  const d = duplicateCol(t, 1);
  assert.deepEqual([1, 2].map((c) => vAlignOf(d, c)), ["bottom", "bottom"]);
});

test("整表垂直对齐", () => {
  const t = vAlignAll(parse(), "middle");
  assert.match(metaOf(serializeTable(t)), /"va":\["middle","middle","middle"\]/);
  assert.equal(metaOf(serializeTable(vAlignAll(t, null))), "");
});
