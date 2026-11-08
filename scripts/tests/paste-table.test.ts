import { test } from "node:test";
import assert from "node:assert/strict";
import { gridToTable, inFence, isTsvTable } from "../../src/obsidian/paste";
import { serializeTable } from "../../src/core/table";

// #1：正文里粘贴表格数据生成表格。哪些纯文字算一张表
test("Excel 复制出来的几行几列（\\r\\n 结尾、末尾带空行）算表", () => {
  assert.equal(isTsvTable("序号\t姓名\t备注\r\n7\t张九\t都是张家本村的\r\n6\t张八\t\r\n"), true);
});
test("只有一行、只有一列、没有制表符、列数不齐的不算", () => {
  assert.equal(isTsvTable("a\tb\tc"), false);
  assert.equal(isTsvTable("a\nb\nc"), false);
  assert.equal(isTsvTable("普通的一段话\n第二行"), false);
  assert.equal(isTsvTable("a\tb\nc"), false);
  assert.equal(isTsvTable("\tindented code\n\tmore code"), false);
});
test("最后一列空着（行尾是制表符）也算", () => {
  assert.equal(isTsvTable("a\tb\tc\n1\t2\t\n3\t\t\n"), true);
});
test("带双引号的格子里有换行也算一格", () => {
  assert.equal(isTsvTable('a\tb\n"多\n行"\tc'), true);
});
test("第一行当表头，写成 Markdown 表格；竖线转义、换行写成 <br>", () => {
  const out = serializeTable(gridToTable([["序号", "姓名", "备注"], ["7", "张九", " a|b "], ["6", "张八", "第一行\n第二行"]]));
  assert.equal(out[0], "| 序号 | 姓名 | 备注 |");
  assert.equal(out[1].replace(/ /g, ""), "|---|---|---|");
  assert.equal(out[2], "| 7 | 张九 | a\\|b |");
  assert.equal(out[3], "| 6 | 张八 | 第一行<br>第二行 |");
});
test("列数不齐的（HTML 合并格）按最多的补空格", () => {
  const t = gridToTable([["a", "b", "c"], ["d"]]);
  assert.deepEqual(t.cells[1], ["d", "", ""]);
});

test("代码块、公式块、frontmatter 里不接管", () => {
  const lines = ["---", "a: 1", "---", "", "```", "", "```", "", "$$", "", "$$", "", "````", "```", "", "````", ""];
  assert.equal(inFence(lines, 1), true);
  assert.equal(inFence(lines, 3), false);
  assert.equal(inFence(lines, 5), true);
  assert.equal(inFence(lines, 7), false);
  assert.equal(inFence(lines, 9), true);
  assert.equal(inFence(lines, 11), false);
  assert.equal(inFence(lines, 14), true);
  assert.equal(inFence(lines, 16), false);
});
