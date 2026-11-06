import assert from "node:assert/strict";
import test from "node:test";
import { fromTSV, toHTML, toTSV } from "../../src/core/clipboard";
import { findTables } from "../../src/core/find";
import { clearCells, isCovered, deleteCol, deleteRow, insertCol, insertRow, mergeAt, mergeCells, merges, moveCol, moveRow, pasteGrid, setBg, unmergeAt } from "../../src/core/ops";
import { parseMetaLine, parseRange, parseTable, rangeRef, serializeTable, type Table } from "../../src/core/table";

const BASE = `| A | B | C |
| --- | --- | --- |
| a1 | b1 | c1 |
| a2 | b2 | c2 |
| a3 | b3 | c3 |`;
const load = (md = BASE): Table => {
  const lines = md.split("\n");
  const b = findTables(lines)[0];
  return parseTable(lines.slice(b.start, b.end), b.meta)!;
};
const R = (s: string) => parseRange(s)!;

test("合并范围的写法：A3:B4，写反了也认，一格不算", () => {
  assert.deepEqual(parseRange("A3:B4"), { r1: 2, c1: 0, r2: 3, c2: 1 });
  assert.deepEqual(parseRange("B4:A3"), { r1: 2, c1: 0, r2: 3, c2: 1 });
  assert.equal(parseRange("A3:A3"), null);
  assert.equal(parseRange("A3"), null);
  assert.equal(rangeRef({ r1: 2, c1: 0, r2: 3, c2: 1 }), "A3:B4");
  assert.deepEqual(parseMetaLine('<!-- gogoga-table: {"merge":["A2:B2","坏的","C3:C3"]} -->'), { merge: ["A2:B2"] });
});

test("合并：各格内容不动，只写进注释；显示左上角", () => {
  const t = mergeCells(load(), R("A2:B3"));
  assert.deepEqual(t.cells, load().cells);
  assert.deepEqual(t.meta.merge, ["A2:B3"]);
  // 没装插件看到的表格内容一个字没变，只多了一行注释
  assert.equal(serializeTable(t).slice(0, -1).join("\n"), BASE);
  assert.deepEqual(mergeAt(t, 2, 1), R("A2:B3"));
  assert.equal(mergeAt(t, 3, 0), null);
  assert.equal(isCovered(t, 1, 0), false);
  assert.equal(isCovered(t, 2, 1), true);
});

test("合并后取消合并：内容原样回来（横向、纵向都一样）", () => {
  for (const range of ["A2:B2", "A2:A3", "B2:C4"]) {
    const t = unmergeAt(mergeCells(load(), R(range)), R(range).r1, R(range).c1);
    assert.deepEqual(t.cells, load().cells, range);
    assert.equal(serializeTable(t).join("\n"), BASE, range);
  }
});

test("合并碰到已有的合并区域：整块并进来", () => {
  let t = mergeCells(load(), R("B2:C2"));
  t = mergeCells(t, R("A2:B3"));
  assert.deepEqual(t.meta.merge, ["A2:C3"]);
});

test("在合并区域中间插行插列：区域变大；在上面插：整体下移", () => {
  const t = mergeCells(load(), R("A2:B3"));
  assert.deepEqual(insertRow(t, 2).meta.merge, ["A2:B4"]);
  assert.deepEqual(insertRow(t, 1).meta.merge, ["A3:B4"]);
  assert.deepEqual(insertRow(t, 3).meta.merge, ["A2:B3"]);
  assert.deepEqual(insertCol(t, 1).meta.merge, ["A2:C3"]);
  assert.deepEqual(insertCol(t, 0).meta.merge, ["B2:C3"]);
});

test("删掉合并区域里的行列：区域变小，剩一格就取消", () => {
  const t = mergeCells(load(), R("A2:B3"));
  assert.deepEqual(deleteRow(t, 2).meta.merge, ["A2:B2"]);
  assert.deepEqual(deleteCol(deleteRow(t, 2), 1).meta.merge, []);
  assert.deepEqual(deleteRow(t, 3).meta.merge, ["A2:B3"]);
});

