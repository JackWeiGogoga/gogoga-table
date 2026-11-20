/** 用户反馈（zhiqiang）：格子里 <span style="color:…">甲<br>乙</span>，编辑时颜色标签露成源码。编辑框里 <br> 是换行，原来逐行找格式找不到跨行的标签 */
import test from "node:test";
import assert from "node:assert/strict";
import { formatSpans } from "../../src/core/live-preview";

test("跨行的颜色标签认得出来，标签算标记符（编辑时藏着）", () => {
  const open = '<span style="color:#e03e3e">';
  const text = `${open} 中间有 \n </span>`;
  const s = formatSpans(text);
  assert.equal(s.length, 1);
  assert.deepEqual({ kind: s[0].kind, from: s[0].from, to: s[0].to, innerFrom: s[0].innerFrom, innerTo: s[0].innerTo, color: s[0].color, html: s[0].html }, { kind: "color", from: 0, to: text.length, innerFrom: open.length, innerTo: text.length - "</span>".length, color: "#e03e3e", html: true });
});

test("跨行的荧光笔和里面逐行的格式都在，外层在前", () => {
  const text = '<mark style="background:#fff3a3">**甲**\n乙</mark>';
  const s = formatSpans(text);
  assert.deepEqual(s.map((x) => x.kind), ["bg", "strong"]);
});

test("一行里的照旧只认一次；Markdown 标记不跨行", () => {
  assert.equal(formatSpans('<span style="color:red">甲</span>\n乙').length, 1);
  assert.equal(formatSpans("**甲\n乙**").length, 0);
});
