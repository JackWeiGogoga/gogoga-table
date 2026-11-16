/**
 * 计算列：公式的解析、求值、格式，和表格操作（插删挪行列、改列名、合计、多行表头、合并、截取）叠在一起
 */
import assert from "node:assert/strict";
import test from "node:test";
import { evalFormula, formatFx, formulaRefs, FxFail, parseFormula, renameInFormula, type FxEmpty, type FxError } from "../../src/core/formula";
import {
  checkFormula,
  columnNames,
  deleteCol,
  deleteRow,
  duplicateCol,
  editCell,
  formulaError,
  fxCellNote,
  insertCol,
  insertRow,
  isFxCell,
  moveCol,
  normalize,
  pasteGrid,
  setCalc,
  setFormula,
  sortRows,
  subTable,
} from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable, type Table } from "../../src/core/table";

const T = (rows: string[][]): Table => {
  const line = (r: string[]) => "| " + r.join(" | ") + " |";
  return parseTable([line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)])!;
};
const calc = (src: string, vals: Record<string, number | null> = {}) => evalFormula(parseFormula(src), (n) => vals[n] ?? null);
const err = (src: string): FxError => {
  try {
    parseFormula(src);
  } catch (e) {
    return (e as FxFail).info as FxError;
  }
  throw new Error("没报错：" + src);
};
/** 算不出来：抛 FxFail，原因是 why */
const empty = (fn: () => unknown, why: FxEmpty) =>
  assert.throws(fn, (e) => {
    assert.ok(e instanceof FxFail);
    assert.deepEqual(e.info, why);
    return true;
  });
const col = (t: Table, c: number) => t.cells.map((r) => r[c]);

test("公式：四则运算的优先级、括号、负号、小数", () => {
  assert.equal(calc("1 + 2 * 3"), 7);
  assert.equal(calc("(1 + 2) * 3"), 9);
  assert.equal(calc("-2 * -3"), 6);
  assert.equal(calc("10 / 4 - .5"), 2);
  assert.equal(calc("{单价} * {数量}", { 单价: 12.5, 数量: 3 }), 37.5);
  assert.equal(calc("{ 单价 }*{数量}", { 单价: 2, 数量: 3 }), 6);
});

test("公式：中文输入法的全角符号也认", () => {
  assert.equal(calc("（{a}＋{b}）×2÷4", { a: 1, b: 3 }), 2);
  assert.equal(calc("SUM（{a}，{b}）", { a: 1, b: 2 }), 3);
});

test("公式：SUM AVG MIN MAX 跳过空的，全空才算不出来；ROUND 默认取整", () => {
  assert.equal(calc("SUM({a},{b},{c})", { a: 1, c: 2 }), 3);
  assert.equal(calc("avg({a},{b},{c})", { a: 1, c: 2 }), 1.5);
  assert.equal(calc("MAX({a},{b})", { a: -1, b: -5 }), -1);
  assert.equal(calc("MIN({a},{b})", { a: -1, b: -5 }), -5);
  empty(() => calc("SUM({a},{b})"), { reason: "input", name: "a" });
  assert.equal(calc("ROUND(2.5)"), 3);
  assert.equal(calc("ROUND(1.005, 2)"), 1.01);
  assert.equal(calc("ROUND({a}/3, 1)", { a: 10 }), 3.3);
});

test("公式：算不出来的原因：引用的格子空着、除以 0", () => {
  empty(() => calc("{a}*{b}", { a: 1 }), { reason: "input", name: "b" });
  empty(() => calc("{a}/{b}", { a: 1, b: 0 }), { reason: "div0" });
});

test("公式：写错了的几种", () => {
  assert.equal(err("").code, "empty");
  assert.equal(err("(1+2").code, "paren");
  assert.equal(err("1+2)").code, "paren");
  assert.equal(err("{单价*2").code, "brace");
  assert.equal(err("{}*2").code, "brace");
  assert.equal(err("单价*2").code, "syntax");
  assert.equal(err("1 +").code, "syntax");
  assert.equal(err("1 2").code, "syntax");
  assert.deepEqual(err("FOO(1)"), { code: "func", name: "FOO" });
  assert.deepEqual(err("ROUND(1,2,3)"), { code: "args", name: "ROUND" });
  assert.deepEqual(err("SUM()"), { code: "args", name: "SUM" });
});

test("公式：引用的列名、改名", () => {
  assert.deepEqual(formulaRefs(parseFormula("{a}*{b}+{a}")), ["a", "b"]);
  assert.equal(renameInFormula("{单价}*{ 单价 }+{单价2}", "单价", "价格"), "{价格}*{价格}+{单价2}");
  assert.equal(renameInFormula("{a.b}*2", "a.b", "$&x"), "{$&x}*2");
});

test("结果的格式：自动是整数就整数、否则最多两位；也能定小数位", () => {
  assert.equal(formatFx(37.5, null), "37.5");
  assert.equal(formatFx(0.1 + 0.2, null), "0.3");
  assert.equal(formatFx(10 / 3, null), "3.33");
  assert.equal(formatFx(6, null), "6");
  assert.equal(formatFx(6, 2), "6.00");
  assert.equal(formatFx(-0.001, 2), "0.00");
  assert.equal(formatFx(-0.001, null), "0");
});

