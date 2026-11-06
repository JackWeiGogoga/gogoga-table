import assert from "node:assert/strict";
import test from "node:test";
import { canSortRows, duplicateCol, duplicateRow, insertCols, insertRows, mergeCells, setBg, setWidth, sortRows, toggleCheck } from "../../src/core/ops";
import { parseRange, parseTable, type Table } from "../../src/core/table";

const T = (rows: string[][]): Table => {
  const head = "| " + rows[0].join(" | ") + " |";
  const delim = "| " + rows[0].map(() => "---").join(" | ") + " |";
  return parseTable([head, delim, ...rows.slice(1).map((r) => "| " + r.join(" | ") + " |")])!;
};
const col = (t: Table, c: number) => t.cells.slice(1).map((r) => r[c]);

test("排序：数字按数值、空的在最后、表头不动，降序", () => {
  const t = T([["名", "数"], ["a", "10"], ["b", "9"], ["c", ""], ["d", "100"]]);
  assert.deepEqual(col(sortRows(t, 1, false), 1), ["9", "10", "100", ""]);
  assert.deepEqual(col(sortRows(t, 1, true), 1), ["100", "10", "9", ""]);
  assert.equal(sortRows(t, 1, false).cells[0][0], "名");
});

test("排序：中文按拼音，日期按时间，带编号按自然顺序", () => {
  assert.deepEqual(col(sortRows(T([["x"], ["张三"], ["李四"], ["王五"]]), 0, false), 0), ["李四", "王五", "张三"]);
  assert.deepEqual(col(sortRows(T([["x"], ["2026-11-06"], ["2025-01-01"], ["2026-2-1"]]), 0, false), 0), ["2025-01-01", "2026-2-1", "2026-11-06"]);
  assert.deepEqual(col(sortRows(T([["x"], ["第10期"], ["第2期"], ["第1期"]]), 0, false), 0), ["第1期", "第2期", "第10期"]);
  assert.deepEqual(col(sortRows(T([["x"], ["¥1,200"], ["¥300"], ["50%"]]), 0, false), 0), ["50%", "¥300", "¥1,200"]);
});

test("排序：底色跟着行走；一样的保持原顺序；合计行不动", () => {
  let t = T([["名", "数"], ["a", "2"], ["b", "1"], ["c", "2"], ["合计", "5"]]);
  t = setBg(t, [{ r: 1, c: 0 }], "red");
  const s = sortRows(t, 1, false, true);
  assert.deepEqual(col(s, 0), ["b", "a", "c", "合计"]);
  assert.deepEqual(s.meta.bg, { A3: "red" });
});

test("有跨行合并时不排序", () => {
  const t = mergeCells(T([["x", "y"], ["1", "a"], ["2", "b"]]), parseRange("A2:A3")!);
  assert.equal(canSortRows(t), false);
  assert.equal(sortRows(t, 1, true), t);
  // 只有横向合并可以排
  assert.equal(canSortRows(mergeCells(T([["x", "y"], ["1", "a"]]), parseRange("A2:B2")!)), true);
});

test("复制行、复制列：内容和底色、列宽、对齐一起复制", () => {
  let t = setBg(T([["a", "b"], ["1", "2"], ["3", "4"]]), [{ r: 1, c: 1 }], "blue");
  const r = duplicateRow(t, 1);
  assert.deepEqual(r.cells.map((x) => x.join(",")), ["a,b", "1,2", "1,2", "3,4"]);
  assert.deepEqual(r.meta.bg, { B2: "blue", B3: "blue" });
  t = setWidth(t, 1, 120);
  const c = duplicateCol(t, 1);
  assert.deepEqual(c.cells[1], ["1", "2", "2"]);
  assert.deepEqual(c.meta.w, [null, 120, 120]);
  assert.deepEqual(c.meta.bg, { B2: "blue", C2: "blue" });
});

test("一次插入多行多列", () => {
  const t = T([["a", "b"], ["1", "2"]]);
  assert.equal(insertRows(t, 2, 3).cells.length, 5);
  assert.equal(insertCols(t, 1, 2).align.length, 4);
});

test("勾选框：[ ] 和 [x] 来回切，后面的文字不动；不是勾选框不动", () => {
  const t = T([["任务", "完成"], ["写文档", "[ ]"], ["改 bug", "[x] 已合并"], ["x", "[a]"]]);
  assert.equal(toggleCheck(t, 1, 1).cells[1][1], "[x]");
  assert.equal(toggleCheck(t, 2, 1).cells[2][1], "[ ] 已合并");
  assert.equal(toggleCheck(t, 3, 1), t);
  assert.equal(toggleCheck(t, 1, 0), t);
});

import { clearAllBg, deleteRow as delRow, fgOf, insertRow as insRow, moveCol as mvCol, setFg, setTableLook, setWidths } from "../../src/core/ops";
import { parseMetaLine, serializeTable } from "../../src/core/table";

test("第二批：文字颜色跟着行列走、写回、清除；标题列开关；三线表样式；一次设好列宽", () => {
  let t = setFg(T([["a", "b"], ["1", "2"], ["3", "4"]]), [{ r: 1, c: 1 }], "red");
  assert.equal(fgOf(t, 1, 1), "red");
  assert.equal(fgOf(insRow(t, 1), 2, 1), "red");
  assert.equal(fgOf(mvCol(t, 1, 0), 1, 0), "red");
  assert.equal(delRow(t, 1).meta.fg && Object.keys(delRow(t, 1).meta.fg!).length, 0);
  assert.match(serializeTable(t).at(-1)!, /"fg":\{"B2":"red"\}/);
  assert.equal(clearAllBg(t).meta.fg, undefined);
  t = setTableLook(t, { headerCol: true, style: "academic" });
  assert.equal(t.meta.headerCol, true);
  assert.equal(t.meta.style, "academic");
  assert.equal(setTableLook(t, { headerCol: false }).meta.headerCol, undefined);
  assert.deepEqual(setWidths(t, [100, 33.4]).meta.w, [100, 40]);
  assert.deepEqual(parseMetaLine('<!-- gogoga-table: {"headerCol":1,"fg":{"A1":"pink","B2":"blue"}} -->'), { fg: { B2: "blue" } });
});
