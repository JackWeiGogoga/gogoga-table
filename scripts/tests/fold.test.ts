/** 折叠表格（注释里的 fold）：读写、开关、没有正文行时不折、插删行不丢折叠 */
import assert from "node:assert/strict";
import test from "node:test";
import { findTables } from "../../src/core/find";
import { deleteRow, insertRow, setFolded } from "../../src/core/ops";
import { parseTable, serializeBlock, type Table } from "../../src/core/table";

const load = (md: string): Table => {
  const lines = md.split("\n");
  const b = findTables(lines)[0];
  return parseTable(lines.slice(b.start, b.end), b.meta)!;
};
const SRC = "| 名称 | 数量 |\n| --- | --- |\n| 甲 | 1 |\n| 乙 | 2 |";

test("折叠写进注释，展开去掉；重复开关不变", () => {
  const t = load(SRC);
  const f = setFolded(t, true);
  assert.equal(f.meta.fold, 1);
  assert.ok(serializeBlock(f, []).join("\n").includes('"fold":1'));
  assert.equal(setFolded(f, true), f);
  const u = setFolded(f, false);
  assert.equal(u.meta.fold, undefined);
  assert.ok(!serializeBlock(u, []).join("\n").includes("gogoga-table"));
  assert.equal(setFolded(t, false), t);
});

test("读回来：fold 原样认", () => {
  const t = load(SRC + '\n<!-- gogoga-table: {"fold":1} -->');
  assert.equal(t.meta.fold, 1);
});

test("只有表头没有正文行：不折", () => {
  const t = load("| 名称 | 数量 |\n| --- | --- |");
  assert.equal(setFolded(t, true), t);
});

test("插删行不影响折叠", () => {
  const f = setFolded(load(SRC), true);
  assert.equal(insertRow(f, 1).meta.fold, 1);
  assert.equal(deleteRow(f, 1).meta.fold, 1);
});
