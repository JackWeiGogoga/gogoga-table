/**
 * 「这张表想左右滑动」标记（注释里的 wide）：拖列宽把表格拉得比正文宽时写上，「列宽按比例缩放」不缩它；
 * 读注释只认 1；去掉所有列宽（自动列宽）时一起去掉
 */
import assert from "node:assert/strict";
import test from "node:test";
import { autoWidthAll, setWide, setWidth } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable } from "../../src/core/table";

const SRC = ["| a | b |", "| --- | --- |", "| 1 | 2 |"];
const parse = (meta?: string) => parseTable(SRC, meta ? parseMetaLine(meta) : null)!;
const metaOf = (lines: string[]) => lines.find((l) => l.startsWith("<!-- gogoga-table")) ?? "";

test("设上、去掉：写进注释 wide:1，去掉就不写", () => {
  const t = setWide(setWidth(parse(), 0, 900), true);
  assert.equal(t.meta.wide, 1);
  assert.match(metaOf(serializeTable(t)), /"wide":1/);
  assert.doesNotMatch(metaOf(serializeTable(setWide(t, false))), /wide/);
  assert.equal(setWide(t, true), t);
});

test("读注释：只认 1，别的值丢掉", () => {
  assert.equal(parse('<!-- gogoga-table: {"w":[900],"wide":1} -->').meta.wide, 1);
  assert.equal(parse('<!-- gogoga-table: {"w":[900],"wide":true} -->').meta.wide, undefined);
  assert.equal(parse('<!-- gogoga-table: {"w":[900],"wide":2} -->').meta.wide, undefined);
});

test("自动列宽（去掉所有列宽）：标记一起去掉", () => {
  const t = autoWidthAll(setWide(setWidth(parse(), 0, 900), true));
  assert.equal(t.meta.wide, undefined);
  assert.equal(metaOf(serializeTable(t)), "");
});
