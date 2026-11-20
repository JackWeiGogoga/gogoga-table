import assert from "node:assert/strict";
import test from "node:test";
import { blockTable, findTables, writeBlock } from "../../src/core/find";

// B站反馈：格式化插件在表格和注释之间插了空行，合并单元格、颜色全丢了
const META = '<!-- gogoga-table: {"merge":["A2:B2"]} -->';
const TABLE = ["| a | b |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"];

test("表格和注释之间隔着空行也认", () => {
  for (const gap of [1, 2]) {
    const lines = ["前文", "", ...TABLE, ...Array(gap).fill(""), META, "", "后文"];
    const [b] = findTables(lines);
    assert.equal(b.metaLine, 2 + TABLE.length + gap);
    assert.deepEqual(b.meta?.merge, ["A2:B2"]);
    // 写回：空行原样留着，注释照旧在它们后面
    const t = blockTable(lines, b)!;
    const out = writeBlock(t, b);
    assert.deepEqual(out, [...TABLE, ...Array(gap).fill(""), META]);
    assert.deepEqual(lines.slice(b.start, b.stop), out);
  }
});

test("注释后面隔空行的别的东西不受影响；不是我们的注释不认", () => {
  const lines = [...TABLE, "", "<!-- 别的注释 -->"];
  const [b] = findTables(lines);
  assert.equal(b.metaLine, null);
  assert.equal(b.stop, TABLE.length);
  // 中间夹着文字就不是这张表的
  const [c] = findTables([...TABLE, "", "文字", "", META]);
  assert.equal(c.metaLine, null);
});

test("有公式注释、块标识时照旧", () => {
  const tbl = [...TABLE, "<!-- TBLFM: $2=$1 -->", "", META];
  const [b] = findTables(tbl);
  assert.equal(b.metaLine, tbl.length - 1);
  assert.deepEqual(writeBlock(blockTable(tbl, b)!, b), tbl);
  const bid = [...TABLE, "^abc", "", META];
  const [c] = findTables(bid);
  assert.equal(c.metaLine, bid.length - 1);
  assert.deepEqual(writeBlock(blockTable(bid, c)!, c), bid);
});

test("列表里的表格隔空行也认", () => {
  const lines = ["- 项", "", ...TABLE.map((l) => "\t" + l), "", "\t" + META];
  const [b] = findTables(lines);
  assert.equal(b.metaLine, lines.length - 1);
  assert.deepEqual(writeBlock(blockTable(lines, b)!, b), lines.slice(2));
});