const shop = () => T([["商品", "单价", "数量", "金额"], ["苹果", "12.5", "3", ""], ["梨", "¥1,000", "2", ""], ["桃", "", "4", "旧的"]]);

test("设成计算列：每行算出来写进格子；引用的格子空着的那行留空；注释里记下公式", () => {
  const t = setFormula(shop(), 3, "{单价} * {数量}");
  assert.deepEqual(col(t, 3), ["金额", "37.5", "2000", ""]);
  assert.deepEqual(t.meta.fx, [null, null, null, "{单价} * {数量}"]);
  assert.ok(isFxCell(t, 1, 3) && !isFxCell(t, 0, 3) && !isFxCell(t, 1, 2));
  assert.deepEqual(fxCellNote(t, 3, 3), { reason: "input", name: "单价" });
  assert.equal(fxCellNote(t, 1, 3), null);
  // 写回文件、再读回来
  const lines = serializeTable(t);
  const meta = parseMetaLine(lines[lines.length - 1]);
  assert.deepEqual(meta?.fx, [null, null, null, "{单价} * {数量}"]);
});

test("改了输入格子：normalize 重算；手动改计算列的格子也会被算回来", () => {
  let t = setFormula(shop(), 3, "{单价}*{数量}");
  t = normalize(editCell(t, 1, 2, "10"));
  assert.equal(t.cells[1][3], "125");
  t = normalize(editCell(t, 1, 3, "随便写"));
  assert.equal(t.cells[1][3], "125");
  t = normalize(pasteGrid(t, 2, 1, [["1", "1", "999"]]));
  assert.equal(t.cells[2][3], "1");
});

test("百分数按小数算；小数位能定", () => {
  const t = setFormula(T([["价", "折", "实"], ["200", "80%", ""], ["3", "33.3%", ""]]), 2, "{价}*{折}", 2);
  assert.deepEqual(col(t, 2), ["实", "160.00", "1.00"]);
  assert.deepEqual(t.meta.fxd, [null, null, 2]);
});

test("按行合计：SUM 跳过空着的月份", () => {
  const t = setFormula(T([["人", "一月", "二月", "三月", "合计"], ["甲", "1", "", "3", ""], ["乙", "", "", "", ""]]), 4, "SUM({一月},{二月},{三月})");
  assert.deepEqual(col(t, 4), ["合计", "4", ""]);
});

test("插入行：新行跟着算（输入空着就空着）；删行、排序不影响", () => {
  let t = setFormula(shop(), 3, "{单价}*{数量}");
  t = normalize(insertRow(t, 2));
  assert.deepEqual(col(t, 3), ["金额", "37.5", "", "2000", ""]);
  t = normalize(pasteGrid(t, 2, 1, [["2", "2"]]));
  assert.equal(t.cells[2][3], "4");
  t = normalize(sortRows(t, 3, true, false));
  assert.deepEqual(col(t, 3), ["金额", "2000", "37.5", "4", ""]);
  t = normalize(deleteRow(t, 1));
  assert.deepEqual(col(t, 3), ["金额", "37.5", "4", ""]);
});

test("插入、移动列：公式跟着列走（用的是列名，不用改）", () => {
  let t = setFormula(shop(), 3, "{单价}*{数量}");
  t = normalize(insertCol(t, 0));
  assert.deepEqual(t.meta.fx, [null, null, null, null, "{单价}*{数量}"]);
  t = normalize(moveCol(t, 4, 1));
  assert.equal(t.meta.fx?.[1], "{单价}*{数量}");
  assert.deepEqual(col(t, 1), ["金额", "37.5", "2000", ""]);
});

test("改表头的列名：公式里的旧名跟着改", () => {
  let t = setFormula(shop(), 3, "{单价}*{数量}");
  t = normalize(editCell(t, 0, 1, "价格"));
  assert.equal(t.meta.fx?.[3], "{价格}*{数量}");
  assert.equal(t.cells[1][3], "37.5");
  // 粘贴改了表头也跟着
  t = normalize(pasteGrid(t, 0, 2, [["件数"]]));
  assert.equal(t.meta.fx?.[3], "{价格}*{件数}");
});

test("删了被引用的列：计算列整列留空、表头报「找不到列」，撤销（旧表）不受影响", () => {
  const t = setFormula(shop(), 3, "{单价}*{数量}");
  const n = normalize(deleteCol(t, 1));
  assert.deepEqual(n.cells.map((r) => r[2]), ["金额", "", "", ""]);
  assert.deepEqual(formulaError(n, 2), { code: "unknownCol", name: "单价" });
  assert.deepEqual(fxCellNote(n, 1, 2), { code: "unknownCol", name: "单价" });
  assert.equal(t.cells[1][3], "37.5");
});

