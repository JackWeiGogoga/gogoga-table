import assert from "node:assert/strict";
import test from "node:test";
import { calcColumn, deleteRow, duplicateRow, fillRange, hasTotal, insertCol, insertRow, moveCol, moveRow, normalize, optionsOf, setCalc, setCell, setOptionColor, setOptionsCol, sortRows } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable, type Table } from "../../src/core/table";

const T = (rows: string[][]): Table => {
  const line = (r: string[]) => "| " + r.join(" | ") + " |";
  return parseTable([line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)])!;
};
const BASE = () => T([["项目", "金额", "占比"], ["房租", "3,000", "50%"], ["餐饮", "1500.5", "25%"], ["交通", "", "25%"]]);

test("合计：第一次设加一行「合计」，求和带千分位和小数", () => {
  const t = setCalc(BASE(), 1, "sum");
  assert.ok(hasTotal(t));
  assert.deepEqual(t.cells.at(-1), ["合计", "4500.5", ""]);
  assert.deepEqual(t.meta.calc, [null, "sum", null]);
  assert.match(serializeTable(t).at(-1)!, /"calc":\[null,"sum"\]/);
});

test("合计：带格式的数字（**加粗**、==高亮==）也算", () => {
  const t = T([["a", "n"], ["x", "**10**"], ["y", "==5=="], ["z", "`1`"]]);
  assert.equal(calcColumn(setCalc(t, 1, "sum"), 1, "sum"), "16");
});

test("合计方式：平均、计数、最大、最小、百分比", () => {
  const t = BASE();
  assert.equal(calcColumn(setCalc(t, 2, "sum"), 2, "sum"), "100%");
  assert.equal(calcColumn(setCalc(t, 1, "avg"), 1, "avg"), "2250.25");
  assert.equal(calcColumn(setCalc(t, 1, "count"), 1, "count"), "2");
  assert.equal(calcColumn(setCalc(t, 1, "max"), 1, "max"), "3000.0");
  assert.equal(calcColumn(setCalc(t, 1, "min"), 1, "min"), "1500.5");
});

test("改了数据：合计跟着重算；去掉合计后那行留着、不再算", () => {
  let t = setCalc(BASE(), 1, "sum");
  t = normalize(setCell(t, 3, 1, "500"));
  assert.equal(t.cells.at(-1)![1], "5000.5");
  const off = setCalc(t, 1, null);
  assert.equal(hasTotal(off), false);
  assert.equal(off.cells.at(-1)![0], "合计");
  assert.equal(normalize(setCell(off, 1, 1, "1")).cells.at(-1)![1], "5000.5");
});

test("合计行一直在最后：加行加在它前面；挪行、排序、复制行都不动它；删掉它就关掉合计", () => {
  const t = setCalc(BASE(), 1, "sum");
  const added = insertRow(t, t.cells.length);
  assert.deepEqual(added.cells.at(-1)![0], "合计");
  assert.deepEqual(added.cells.at(-2), ["", "", ""]);
  assert.equal(moveRow(t, 1, 99).cells.at(-1)![0], "合计");
  assert.equal(moveRow(t, 4, 1), t);
  assert.equal(sortRows(t, 1, true, true).cells.at(-1)![0], "合计");
  assert.equal(duplicateRow(t, 3).cells.at(-1)![0], "合计");
  assert.equal(hasTotal(deleteRow(t, 4)), false);
  // 往下填充超出数据行：新行加在合计行前面
  const { table } = fillRange(t, { r1: 3, c1: 0, r2: 3, c2: 0 }, "down", 2);
  assert.equal(table.cells.at(-1)![0], "合计");
});

test("插、删、挪列：合计方式跟着列走", () => {
  const t = setCalc(BASE(), 1, "sum");
  assert.deepEqual(insertCol(t, 0).meta.calc, [null, null, "sum", null]);
  assert.deepEqual(moveCol(t, 1, 2).meta.calc, [null, null, "sum"]);
});

test("状态列：现有的值各分一个颜色，新值自动加，改颜色；写回再读出来一样", () => {
  let t = T([["任务", "状态"], ["a", "进行中"], ["b", "已完成"], ["c", "进行中"]]);
  t = setOptionsCol(t, 1, true);
  assert.deepEqual(t.meta.opts?.[1], { 进行中: "blue", 已完成: "green" });
  t = normalize(setCell(t, 3, 1, "暂停"));
  assert.deepEqual(optionsOf(t, 1), ["进行中", "已完成", "暂停"]);
  t = setOptionColor(t, 1, "暂停", "gray");
  const lines = serializeTable(t);
  assert.deepEqual(parseMetaLine(lines.at(-1)!)?.opts, [null, { 进行中: "blue", 已完成: "green", 暂停: "gray" }]);
  assert.equal(setOptionsCol(t, 1, false).meta.opts, undefined);
});
