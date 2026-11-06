import assert from "node:assert/strict";
import test from "node:test";
import { findTables } from "../../src/core/find";
import { deleteCol, deleteRow, insertCol, insertRow, moveCol, moveRow, setAlign, setBg, setCell, setWidth } from "../../src/core/ops";
import { cellRef, colName, displayWidth, emptyTable, parseMetaLine, parseRef, parseTable, serializeTable, splitRow, type Table } from "../../src/core/table";

/** 从一段 Markdown 里取第一张表（带注释） */
function load(md: string): Table {
  const lines = md.split("\n");
  const b = findTables(lines)[0];
  assert.ok(b, "没找到表格");
  const t = parseTable(lines.slice(b.start, b.end), b.meta);
  assert.ok(t);
  return t;
}
const write = (t: Table) => serializeTable(t).join("\n");

const BASIC = `| 方案 | 月费 | 存储 |
| :--- | :---: | ---: |
| 基础 | 10 元 | 5 GB |
| 专业 | 30 元 | 50 GB |`;

test("坐标：列字母和 A1", () => {
  assert.equal(colName(0), "A");
  assert.equal(colName(25), "Z");
  assert.equal(colName(26), "AA");
  assert.equal(colName(701), "ZZ");
  assert.equal(cellRef(0, 0), "A1");
  assert.equal(cellRef(2, 27), "AB3");
  assert.deepEqual(parseRef("AB3"), { r: 2, c: 27 });
  assert.equal(parseRef("A0"), null);
  assert.equal(parseRef("a1"), null);
});

test("切格子：转义的竖线留在格子里，两头竖线可有可无", () => {
  assert.deepEqual(splitRow("| a | b \\| c | d |"), ["a", "b | c", "d"]);
  assert.deepEqual(splitRow("a | b"), ["a", "b"]);
  assert.deepEqual(splitRow("| [[笔记\\|别名]] | x |"), ["[[笔记|别名]]", "x"]);
  assert.deepEqual(splitRow("| a | b \\|"), ["a", "b |"]);
});

test("没改过的表原样写回（紧凑写法）", () => {
  assert.equal(write(load(BASIC)), BASIC);
});

test("对齐解析成左中右，没冒号是 null", () => {
  const t = load("| a | b | c | d |\n| --- | :-- | :-: | --: |\n| 1 | 2 | 3 | 4 |");
  assert.deepEqual(t.align, [null, "left", "center", "right"]);
});

test("补了空格对齐的表：写回时照样对齐，中文算两个宽", () => {
  const src = `| 名字   | 数量 |
| ------ | ---- |
| 苹果   | 3    |
| banana | 12   |`;
  const t = load(src);
  assert.ok(t.style.padded);
  assert.equal(write(t), src);
  const out = write(setCell(t, 1, 0, "大苹果子"));
  const lines = out.split("\n");
  assert.ok(lines.every((l) => displayWidth(l) === displayWidth(lines[0])), out);
});

test("两头没有竖线的表：写回时也不加", () => {
  const src = "a | b\n--- | ---\n1 | 2";
  assert.equal(write(load(src)), src);
});

test("格子里的 <br> 变成换行，写回成 <br>；竖线转义", () => {
  const t = load("| a | b |\n| --- | --- |\n| 一<br>二 | x \\| y |");
  assert.equal(t.cells[1][0], "一\n二");
  assert.equal(t.cells[1][1], "x | y");
  const n = setCell(setCell(t, 1, 0, "三\n四"), 1, 1, "p | q");
  assert.equal(write(n).split("\n")[2], "| 三<br>四 | p \\| q |");
});

test("数据行比表头多出的格子不丢，表头补空", () => {
  const t = load("| a | b |\n| --- | --- |\n| 1 | 2 | 3 |");
  assert.equal(t.align.length, 3);
  assert.deepEqual(t.cells[0], ["a", "b", ""]);
  assert.match(write(t), /\| 1 \| 2 \| 3 \|/);
});

test("数据行少格子：补空", () => {
  const t = load("| a | b | c |\n| --- | --- | --- |\n| 1 |");
  assert.deepEqual(t.cells[1], ["1", "", ""]);
});

test("注释：读出列宽和底色，写回在表格上方", () => {
  const src = `<!-- gogoga-table: {"w":[120,null,200],"bg":{"B2":"yellow"}} -->\n${BASIC}`;
  const t = load(src);
  assert.deepEqual(t.meta.w, [120, null, 200]);
  assert.deepEqual(t.meta.bg, { B2: "yellow" });
  assert.equal(write(t), src);
});

test("注释里坏掉的项丢掉，不认识的键原样保留", () => {
  const m = parseMetaLine('<!-- gogoga-table: {"w":[100,"x",-5],"bg":{"B2":"pink","C3":"red","zz":"red"},"future":{"a":1}} -->');
  assert.deepEqual(m, { w: [100, null, null], bg: { C3: "red" }, future: { a: 1 } });
  assert.equal(parseMetaLine("<!-- gogoga-table: {坏的 -->"), null);
  assert.equal(parseMetaLine("<!-- 别的注释 -->"), null);
});

test("注释坏了：表格照常认，注释那行不算表格的一部分", () => {
  const lines = `<!-- gogoga-table: {坏的 -->\n${BASIC}`.split("\n");
  const [b] = findTables(lines);
  assert.equal(b.start, 1);
  assert.equal(b.metaLine, null);
});

