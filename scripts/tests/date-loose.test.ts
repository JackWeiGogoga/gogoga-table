/**
 * 日期列：手打的各种写法读成日子（设置「日期列自动识别日期写法」）；按日期排序时读不出的排在日期后面
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseLooseDate } from "../../src/core/coltype";
import { setColType, sortRows } from "../../src/core/ops";
import { parseTable } from "../../src/core/table";

const today = { y: 2026, m: 11, d: 18 };
const iso = (s: string) => {
  const v = parseLooseDate(s, today);
  return v ? `${v.y}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}` : null;
};

test("带年份的写法", () => {
  assert.equal(iso("2026-1-5"), "2026-01-05");
  assert.equal(iso("2026/1/5"), "2026-01-05");
  assert.equal(iso("2026.1.5"), "2026-01-05");
  assert.equal(iso("2026年1月5日"), "2026-01-05");
  assert.equal(iso("2026 年 1 月 5 号"), "2026-01-05");
  assert.equal(iso(" 20260105 "), "2026-01-05");
});

test("没写年算今年", () => {
  assert.equal(iso("1/5"), "2026-01-05");
  assert.equal(iso("11-17"), "2026-11-17");
  assert.equal(iso("1.5"), "2026-01-05");
  assert.equal(iso("1月5日"), "2026-01-05");
  assert.equal(iso("12月31号"), "2026-12-31");
});

test("今天、明天、昨天，跨月跨年", () => {
  assert.equal(iso("今天"), "2026-11-18");
  assert.equal(iso("明天"), "2026-11-19");
  assert.equal(iso("昨天"), "2026-11-17");
  assert.equal(iso("后天"), "2026-11-20");
  assert.equal(iso("前天"), "2026-11-16");
  assert.equal(iso("Today"), "2026-11-18");
  assert.equal(iso("tomorrow"), "2026-11-19");
  assert.deepEqual(parseLooseDate("明天", { y: 2026, m: 12, d: 31 }), { y: 2027, m: 1, d: 1 });
  assert.deepEqual(parseLooseDate("昨天", { y: 2024, m: 3, d: 1 }), { y: 2024, m: 2, d: 29 });
});

test("读不出的：不存在的日子、带别的字、两位数年份、普通文字", () => {
  for (const s of ["2026-02-30", "2/30", "13/1", "26-1-5", "2026-1-5 上午", "待定", "Q1", "下周一", "123", "2026", "", "[[2026-01-05]]", "1/5/2026"]) {
    assert.equal(parseLooseDate(s, today), null, s);
  }
});

const line = (r: string[]) => `| ${r.join(" | ")} |`;
const table = (dates: string[]) =>
  setColType(parseTable([line(["名", "日期"]), line(["---", "---"]), ...dates.map((d, i) => line([String.fromCharCode(97 + i), d]))])!, 1, { t: "date" });
const col = (t: ReturnType<typeof table>) => t.cells.slice(1).map((r) => r[1]);

test("日期列排序：日期按时间，读不出的跟在后面，空的最后；倒序时读不出的和空的还在后面", () => {
  const t = table(["待定", "2026-03-01", "", "2026-01-05", "2026-02-30", "2025-12-31"]);
  assert.deepEqual(col(sortRows(t, 1, false)), ["2025-12-31", "2026-01-05", "2026-03-01", "2026-02-30", "待定", ""]);
  assert.deepEqual(col(sortRows(t, 1, true)), ["2026-03-01", "2026-01-05", "2025-12-31", "待定", "2026-02-30", ""]);
});

test("日期列排序：年月日、日记链接也按日子排（链接名用日记插件的格式读）", () => {
  const t = table(["[[18.11.2025]]", "2026年1月5日", "[[2026-02-01]]"]);
  const parse = (n: string) => (/^(\d\d)\.(\d\d)\.(\d{4})$/.exec(n) ? { y: +n.slice(6), m: +n.slice(3, 5), d: +n.slice(0, 2) } : null);
  assert.deepEqual(col(sortRows(t, 1, false, false, parse)), ["[[18.11.2025]]", "2026年1月5日", "[[2026-02-01]]"]);
  // 不给日记格式：[[18.11.2025]] 读不出，排在后面
  assert.deepEqual(col(sortRows(t, 1, false)), ["2026年1月5日", "[[2026-02-01]]", "[[18.11.2025]]"]);
});

test("不是日期列：排序和以前一样", () => {
  const t = parseTable([line(["名", "x"]), line(["---", "---"]), line(["a", "待定"]), line(["b", "2026-01-05"])])!;
  assert.deepEqual(sortRows(t, 1, false).cells.slice(1).map((r) => r[1]), ["2026-01-05", "待定"]);
});
