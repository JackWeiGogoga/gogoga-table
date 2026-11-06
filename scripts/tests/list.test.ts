import assert from "node:assert/strict";
import test from "node:test";
import { blockTable, findTables, writeBlock } from "../../src/core/find";
import { setCell } from "../../src/core/ops";

const L = (s: string) => s.split("\n");

test("列表项下面紧跟着的缩进表格：找到，记下缩进和所属的列表项", () => {
  const lines = L("- 功能\n\t- 同步\n\t\t| 平台 | 支持 |\n\t\t| --- | --- |\n\t\t| Mac | 是 |\n\t- 下一项");
  const [b] = findTables(lines);
  assert.equal(b.start, 2);
  assert.equal(b.end, 5);
  assert.equal(b.indent, "\t\t");
  assert.equal(b.owner, 1);
  assert.deepEqual(blockTable(lines, b)!.cells, [["平台", "支持"], ["Mac", "是"]]);
});

test("隔一个空行也算；下面的注释、块标识带着缩进", () => {
  const lines = L("1. 项目\n\n    | a | b |\n    | --- | --- |\n    | 1 | 2 |\n    ^tbl\n\n    <!-- gogoga-table: {\"bg\":{\"A2\":\"red\"}} -->\n2. 下一项");
  const [b] = findTables(lines);
  assert.equal(b.owner, 0);
  assert.equal(b.indent, "    ");
  assert.deepEqual(b.tail, ["^tbl", ""]);
  assert.equal(b.meta?.bg?.A2, "red");
  assert.equal(b.stop, 8);
  // 写回：每行补回缩进，空行不补
  const t = setCell(blockTable(lines, b)!, 1, 1, "3");
  assert.deepEqual(writeBlock(t, b), ["    | a | b |", "    | --- | --- |", "    | 1 | 3 |", "    ^tbl", "", '    <!-- gogoga-table: {"bg":{"A2":"red"}} -->']);
});

test("不接管：不在列表里的缩进（代码块）、夹在文字后面、缩进不一致、没比列表项缩进多", () => {
  assert.equal(findTables(L("段落\n\n    | a | b |\n    | --- | --- |")).length, 0);
  assert.equal(findTables(L("- 项\n\t说明文字\n\t| a | b |\n\t| --- | --- |")).length, 0);
  assert.equal(findTables(L("- 项\n\t| a | b |\n\t\t| --- | --- |")).length, 0);
  assert.equal(findTables(L("\t- 项\n\t| a | b |\n\t| --- | --- |")).length, 0);
  // 缩进不一致的一行：表格到它为止
  const [b] = findTables(L("- 项\n\t| a | b |\n\t| --- | --- |\n\t| 1 | 2 |\n  | 3 | 4 |"));
  assert.equal(b.end, 4);
});

test("列表里的代码块中的表格不动", () => {
  assert.equal(findTables(L("- 项\n\t```\n\t| a | b |\n\t| --- | --- |\n\t```")).length, 0);
});

test("顶格表格照旧", () => {
  const [b] = findTables(L("| a | b |\n| --- | --- |\n| 1 | 2 |"));
  assert.equal(b.indent, "");
  assert.equal(b.owner, null);
});