test("没有设置时不写注释；设置清空后注释也去掉", () => {
  const t = load(`<!-- gogoga-table: {"bg":{"B2":"red"}} -->\n${BASIC}`);
  const n = setBg(t, [{ r: 1, c: 1 }], null);
  assert.equal(write(n), BASIC);
  assert.equal(write(setWidth(load(BASIC), 1, null)), BASIC);
});

test("插入行：底色跟着往下挪", () => {
  const t = setBg(load(BASIC), [{ r: 2, c: 0 }], "green");
  const n = insertRow(t, 2);
  assert.deepEqual(n.cells[2], ["", "", ""]);
  assert.deepEqual(n.meta.bg, { A4: "green" });
  // 表头前面插不了，插到第一行数据前
  assert.deepEqual(insertRow(t, 0).cells[1], ["", "", ""]);
  // 原表没变
  assert.equal(t.cells.length, 3);
});

test("删行：这一行的底色去掉，下面的往上挪；表头和最后一行数据删不掉", () => {
  const t = setBg(load(BASIC), [{ r: 1, c: 0 }, { r: 2, c: 1 }], "red");
  const n = deleteRow(t, 1);
  assert.deepEqual(n.cells.map((r) => r[0]), ["方案", "专业"]);
  assert.deepEqual(n.meta.bg, { B2: "red" });
  assert.equal(deleteRow(t, 0), t);
  assert.equal(deleteRow(n, 1), n);
});

test("插入列：对齐、列宽、底色都跟着挪", () => {
  let t = setWidth(load(BASIC), 1, 150);
  t = setBg(t, [{ r: 1, c: 1 }], "blue");
  const n = insertCol(t, 1);
  assert.deepEqual(n.cells[0], ["方案", "", "月费", "存储"]);
  assert.deepEqual(n.align, ["left", null, "center", "right"]);
  assert.deepEqual(n.meta.w, [null, null, 150, null]);
  assert.deepEqual(n.meta.bg, { C2: "blue" });
});

test("删列：对齐、列宽、底色都跟着挪；只剩一列时不删", () => {
  let t = setWidth(load(BASIC), 2, 90);
  t = setBg(t, [{ r: 1, c: 0 }, { r: 1, c: 2 }], "purple");
  const n = deleteCol(t, 0);
  assert.deepEqual(n.cells[0], ["月费", "存储"]);
  assert.deepEqual(n.align, ["center", "right"]);
  assert.deepEqual(n.meta.w, [null, 90]);
  assert.deepEqual(n.meta.bg, { B2: "purple" });
  const one = deleteCol(deleteCol(n, 0), 0);
  assert.equal(one.align.length, 1);
});

test("挪行：内容和底色一起挪，表头不动", () => {
  let t = insertRow(load(BASIC), 3);
  t = setCell(t, 3, 0, "企业");
  t = setBg(t, [{ r: 1, c: 0 }], "yellow");
  const n = moveRow(t, 1, 3);
  assert.deepEqual(n.cells.map((r) => r[0]), ["方案", "专业", "企业", "基础"]);
  assert.deepEqual(n.meta.bg, { A4: "yellow" });
  const back = moveRow(n, 3, 1);
  assert.deepEqual(back.cells, t.cells);
  assert.deepEqual(back.meta.bg, t.meta.bg);
  assert.equal(moveRow(t, 0, 2), t);
});

test("挪列：内容、对齐、列宽、底色一起挪", () => {
  let t = setWidth(load(BASIC), 0, 80);
  t = setBg(t, [{ r: 2, c: 0 }], "gray");
  const n = moveCol(t, 0, 2);
  assert.deepEqual(n.cells[0], ["月费", "存储", "方案"]);
  assert.deepEqual(n.align, ["center", "right", "left"]);
  assert.deepEqual(n.meta.w, [null, null, 80]);
  assert.deepEqual(n.meta.bg, { C3: "gray" });
});

test("对齐、列宽写回", () => {
  let t = setAlign(load(BASIC), 0, "right");
  t = setWidth(t, 2, 33.6);
  const out = write(t).split("\n");
  assert.equal(out[0], '<!-- gogoga-table: {"w":[null,null,40]} -->');
  assert.equal(out[2], "| ---: | :---: | ---: |");
});

test("新建空表", () => {
  assert.equal(write(emptyTable(3, 2)), "|  |  |\n| --- | --- |\n|  |  |\n|  |  |");
});

test("找表格：跳过代码块、frontmatter、引用、缩进和紧跟文字的", () => {
  const md = [
    "---", "a: | b |", "---", "",
    "```", "| x | y |", "| --- | --- |", "```", "",
    "> | q | r |", "> | --- | --- |", "",
    "    | i | j |", "    | --- | --- |", "",
    "一段文字", "| p | s |", "| --- | --- |", "",
    "## 标题", "| 真 | 表 |", "| --- | --- |", "| 1 | 2 |", "",
    '<!-- gogoga-table: {"w":[100]} -->', "| 第二 | 张 |", "| --- | --- |",
  ];
  const found = findTables(md);
  assert.deepEqual(found.map((b) => [b.start, b.end, b.metaLine]), [[20, 23, null], [25, 27, 24]]);
});

test("表格到空行或没有竖线的行为止", () => {
  const lines = "| a | b |\n| --- | --- |\n| 1 | 2 |\n后面的文字\n| 3 | 4 |".split("\n");
  assert.deepEqual(findTables(lines).map((b) => [b.start, b.end]), [[0, 3]]);
});

test("表头和分隔行列数不一样：不是表格", () => {
  assert.deepEqual(findTables("| a | b |\n| --- |\n| 1 | 2 |".split("\n")), []);
});
