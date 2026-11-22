import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTextRows } from "../../src/core/text-table";

// 「文字转表格」：小红书 Momo 的建议，豆包这类地方复制来的表格贴进来是一行行文字，要能认出列
test("制表符照旧", () => {
  assert.deepEqual(splitTextRows("姓名\t年龄\n张三\t18"), [["姓名", "年龄"], ["张三", "18"]]);
});
test("Markdown 表格的样子：去掉两头竖线和分隔行", () => {
  assert.deepEqual(splitTextRows("| 姓名 | 年龄 |\n| --- | :---: |\n| 张三 | 18 |"), [[" 姓名 ", " 年龄 "], [" 张三 ", " 18 "]]);
});
test("竖线表格里的 \\| 是格子里的竖线", () => {
  assert.deepEqual(splitTextRows("| a \\| b | c |\n| 1 | 2 |"), [[" a | b ", " c "], [" 1 ", " 2 "]]);
});
test("逗号（CSV）照旧，中文逗号也算", () => {
  assert.deepEqual(splitTextRows("a,b\n1，2"), [["a", "b"], ["1", "2"]]);
});
test("两个以上空格分列：格子里的单个空格留着", () => {
  assert.deepEqual(splitTextRows("产品名称    单价    备注\nApple Pencil    899    二代 白色\n键盘    1299    无"), [["产品名称", "单价", "备注"], ["Apple Pencil", "899", "二代 白色"], ["键盘", "1299", "无"]]);
});
test("全角空格分列", () => {
  assert.deepEqual(splitTextRows("姓名　年龄\n张三　18"), [["姓名", "年龄"], ["张三", "18"]]);
});
test("只有单个空格、每行列数一样：按空格分", () => {
  assert.deepEqual(splitTextRows("姓名 年龄 城市\n张三 18 北京"), [["姓名", "年龄", "城市"], ["张三", "18", "北京"]]);
});
test("单个空格但各行列数不一样：不按空格拆，整行一格（和以前一样）", () => {
  assert.deepEqual(splitTextRows("今天 天气 很好\n明天 下雨"), [["今天 天气 很好"], ["明天 下雨"]]);
});
test("逗号列数不齐但两个空格齐：按两个空格", () => {
  assert.deepEqual(splitTextRows("名称  说明\n甲  一,二,三\n乙  四"), [["名称", "说明"], ["甲", "一,二,三"], ["乙", "四"]]);
});
