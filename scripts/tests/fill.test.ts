import assert from "node:assert/strict";
import test from "node:test";
import { fillSeries } from "../../src/core/fill";

test("一个数字：照抄；两个以上：等差接着排", () => {
  assert.deepEqual(fillSeries(["5"], 3), ["5", "5", "5"]);
  assert.deepEqual(fillSeries(["1", "2"], 3), ["3", "4", "5"]);
  assert.deepEqual(fillSeries(["10", "20", "30"], 2), ["40", "50"]);
  assert.deepEqual(fillSeries(["0.1", "0.2"], 2), ["0.3", "0.4"]);
  assert.deepEqual(fillSeries(["3", "1"], 2), ["-1", "-3"]);
});

test("往上填：序列倒着走", () => {
  assert.deepEqual(fillSeries(["5", "6"], 2, true), ["4", "3"]);
  assert.deepEqual(fillSeries(["第3期"], 2, true), ["第2期", "第1期"]);
  assert.deepEqual(fillSeries(["周二"], 2, true), ["周一", "周日"]);
});

test("文字带编号：一格也加 1，几格按差", () => {
  assert.deepEqual(fillSeries(["第1期"], 3), ["第2期", "第3期", "第4期"]);
  assert.deepEqual(fillSeries(["Q1"], 2), ["Q2", "Q3"]);
  assert.deepEqual(fillSeries(["项目 2", "项目 4"], 2), ["项目 6", "项目 8"]);
  assert.deepEqual(fillSeries(["A-009"], 2), ["A-010", "A-011"]);
  assert.deepEqual(fillSeries(["3 号"], 1), ["4 号"]);
});

test("日期：一格按天，几格按间隔，格式不变", () => {
  assert.deepEqual(fillSeries(["2026-11-06"], 3), ["2026-11-07", "2026-11-08", "2026-11-09"]);
  assert.deepEqual(fillSeries(["2026/12/30"], 3), ["2026/12/31", "2027/01/01", "2027/01/02"]);
  assert.deepEqual(fillSeries(["2026-11-01", "2026-11-08"], 2), ["2026-11-15", "2026-11-22"]);
  assert.deepEqual(fillSeries(["2026-2-28"], 1), ["2026-3-1"]);
});

test("周几、月份、天干：按顺序，转一圈回到开头", () => {
  assert.deepEqual(fillSeries(["周六"], 3), ["周日", "周一", "周二"]);
  assert.deepEqual(fillSeries(["十一月"], 2), ["十二月", "一月"]);
  assert.deepEqual(fillSeries(["Mon", "Wed"], 2), ["Fri", "Sun"]);
  assert.deepEqual(fillSeries(["甲"], 2), ["乙", "丙"]);
  assert.deepEqual(fillSeries(["January"], 1), ["February"]);
});

test("别的：循环照抄", () => {
  assert.deepEqual(fillSeries(["是"], 2), ["是", "是"]);
  assert.deepEqual(fillSeries(["红", "绿"], 3), ["红", "绿", "红"]);
  assert.deepEqual(fillSeries(["红", "绿"], 3, true), ["绿", "红", "绿"]);
  // 编号不等差：按循环照抄
  assert.deepEqual(fillSeries(["第1期", "第5期", "第6期"], 2), ["第1期", "第5期"]);
  // 前缀不同：循环照抄
  assert.deepEqual(fillSeries(["a1", "b2"], 2), ["a1", "b2"]);
  assert.deepEqual(fillSeries([""], 2), ["", ""]);
});

import { fillRange } from "../../src/core/ops";
import { parseTable } from "../../src/core/table";

const T = () =>
  parseTable(["| 期 | 日期 | 备注 |", "| --- | --- | --- |", "| 第1期 | 2026-11-06 | 是 |", "| 第2期 | 2026-11-13 |  |", "|  |  |  |"])!;

test("往下填：每列各推各的，超出表格就加行", () => {
  const { table, filled } = fillRange(T(), { r1: 1, c1: 0, r2: 2, c2: 1 }, "down", 3);
  assert.deepEqual(table.cells.slice(3).map((r) => r.slice(0, 2)), [["第3期", "2026-11-20"], ["第4期", "2026-11-27"], ["第5期", "2026-12-04"]]);
  assert.equal(table.cells.length, 6);
  assert.deepEqual(filled, { r1: 1, c1: 0, r2: 5, c2: 1 });
});

test("往右填：按行推，超出就加列", () => {
  const { table } = fillRange(T(), { r1: 1, c1: 0, r2: 1, c2: 0 }, "right", 3);
  assert.deepEqual(table.cells[1], ["第1期", "第2期", "第3期", "第4期"]);
  assert.equal(table.align.length, 4);
});

test("往上填：不进表头", () => {
  const { table, filled } = fillRange(T(), { r1: 2, c1: 0, r2: 2, c2: 0 }, "up", 5);
  assert.equal(table.cells[0][0], "期");
  assert.equal(table.cells[1][0], "第1期");
  assert.deepEqual(filled, { r1: 1, c1: 0, r2: 2, c2: 0 });
});

import { alignAll, autoWidthAll, clearAllBg, setTableLook, setWidth, setBg } from "../../src/core/ops";
import { parseMetaLine, serializeTable } from "../../src/core/table";

test("整张表：样式、行距写进注释，null 去掉；整表对齐、清底色、列宽全自动", () => {
  let t = setTableLook(T(), { style: "zebra", density: "compact" });
  assert.match(serializeTable(t).at(-1)!, /"style":"zebra","density":"compact"/);
  t = setTableLook(t, { style: null });
  assert.equal(t.meta.style, undefined);
  assert.equal(t.meta.density, "compact");
  assert.deepEqual(alignAll(t, "center").align, ["center", "center", "center"]);
  t = setBg(setWidth(t, 1, 150), [{ r: 1, c: 1 }], "red");
  assert.equal(clearAllBg(t).meta.bg, undefined);
  assert.equal(autoWidthAll(t).meta.w, undefined);
  assert.deepEqual(parseMetaLine('<!-- gogoga-table: {"style":"fancy","density":"compact"} -->'), { density: "compact" });
});