test("挪行挪列：整块跟着挪；把合并区域拆开的挪动取消这个合并", () => {
  const t = mergeCells(load(), R("A2:B3"));
  assert.deepEqual(moveRow(t, 3, 1).meta.merge, ["A3:B4"]);
  assert.deepEqual(moveCol(t, 2, 0).meta.merge, ["B2:C3"]);
  // 把合并区域里的第一行挪到最后：区域断开
  assert.deepEqual(moveRow(t, 1, 3).meta.merge, []);
});

test("底色和合并一起：合并后写回再读出来一样", () => {
  const t = setBg(mergeCells(load(), R("B3:C4")), [{ r: 2, c: 1 }], "blue");
  const lines = serializeTable(t);
  const back = parseTable(lines.slice(0, -1), parseMetaLine(lines[lines.length - 1]));
  assert.deepEqual(back!.meta, { bg: { B3: "blue" }, merge: ["B3:C4"] });
});

test("清空一片格子", () => {
  const t = clearCells(load(), [{ r: 1, c: 0 }, { r: 2, c: 2 }]);
  assert.equal(t.cells[1][0], "");
  assert.equal(t.cells[2][2], "");
  assert.equal(t.cells[1][1], "b1");
  const same = load();
  assert.equal(clearCells(same, [{ r: 9, c: 9 }]), same);
});

test("粘贴一片：从选中的格子开始，超出就加行加列", () => {
  const t = pasteGrid(load(), 3, 2, [["x", "y"], ["z", "w"]]);
  assert.equal(t.cells.length, 5);
  assert.equal(t.align.length, 4);
  assert.deepEqual(t.cells[3], ["a3", "b3", "x", "y"]);
  assert.deepEqual(t.cells[4], ["", "", "z", "w"]);
});

test("TSV：复制写出、粘贴读回，带换行、制表符、引号的格子", () => {
  const grid = [["名称", "说明"], ["a", "第一行\n第二行"], ['说"引号"', "x\ty"]];
  const tsv = toTSV(grid);
  assert.equal(tsv, '名称\t说明\na\t"第一行\n第二行"\n"说""引号"""\t"x\ty"');
  assert.deepEqual(fromTSV(tsv), grid);
  assert.deepEqual(fromTSV("a\tb\r\nc\td\r\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(fromTSV("单独一格"), [["单独一格"]]);
  // 不在开头的引号是普通字符
  assert.deepEqual(fromTSV('5" 屏幕\tx'), [['5" 屏幕', "x"]]);
});

test("HTML：第一行用 th，换行写成 <br>，转义", () => {
  assert.equal(toHTML([["a<b", "c"], ["1\n2", "&"]], true), "<table><tr><th>a&lt;b</th><th>c</th></tr><tr><td>1<br>2</td><td>&amp;</td></tr></table>");
});

test("merges 只认表格范围里的", () => {
  const t = { ...load(), meta: { merge: ["A2:B2", "C5:D9"] } };
  assert.deepEqual(merges(t).map(rangeRef), ["A2:B2"]);
});

import { editCell, mergedText, shownText } from "../../src/core/ops";

test("合并格看到的内容：各格按顺序、每格一行，一样的只留一个", () => {
  const t = mergeCells(load(), R("A2:B2"));
  assert.equal(shownText(t, 1, 0), "a1\nb1");
  const same = mergeCells(load("| Q | x |\n| --- | --- |\n| Q1 | 1 |\n| Q1 | 2 |"), R("A2:A3"));
  assert.equal(mergedText(same, R("A2:A3")), "Q1");
  assert.equal(shownText(load(), 1, 0), "a1");
});

test("改合并格：没改不动；改了写进左上角，其余清空，取消合并后内容留在左上角", () => {
  const t = mergeCells(load(), R("A2:B2"));
  assert.equal(editCell(t, 1, 0, "a1\nb1"), t);
  const e = editCell(t, 1, 0, "合计");
  assert.deepEqual(e.cells[1].slice(0, 2), ["合计", ""]);
  assert.deepEqual(unmergeAt(e, 1, 0).cells[1].slice(0, 2), ["合计", ""]);
  // 没改过：取消合并原样回来
  assert.deepEqual(unmergeAt(t, 1, 0).cells[1].slice(0, 2), ["a1", "b1"]);
});
