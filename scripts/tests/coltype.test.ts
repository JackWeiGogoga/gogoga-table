/**
 * 列类型（注释里的 ty）：日期、数字格式、进度条、多选标签。读写、整理格子、和计算列合计行配合、插删复制列跟着走
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readDate, readNumber, readProgress, reformatDate, reformatNumber, splitTags, writeDate, formatNumber } from "../../src/core/coltype";
import { colKindOf, colTypeOf, deleteCol, duplicateCol, editCell, insertCol, moveCol, normalize, optionsOf, setCalc, setColKind, setColType, setFormula, subTable } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable } from "../../src/core/table";

const SRC = ["| 名 | 金额 | 日期 | 进度 | 标签 |", "| --- | --- | --- | --- | --- |", "| a | 1200 | 2026-1-5 | 60% | 设计，开发 |", "| b | 35.5 | 2026/11/17 | 3/5 | 开发 |"];
const parse = (meta?: string) => parseTable(SRC, meta ? parseMetaLine(meta) : null)!;
const metaOf = (lines: string[]) => lines.find((l) => l.startsWith("<!-- gogoga-table")) ?? "";

test("读数：千分位、货币、百分号、负号、加粗", () => {
  assert.deepEqual(readNumber("¥1,200.50"), { shown: 1200.5, places: 2, pct: false, wrap: "" });
  assert.deepEqual(readNumber("-$3"), { shown: -3, places: 0, pct: false, wrap: "" });
  assert.deepEqual(readNumber("¥-3"), { shown: -3, places: 0, pct: false, wrap: "" });
  assert.deepEqual(readNumber("12.5%"), { shown: 12.5, places: 1, pct: true, wrap: "" });
  assert.deepEqual(readNumber("**42**"), { shown: 42, places: 0, pct: false, wrap: "**" });
  for (const bad of ["", "abc", "12 个", "1.2.3", "--3", "2026-11-17"]) assert.equal(readNumber(bad), null, bad);
});

test("数字格式：千分位、货币、百分比、小数位；打的位数多时不丢", () => {
  assert.equal(reformatNumber("1234567", { t: "num", g: 1 }), "1,234,567");
  assert.equal(reformatNumber("1200", { t: "num", g: 1, u: "¥", d: 2 }), "¥1,200.00");
  assert.equal(reformatNumber("-$1200.5", { t: "num", g: 1, u: "¥", d: 2 }), "-¥1,200.50");
  assert.equal(reformatNumber("1.236", { t: "num", d: 2 }), "1.236");
  assert.equal(reformatNumber("12", { t: "num", p: 1 }), "12%");
  assert.equal(reformatNumber("12%", { t: "num", p: 1, d: 1 }), "12.0%");
  assert.equal(reformatNumber("12%", { t: "num" }), "0.12");
  assert.equal(reformatNumber("**1200**", { t: "num", g: 1 }), "**1,200**");
  assert.equal(reformatNumber("约 100", { t: "num", g: 1 }), "约 100");
  assert.equal(reformatNumber("", { t: "num", g: 1 }), "");
  assert.equal(reformatNumber("-0", { t: "num" }), "0");
  // 已经整理过的再整理一遍不变
  for (const s of ["¥1,200.00", "12.0%", "1,234,567"]) {
    const f = s.startsWith("¥") ? ({ t: "num", g: 1, u: "¥", d: 2 } as const) : s.endsWith("%") ? ({ t: "num", p: 1, d: 1 } as const) : ({ t: "num", g: 1 } as const);
    assert.equal(reformatNumber(s, f), s);
  }
  assert.equal(formatNumber(0.125, { t: "num", p: 1 }, null), "12.5%");
  assert.equal(formatNumber(1234.5, { t: "num", g: 1, u: "$" }, 2), "$1,234.50");
});

test("日期：读、写、统一写法", () => {
  assert.deepEqual(readDate("2026-1-5"), { y: 2026, m: 1, d: 5 });
  assert.deepEqual(readDate("2026年11月17日 上午"), { y: 2026, m: 11, d: 17 });
  assert.deepEqual(readDate("[[2026-11-17]]"), { y: 2026, m: 11, d: 17 });
  assert.deepEqual(readDate("[[17.11.2026]]", (n) => (n === "17.11.2026" ? { y: 2026, m: 11, d: 17 } : null)), { y: 2026, m: 11, d: 17 });
  assert.equal(readDate("2026-02-30"), null);
  assert.equal(readDate("明天"), null);
  assert.equal(writeDate({ y: 2026, m: 1, d: 5 }, undefined), "2026-01-05");
  assert.equal(writeDate({ y: 2026, m: 1, d: 5 }, "slash"), "2026/01/05");
  assert.equal(writeDate({ y: 2026, m: 1, d: 5 }, "link"), "[[2026-01-05]]");
  assert.equal(writeDate({ y: 2026, m: 1, d: 5 }, "link", () => "2026年1月5日"), "[[2026年1月5日]]");
  assert.equal(reformatDate("2026/1/5", undefined), "2026-01-05");
  assert.equal(reformatDate("2026-01-05", "slash"), "2026/01/05");
  assert.equal(reformatDate("2026-01-05 上午", undefined), "2026-01-05 上午");
  assert.equal(reformatDate("2026-1-5", "link"), "2026-1-5");
});

test("进度：百分数、分数、小数", () => {
  assert.equal(readProgress("60%"), 0.6);
  assert.equal(readProgress("3/5"), 0.6);
  assert.equal(readProgress("0.6"), 0.6);
  assert.equal(readProgress("60"), 0.6);
  assert.equal(readProgress("1"), 0.01);
  assert.equal(readProgress("150%"), 1.5);
  assert.equal(readProgress("3/0"), null);
  assert.equal(readProgress("进行中"), null);
});

test("多选：逗号、顿号分开，去重", () => {
  assert.deepEqual(splitTags("设计，开发, 设计 、测试,"), ["设计", "开发", "测试"]);
});

test("注释里的 ty：读写、坏值丢掉", () => {
  const t = parse('<!-- gogoga-table: {"ty":[null,{"t":"num","g":1,"u":"¥","d":2,"x":1},{"t":"date","f":"bad"},{"t":"bar"},{"t":"oops"},{"t":"multi"}]} -->');
  assert.deepEqual(colTypeOf(t, 1), { t: "num", g: 1, u: "¥", d: 2 });
  assert.deepEqual(colTypeOf(t, 2), { t: "date" });
  assert.deepEqual(colTypeOf(t, 3), { t: "bar" });
  assert.equal(colTypeOf(t, 4), null);
  assert.deepEqual(colTypeOf(t, 5), { t: "multi" });
  assert.equal(colTypeOf(parse('<!-- gogoga-table: {"ty":"date"} -->'), 0), null);
});

test("设列类型：格子按类型整理，写进注释；换回普通去掉", () => {
  let t = setColKind(parse(), 1, "num");
  t = setColType(t, 1, { t: "num", g: 1, u: "¥", d: 2 });
  assert.deepEqual(t.cells.map((r) => r[1]), ["金额", "¥1,200.00", "¥35.50"]);
  t = setColKind(t, 2, "date");
  assert.deepEqual(t.cells.map((r) => r[2]), ["日期", "2026-01-05", "2026-11-17"]);
  t = setColKind(t, 4, "multi");
  assert.equal(t.cells[1][4], "设计, 开发");
  assert.deepEqual(optionsOf(t, 4), ["设计", "开发"]);
  assert.equal(colKindOf(t, 4), "multi");
  t = setColKind(t, 3, "bar");
  assert.equal(t.cells[1][3], "60%");
  const meta = metaOf(serializeTable(t));
  assert.match(meta, /"ty":\[null,\{"t":"num","g":1,"u":"¥","d":2\},\{"t":"date"\},\{"t":"bar"\},\{"t":"multi"\}\]/);
  // 多选换成状态：颜色留着；换成普通：opts 去掉
  t = setColKind(t, 4, "status");
  assert.equal(colKindOf(t, 4), "status");
  assert.equal(colTypeOf(t, 4), null);
  t = setColKind(t, 4, "text");
  assert.equal(t.meta.opts, undefined);
  // 编辑后整理
  t = normalize(editCell(t, 2, 1, "8000"));
  assert.equal(t.cells[2][1], "¥8,000.00");
});

test("插删挪复制列：ty 跟着列走；复制列连状态颜色一起", () => {
  let t = setColKind(parse(), 2, "date");
  assert.equal(colKindOf(insertCol(t, 0), 3), "date");
  assert.equal(colKindOf(deleteCol(t, 0), 1), "date");
  assert.equal(colKindOf(moveCol(t, 2, 0), 0), "date");
  t = setColKind(t, 4, "multi");
  const d = duplicateCol(t, 4);
  assert.equal(colKindOf(d, 5), "multi");
  assert.deepEqual(optionsOf(d, 5), optionsOf(t, 4));
  assert.equal(colKindOf(subTable(t, { r1: 0, c1: 2, r2: 2, c2: 4 }), 0), "date");
});

test("计算列按数字格式写结果；只能是普通或数字", () => {
  const src = ["| 单价 | 数量 | 金额 |", "| --- | --- | --- |", "| 1200 | 3 | |", "| 0.5 | 2 | |"];
  let t = setFormula(parseTable(src, null)!, 2, "{单价}*{数量}");
  t = setColType(t, 2, { t: "num", g: 1, u: "¥" });
  t = normalize(t);
  assert.deepEqual([t.cells[1][2], t.cells[2][2]], ["¥3,600", "¥1"]);
  t = normalize(setColType(t, 2, { t: "num", g: 1, u: "¥", d: 2 }));
  assert.equal(t.cells[1][2], "¥3,600.00");
  assert.equal(setColKind(t, 2, "date"), t);
  // 设公式时去掉不合适的类型
  const d = setFormula(setColKind(parseTable(src, null)!, 2, "date"), 2, "{单价}*{数量}");
  assert.equal(colTypeOf(d, 2), null);
  // 百分比的计算列：0.25 写成 25%
  const p = normalize(setColType(setFormula(parseTable(src, null)!, 2, "{数量}/8"), 2, { t: "num", p: 1 }));
  assert.equal(p.cells[1][2], "37.5%");
});

test("合计行按数字格式写", () => {
  let t = setColType(parse(), 1, { t: "num", g: 1, u: "¥", d: 2 });
  t = setCalc(t, 1, "sum");
  assert.equal(t.cells[t.cells.length - 1][1], "¥1,235.50");
  t = setCalc(t, 1, "count");
  assert.equal(t.cells[t.cells.length - 1][1], "2");
});