test("重名的列不能引用；引用自己报错；复制计算列还是计算列", () => {
  const t = T([["a", "a", "b"], ["1", "2", ""]]);
  assert.deepEqual(checkFormula(t, 2, "{a}*2"), { error: { code: "ambiguous", name: "a" } });
  assert.deepEqual(checkFormula(t, 2, "{b}*2"), { error: { code: "self", name: "b" } });
  const s = setFormula(shop(), 3, "{单价}*{数量}");
  const d = normalize(duplicateCol(s, 3));
  assert.equal(d.meta.fx?.[4], "{单价}*{数量}");
  assert.deepEqual(col(d, 4), ["金额", "37.5", "2000", ""]);
});

test("计算列引用另一个计算列：按依赖顺序算；绕成圈的都报错", () => {
  let t = T([["价", "量", "小计", "税", "总"], ["10", "2", "", "", ""]]);
  t = setFormula(t, 4, "{小计}+{税}");
  t = setFormula(t, 3, "{小计}*0.1");
  t = setFormula(t, 2, "{价}*{量}");
  assert.deepEqual(t.cells[1], ["10", "2", "20", "2", "22"]);
  assert.deepEqual(checkFormula(t, 2, "{总}*2"), { error: { code: "cycle" } });
  const loop = normalize({ ...t, meta: { ...t.meta, fx: [null, null, "{总}", "{小计}*0.1", "{小计}+{税}"] } });
  assert.deepEqual(formulaError(loop, 2), { code: "cycle" });
  assert.deepEqual(formulaError(loop, 4), { code: "cycle" });
  assert.deepEqual(formulaError(loop, 3), null);
});

test("编辑框的预览：第一行数据的值和结果；算不出来给原因", () => {
  const t = shop();
  assert.deepEqual(checkFormula(t, 3, "{单价}*{数量}"), {
    refs: [
      { name: "单价", value: 12.5 },
      { name: "数量", value: 3 },
    ],
    result: "37.5",
  });
  const z = T([["a", "b"], ["1", ""]]);
  assert.deepEqual(checkFormula(z, 1, "{a}/0"), { refs: [{ name: "a", value: 1 }], result: null, empty: { reason: "div0" } });
  assert.deepEqual(checkFormula(z, 1, "{x}"), { error: { code: "unknownCol", name: "x" } });
  assert.deepEqual(checkFormula(z, 1, "(1"), { error: { code: "paren" } });
});

test("取消计算列：格子里留着最后算出的数", () => {
  const t = setFormula(setFormula(shop(), 3, "{单价}*{数量}", 1), 3, null);
  assert.equal(t.meta.fx, undefined);
  assert.equal(t.meta.fxd, undefined);
  assert.deepEqual(col(t, 3), ["金额", "37.5", "2000.0", ""]);
  assert.equal(isFxCell(t, 1, 3), false);
});

test("和合计行一起：合计行不算公式，合计的是算出来的数", () => {
  let t = setFormula(shop(), 3, "{单价}*{数量}");
  t = setCalc(t, 3, "sum");
  assert.deepEqual(col(t, 3), ["金额", "37.5", "2000", "", "2037.5"]);
  assert.equal(isFxCell(t, 4, 3), false);
  t = normalize(editCell(t, 1, 2, "4"));
  assert.deepEqual(col(t, 3), ["金额", "50", "2000", "", "2050"]);
});

test("多行表头：列名取表头最后一行；合并的表头取左上角", () => {
  const t = T([["一季度", "", ""], ["单价", "数量", "金额"], ["2", "3", ""]]);
  t.meta.head = 2;
  t.meta.merge = ["A1:C1"];
  assert.deepEqual(columnNames(t), ["单价", "数量", "金额"]);
  const n = setFormula(t, 2, "{单价}*{数量}");
  assert.equal(n.cells[2][2], "6");
  const v = T([["名", "x"], ["", "y"], ["1", ""]]);
  v.meta.head = 2;
  v.meta.merge = ["A1:A2"];
  assert.deepEqual(columnNames(v), ["名", "y"]);
});

test("截取一块：引用的列都在里面才带着公式，不然只留数", () => {
  const t = setFormula(shop(), 3, "{单价}*{数量}");
  const all = subTable(t, { r1: 0, c1: 1, r2: 2, c2: 3 });
  assert.deepEqual(all.meta.fx, [null, null, "{单价}*{数量}"]);
  const part = subTable(t, { r1: 0, c1: 2, r2: 2, c2: 3 });
  assert.equal(part.meta.fx, undefined);
  assert.deepEqual(part.cells.map((r) => r[1]), ["金额", "37.5", "2000"]);
});

test("注释里写坏了的公式：读进来照样是计算列，整列留空、表头报错", () => {
  const meta = parseMetaLine('<!-- gogoga-table: {"fx":[null,"{a}*(2",3,""],"fxd":[null,9,1,null]} -->')!;
  assert.deepEqual(meta.fx, [null, "{a}*(2", null, null]);
  assert.deepEqual(meta.fxd, [null, null, 1, null]);
  const t = T([["a", "b", "c", "d"], ["1", "旧", "", ""]]);
  t.meta = meta;
  const n = normalize(t);
  assert.equal(n.cells[1][1], "");
  assert.deepEqual(formulaError(n, 1), { code: "paren" });
});
