import assert from "node:assert/strict";
import test from "node:test";
import { findTables } from "../../src/core/find";
import { canIndent, indentTable } from "../../src/core/indent";

const L = (s: string) => s.split("\n");
const T = "| a | b |\n| --- | --- |\n| 1 | 2 |";
const ind = (s: string, p: string) => s.split("\n").map((l) => p + l).join("\n");

test("顶格的表格挂到上面最近（最深）的列表项下：Tab 缩进，去掉中间的空行", () => {
  const lines = L(`- abc\n\t- ccc\n\t\t- ddd\n\n${T}\n\n后文`);
  const [b] = findTables(lines);
  assert.ok(canIndent(lines, b, 1));
  assert.ok(!canIndent(lines, b, -1));
  const out = indentTable(lines, b, 1)!;
  assert.equal(out.join("\n"), `- abc\n\t- ccc\n\t\t- ddd\n${ind(T, "\t\t\t")}\n\n后文`);
  const [nb] = findTables(out);
  assert.equal(nb.owner, 2);
  // 已经挂在最近的列表项下了：不能再缩
  assert.ok(!canIndent(out, nb, 1));
});

test("空格缩进的列表：按文件里的空格数缩进；注释跟着一起缩进", () => {
  const meta = '<!-- gogoga-table: {"bg":{"A2":"red"}} -->';
  const lines = L(`- 一\n  - 二\n\n${T}\n${meta}`);
  const out = indentTable(lines, findTables(lines)[0], 1)!;
  assert.equal(out.join("\n"), `- 一\n  - 二\n${ind(T, "    ")}\n    ${meta}`);
  assert.equal(findTables(out)[0].meta?.bg?.A2, "red");
});

test("上面是正文不是列表：不能缩进", () => {
  const lines = L(`一段话\n\n${T}`);
  assert.ok(!canIndent(lines, findTables(lines)[0], 1));
  assert.equal(indentTable(lines, findTables(lines)[0], 1), null);
});

test("表格在父项下、后面有子项时，往里缩挂到最近的子项下", () => {
  const lines = L(`- A\n\t- B\n\n\t${T.replace(/\n/g, "\n\t")}`);
  const [b] = findTables(lines);
  assert.equal(b.owner, 0);
  const out = indentTable(lines, b, 1)!;
  assert.equal(out.join("\n"), `- A\n\t- B\n${ind(T, "\t\t")}`);
});

test("移出列表：放到整个列表后面，前后空行，后面的子项留在列表里", () => {
  const lines = L(`- abc\n\t- 带表格\n${ind(T, "\t\t")}\n\t\t- 子项\n\t- 后面的项\n正文`);
  const [b] = findTables(lines);
  assert.ok(canIndent(lines, b, -1));
  const out = indentTable(lines, b, -1)!;
  assert.equal(out.join("\n"), `- abc\n\t- 带表格\n\t\t- 子项\n\t- 后面的项\n\n${T}\n\n正文`);
  assert.equal(findTables(out)[0].owner, null);
});

test("移出列表：列表在文件末尾", () => {
  const lines = L(`- 项\n${ind(T, "\t")}\n- 下一项`);
  const out = indentTable(lines, findTables(lines)[0], -1)!;
  assert.equal(out.join("\n"), `- 项\n- 下一项\n\n${T}`);
});

test("缩进后再移出，内容不丢", () => {
  const lines = L(`- 项\n\n${T}\n\n后文`);
  const a = indentTable(lines, findTables(lines)[0], 1)!;
  const back = indentTable(a, findTables(a)[0], -1)!;
  assert.equal(back.join("\n"), `- 项\n\n${T}\n\n后文`);
});
