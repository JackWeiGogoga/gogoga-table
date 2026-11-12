import assert from "node:assert/strict";
import test from "node:test";
import { subTable } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable, type Table } from "../../src/core/table";
import { sourceAttr, sourceFromHTML } from "../../src/core/clipboard";

const SRC = [
  "| 项目 | 金额 | 状态 | 备注 |",
  "| --- | ---: | :---: | --- |",
  "| 房租 | 3000 | 已付 | a |",
  "| 餐饮 | 1500 | 待付 | b |",
  "| 交通 | 200 | 已付 | c |",
  "| 合计 | 4700 |  |  |",
];
const META = '<!-- gogoga-table: {"w":[120,80,null,200],"bg":{"A1":"blue","B3":"yellow","D5":"red"},"fg":{"C4":"red"},"merge":["C3:D4","A2:A3"],"opts":[null,null,{"已付":"blue","待付":"green"}],"calc":[null,"sum"],"headerCol":true,"freeze":1,"style":"zebra","x":1} -->';
const T = (): Table => parseTable(SRC, parseMetaLine(META))!;

test("整张表：原样（包括不认识的键）", () => {
  assert.deepEqual(serializeTable(subTable(T(), { r1: 0, c1: 0, r2: 5, c2: 3 })), serializeTable(T()));
});

test("中间一片（不含表头、不含第一列）：第一行当表头，颜色坐标平移，列宽、对齐、状态列只取这几列", () => {
  const s = subTable(T(), { r1: 2, c1: 1, r2: 4, c2: 2 });
  assert.deepEqual(s.cells, [["1500", "待付"], ["200", "已付"], ["4700", ""]]);
  assert.deepEqual(s.align, ["right", "center"]);
  assert.deepEqual(s.meta.w, [80, null]);
  assert.deepEqual(s.meta.bg, { A1: "yellow" });
  assert.deepEqual(s.meta.fg, { B2: "red" });
  assert.deepEqual(s.meta.opts, [null, { 已付: "blue", 待付: "green" }]);
  assert.equal(s.meta.headerCol, undefined, "不含第一列：不要标题列");
  assert.equal(s.meta.freeze, undefined);
  assert.equal(s.meta.style, "zebra");
  assert.equal(s.meta.x, 1, "不认识的键照抄");
});

test("合计：包含最后一行才留", () => {
  assert.deepEqual(subTable(T(), { r1: 0, c1: 0, r2: 5, c2: 1 }).meta.calc, [null, "sum"]);
  assert.equal(subTable(T(), { r1: 0, c1: 0, r2: 3, c2: 1 }).meta.calc, undefined);
});

test("合并：裁到范围里；左上角在外面时新左上角显示原来的内容；跨新表头分界线、只剩一格的不要", () => {
  // C3:D4 → 从第 4 行（r=3）开始截：只剩 C4:D4，左上角显示「待付」（原来 C3 的内容）
  const s = subTable(T(), { r1: 0, c1: 2, r2: 3, c2: 3 });
  assert.deepEqual(s.meta.merge, ["A3:B4"]);
  const s2 = subTable(T(), { r1: 3, c1: 0, r2: 4, c2: 3 });
  assert.deepEqual(s2.cells[0][2], "待付");
  // 新表头是第 1 行，C1:D1 只跨一行，留着
  assert.deepEqual(s2.meta.merge, ["C1:D1"]);
  // A2:A3 截掉 A2：只剩 A3 一格，不要
  const s3 = subTable(T(), { r1: 0, c1: 0, r2: 1, c2: 1 });
  assert.equal(s3.meta.merge, undefined);
});

test("只包含第一列开头的一片：标题列、冻结留着", () => {
  const s = subTable(T(), { r1: 0, c1: 0, r2: 2, c2: 1 });
  assert.equal(s.meta.headerCol, true);
  assert.equal(s.meta.freeze, 1);
});

test("剪贴板 HTML 里藏原文：带引号、竖线、中文、换行都能取回", () => {
  const lines = serializeTable(T());
  const html = `<table data-ggt="1"${sourceAttr(lines)} style="x"><tr><td>"a|b"</td></tr></table>`;
  assert.deepEqual(sourceFromHTML(html), lines);
  assert.equal(sourceFromHTML("<table></table>"), null);
  assert.equal(sourceFromHTML('<table data-ggt-src="%E0%A4%A"></table>'), null);
});
