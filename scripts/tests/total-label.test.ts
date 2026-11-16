/**
 * 合计行第一格的名字（B 站 lucent2019）：各列都是求和叫「合计」，混着平均、最大、计数叫「统计」；
 * 只改自动写上的名字，用户自己改过的不动；第一列自己有合计时不写名字
 */
import assert from "node:assert/strict";
import test from "node:test";
import { editCell, normalize, rowCount, setCalc, totalsAllSum } from "../../src/core/ops";
import { parseTable, type Table } from "../../src/core/table";

const T = (rows: string[][]): Table => {
  const line = (r: string[]) => "| " + r.join(" | ") + " |";
  return parseTable([line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)])!;
};
const base = () => T([["客户", "单价", "金额"], ["张三", "12", "120"], ["李四", "44", "268"]]);
const L = { sum: "合计", mixed: "统计" };
const label = (t: Table) => t.cells[rowCount(t) - 1][0];

test("只有求和：叫合计；加一列取最大：改叫统计；去掉最大：又叫合计", () => {
  let t = setCalc(base(), 2, "sum", L);
  assert.equal(label(t), "合计");
  assert.equal(totalsAllSum(t), true);
  t = setCalc(t, 1, "max", L);
  assert.equal(label(t), "统计");
  assert.equal(totalsAllSum(t), false);
  assert.deepEqual(t.cells[rowCount(t) - 1], ["统计", "44", "388"]);
  t = setCalc(t, 1, null, L);
  assert.equal(label(t), "合计");
});

test("第一次设的就不是求和：直接叫统计", () => {
  assert.equal(label(setCalc(base(), 1, "avg", L)), "统计");
});

test("用户自己改过名字：不再动它", () => {
  let t = setCalc(base(), 2, "sum", L);
  t = normalize(editCell(t, rowCount(t) - 1, 0, "本月小计"));
  t = setCalc(t, 1, "max", L);
  assert.equal(label(t), "本月小计");
});

test("英文界面：Total / Summary，中英文自动名字互相认得", () => {
  const E = { sum: "Total", mixed: "Summary" };
  let t = setCalc(base(), 2, "sum", E);
  assert.equal(label(t), "Total");
  t = setCalc(t, 1, "count", E);
  assert.equal(label(t), "Summary");
  t = setCalc(t, 1, null, L);
  assert.equal(label(t), "合计");
});

test("第一列自己有合计：不写名字；旧的单个字符串参数照样能用", () => {
  const t = setCalc(base(), 0, "count", L);
  assert.equal(label(t), "2");
  assert.equal(label(setCalc(base(), 2, "sum", "Total")), "Total");
});
