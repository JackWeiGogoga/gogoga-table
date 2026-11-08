/** 哪些格子可以不走 Markdown 渲染、直接放文字：拿不准的一律交给渲染 */
import assert from "node:assert/strict";
import test from "node:test";
import { isPlainText } from "../../src/editor/editor";

test("纯文字、数字、常见标点：直接放", () => {
  for (const s of ["123", "-5", "+5", "1.5", "1,000", "3.14%", "项目 7", "已完成", "Hello, world!", "a/b", "(备注)", "“引号”", "2026-11-08", "10:30", "foo@bar", "Ünïcödé", "مرحبا", ""])
    assert.equal(isPlainText(s), true, s);
});

test("有 Markdown 写法、或拿不准的：交给渲染", () => {
  for (const s of [
    "**粗**", "*斜*", "_斜_", "~~删~~", "==高亮==", "`代码`", "$x$", "[[笔记]]", "[链接](x)", "![[图.png]]", "#标签", "<b>x</b>", "a&amp;b",
    "a\nb", "- 列表", "+ 列表", "1. 第一", "2023.", "1)", "> 引用", "---", "-", "https://x.com", "www.x.com", "%%注释%%", "a\\b", "[ ] 待办", "x^2", "a|b", "＃标签",
  ])
    assert.equal(isPlainText(s), false, s);
});
