import assert from "node:assert/strict";
import test from "node:test";
import { applyChanges, diffOne, diffText } from "../../src/core/diff";

const round = (a: string, b: string, base = 0) => {
  const ch = diffText(a, b, base);
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i].from >= ch[i - 1].to, "改动按顺序、不重叠");
  assert.equal(applyChanges(a, ch, base), b, `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  return ch;
};

test("改一个格子：只有一处、只动那几个字", () => {
  const a = "| a | b |\n| --- | --- |\n| 1 | 22 |\n| 3 | 4 |";
  const b = "| a | b |\n| --- | --- |\n| 1 | 25 |\n| 3 | 4 |";
  const ch = round(a, b, 100);
  assert.equal(ch.length, 1);
  assert.deepEqual(ch[0], { from: 100 + a.indexOf("22") + 1, to: 100 + a.indexOf("22") + 2, insert: "5" });
});

test("相同：没有改动", () => assert.deepEqual(diffText("x\ny", "x\ny"), []));

test("对齐模式一列变宽：每行各一小段，不是整段", () => {
  const a = "| a   | b |\n| --- | - |\n| 1   | 2 |";
  const b = "| a     | b |\n| ----- | - |\n| 12345 | 2 |";
  const ch = round(a, b);
  assert.equal(ch.length, 3);
  assert.ok(ch.every((c) => c.to - c.from <= 3 && c.insert.length <= 5), JSON.stringify(ch));
});

test("插入、删除行：一处改动", () => {
  const a = "| a |\n| - |\n| 1 |\n| 2 |";
  const b = "| a |\n| - |\n| 1 |\n|  |\n| 2 |";
  assert.equal(round(a, b).length, 1);
  assert.equal(round(b, a).length, 1);
});

test("重复字符、清空、全换、注释行变化", () => {
  round("aaaa", "aa");
  round("aa", "aaaa");
  round("abc", "");
  round("", "x");
  round("| 1 |\n<!-- gogoga-table: {} -->", "| 1 |\n<!-- gogoga-table: {\"bg\":{}} -->");
  round("x\ny\nz", "q\ny\nw");
});

test("emoji 不拆成两半", () => {
  for (const [a, b] of [["😀", "😃"], ["a😀b", "a😃b"], ["😀😀", "😀"], ["x😀", "x😁"]]) {
    const d = diffOne(a, b)!;
    assert.ok(!/[\udc00-\udfff]/.test(d.insert[0] ?? "") && !/[\ud800-\udbff]/.test(d.insert.slice(-1)), JSON.stringify(d));
    assert.ok(!/[\udc00-\udfff]/.test(a[d.from] ?? "") || d.from === 0, "起点不在后半个");
    round(a, b);
  }
});

test("随机往返", () => {
  const al = ["a", "b", "|", " ", "\n", "中", "😀"];
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  const s = () => Array.from({ length: rnd(20) }, () => al[rnd(al.length)]).join("");
  for (let i = 0; i < 3000; i++) round(s(), s(), rnd(50));
});
