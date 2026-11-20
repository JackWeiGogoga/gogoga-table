/**
 * 加密列：密文格式和 Meld Encrypt 3.x（γ，v3）互通、主密码会话（设置、核对、共用 salt、锁定、钥匙串）、
 * 表格读写原样保留密文、加密列里混进明文的判断
 */
import assert from "node:assert/strict";
import test from "node:test";
import { decryptText, encryptText, isSealed, openData, parseSecret, secretParts, writeSecret } from "../../src/core/secret";
import { SecretBox, type SecretBoxIO } from "../../src/core/secret-box";
import { colKindOf, editCell, setColKind } from "../../src/core/ops";
import { parseMetaLine, parseTable, serializeTable } from "../../src/core/table";
import { freshPlain } from "../../src/editor/editor";

// 用 Meld Encrypt 3.1.1 的源码（CryptoHelperV3 + 行内写法）生成的密文，密码 correct horse
const MELD_HIDDEN = "%%🔐γ AQNbYDdwa/E6/R+Z9zkkA8y4kQTme2rv4ZR/35XYJwd9qph7SG5PjAPVZ+lo3zaq7YrBJaP7fBwJxBNy1anV75DyvxXca4SR+jtcAI+NqA== 🔐%%";
const MELD_HINTED = "🔐γ 💡我的提示💡AQNbYCD/D9bzyIK9rrfkSfL5ro6U58tU929EiZQeTdPcNtDUa4vBmPWcJ890nLksjXTrawQ7 🔐";

test("解开 Meld Encrypt 写的行内密文（藏起来的、带提示看得见的）", async () => {
  assert.equal(await decryptText("correct horse", MELD_HIDDEN), "密码 p@ss|w0rd 🔑\n第二行");
  assert.equal(await decryptText("correct horse", MELD_HINTED), "hinted");
  assert.equal(await decryptText("wrong", MELD_HIDDEN), null);
  assert.equal(parseSecret(MELD_HINTED)?.hint, "我的提示");
  assert.equal(parseSecret(MELD_HINTED)?.shown, true);
});

test("自己加密再解开：竖线、换行、emoji、很长的文字", async () => {
  for (const s of ["a|b", "第一行\n第二行", "🔑🙂", "x".repeat(5000)]) {
    const c = await encryptText("pw", s);
    assert.ok(c.startsWith("%%🔐γ ") && c.endsWith(" 🔐%%"));
    assert.ok(!c.includes("|"), "密文里不能有竖线（会拆坏表格）");
    assert.equal(await decryptText("pw", c), s);
  }
});

// Meld 更早的 β（v2，CryptoHelper2304(16, 16, 210000)）写的，密码 correct horse
const MELD_BETA = "%%🔐β DkPa6ND8ocaIJM3EO74TvUoSzDL7d/7njGHNvaT41n2JL5w31XHp3osoMcBtzCn8BCZWkwCPtBFnZhPThtZATw== 🔐%%";
const MELD_BETA_HINTED = "🔐β 💡老提示💡P4EyGdLv4MaYMvFECAxCtUeUCiL19Ifm8Nj2Sga8b1vspO8jOLjYlGPVlXwOCJVZq4Ygh/veCjKKw+3H 🔐";

test("也解得开 Meld 更早的 β 写法", async () => {
  assert.equal(await decryptText("correct horse", MELD_BETA), "旧版 β|格式");
  assert.equal(await decryptText("correct horse", MELD_BETA_HINTED), "visible beta");
  assert.equal(await decryptText("nope", MELD_BETA), null);
  assert.equal(parseSecret(MELD_BETA_HINTED)?.hint, "老提示");
  assert.equal(parseSecret(MELD_BETA)?.v, 2);
  assert.ok(isSealed(`${MELD_BETA}\n${MELD_HIDDEN}`));
});

test("认不出的写法：α、乱码、缺结尾、base64 不对", () => {
  for (const bad of ["%%🔐α abc= 🔐%%", "%%🔐γ abc", "%%🔐γ !!!! 🔐%%", "%%🔐γ 💡没有结束abc= 🔐%%", "普通文字", ""]) assert.equal(parseSecret(bad), null, bad);
  // 版本字节、迭代次数不对的拆不开
  assert.equal(openData(btoa("x".repeat(60))), null);
});

test("整格只有密文（合并格子拼起来的几段也算）才算加密好了", async () => {
  const a = await encryptText("pw", "甲");
  const b = await encryptText("pw", "乙");
  assert.ok(isSealed(a));
  assert.ok(isSealed(""));
  assert.ok(isSealed(`${a}\n${b}`));
  assert.equal(secretParts(`${a}\n${b}`)?.length, 2);
  assert.ok(!isSealed(`${a} 明文`));
  assert.ok(!isSealed("明文"));
});

test("表格读写原样保留密文；ty 里的 enc 认得，多余字段去掉", async () => {
  const c = await encryptText("pw", "s3cret|x");
  const src = ["| 网站 | 密码 |", "| --- | --- |", `| GitHub | ${c} |`];
  const t = parseTable(src, parseMetaLine('<!-- gogoga-table: {"ty":[null,{"t":"enc","zz":1}]} -->'))!;
  assert.equal(t.cells[1][1], c);
  assert.equal(colKindOf(t, 1), "enc");
  assert.deepEqual(t.meta.ty, [null, { t: "enc" }]);
  const out = serializeTable(t);
  assert.ok(out.some((l) => l.includes(c)));
  assert.equal(parseTable(out.slice(0, 3), null)!.cells[1][1], c);
});

test("加密列里混进新明文（粘贴、填充）才拦；原来就有的明文、密文、空格子不拦", async () => {
  const c = await encryptText("pw", "a");
  const base = setColKind(parseTable(["| 名 | 密 |", "| --- | --- |", `| x | ${c} |`, "| y | 旧明文 |", "| z |  |"], null)!, 1, "enc");
  assert.equal(freshPlain(base, editCell(base, 3, 1, "新明文")), true);
  assert.equal(freshPlain(base, editCell(base, 3, 0, "别的列")), false);
  assert.equal(freshPlain(base, editCell(base, 3, 1, c)), false);
  assert.equal(freshPlain(base, editCell(base, 1, 1, "")), false);
  // 普通列里写明文不管
  const plain = parseTable(["| 名 | 密 |", "| --- | --- |", "| x | a |"], null)!;
  assert.equal(freshPlain(plain, editCell(plain, 1, 1, "b")), false);
});

/** 假的宿主：按顺序回答密码弹窗，记下弹了几次、存的校验密文 */
function fakeIO(answers: (string | null)[], opts: { lockAfter?: number; remembered?: string } = {}) {
  const log = { asks: [] as string[], check: null as string | null, changed: 0, wrongTries: 0 };
  const io: SecretBoxIO = {
    ask: async (mode, _hint, verify) => {
      log.asks.push(mode);
      for (;;) {
        const a = answers.shift();
        if (a === undefined || a === null) return null;
        if (await verify(a)) return { password: a, hint: mode === "setup" ? "猫的名字" : "" };
        log.wrongTries++;
      }
    },
    loadCheck: () => log.check,
    saveCheck: (c) => (log.check = c),
    remembered: () => opts.remembered ?? null,
    lockAfter: () => opts.lockAfter ?? 0,
    later: (fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
    changed: () => log.changed++,
  };
  return { io, log };
}

test("第一次设主密码、存校验密文（带提示）；之后加密的格子都用它的 salt", async () => {
  const { io, log } = fakeIO(["master"]);
  const box = new SecretBox(io);
  assert.equal(await box.unlock(), true);
  assert.deepEqual(log.asks, ["setup"]);
  assert.ok(log.check);
  assert.equal(parseSecret(log.check!)?.hint, "猫的名字");
  const a = await box.seal("甲");
  const b = await box.seal("乙");
  assert.notEqual(a, b);
  const salt = (s: string) => Array.from(openData(parseSecret(s)!.data)!.salt).join();
  assert.equal(salt(a), salt(log.check!));
  assert.equal(salt(b), salt(log.check!));
  assert.equal(box.peek(a), "甲");
  assert.equal(await decryptText("master", b), "乙", "别的工具（Meld）用同一个密码能解开");
  assert.equal(await box.seal("  "), "");
});

test("再次解锁按校验密文核对：错了留在弹窗里重输；取消返回 false", async () => {
  const first = fakeIO(["master"]);
  const box1 = new SecretBox(first.io);
  await box1.unlock();
  const sealed = await box1.seal("机密");

  const { io, log } = fakeIO(["oops", "master"]);
  log.check = first.log.check;
  const box = new SecretBox(io);
  assert.equal(box.peek(sealed), undefined);
  assert.equal(await box.unlock(), true);
  assert.deepEqual(log.asks, ["unlock"]);
  assert.equal(log.wrongTries, 1);
  assert.equal(await box.open(sealed), "机密");

  const cancel = fakeIO([null]);
  cancel.log.check = first.log.check;
  assert.equal(await new SecretBox(cancel.io).unlock(), false);
});

test("新设备上没有校验密文：拿要解的格子核对，再补一段校验密文", async () => {
  const { io, log } = fakeIO(["wrong", "correct horse"]);
  const box = new SecretBox(io);
  assert.equal(await box.unlock([MELD_HIDDEN]), true);
  assert.equal(log.wrongTries, 1);
  assert.ok(log.check);
  assert.equal(await box.open(MELD_HIDDEN), "密码 p@ss|w0rd 🔑\n第二行");
  assert.equal(await box.open(MELD_BETA), "旧版 β|格式", "β 的格子用同一个主密码也解得开");
});

test("解不开的格子（别的密码加密的）peek 是 null；锁上后什么都看不到", async () => {
  const other = await encryptText("另一个密码", "x");
  const { io, log } = fakeIO(["master"]);
  const box = new SecretBox(io);
  await box.unlock();
  const mine = await box.seal("我的");
  await box.openAll([other, mine]);
  assert.equal(box.peek(other), null);
  assert.equal(box.peek(mine), "我的");
  assert.equal(box.peek("明文"), undefined);
  assert.equal(box.peek(""), "");
  const changed = log.changed;
  let heard = 0;
  const off = box.subscribe(() => heard++);
  box.lock();
  off();
  box.lock();
  assert.equal(heard, 1, "订阅的编辑器听到一次锁上；取消订阅后不再听到");
  assert.equal(box.unlocked, false);
  assert.equal(box.peek(mine), undefined);
  assert.equal(log.changed, changed + 1);
  await assert.rejects(box.seal("x"));
});

test("同时好几处要解锁只弹一次；钥匙串里的密码对就不弹", async () => {
  const { io, log } = fakeIO(["master"]);
  const box = new SecretBox(io);
  const [a, b] = await Promise.all([box.unlock(), box.unlock()]);
  assert.ok(a && b);
  assert.equal(log.asks.length, 1);

  const kc = fakeIO([], { remembered: "master" });
  kc.log.check = log.check;
  const box2 = new SecretBox(kc.io);
  assert.equal(await box2.unlock(), true);
  assert.equal(kc.log.asks.length, 0);

  // 钥匙串里的不对：照常弹窗
  const bad = fakeIO(["master"], { remembered: "not it" });
  bad.log.check = log.check;
  assert.equal(await new SecretBox(bad.io).unlock(), true);
  assert.deepEqual(bad.log.asks, ["unlock"]);
});

test("不用了自动锁上；用一下重新计时", async () => {
  const { io } = fakeIO(["master"], { lockAfter: 60 });
  const box = new SecretBox(io);
  await box.unlock();
  await new Promise((r) => setTimeout(r, 40));
  box.touch();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(box.unlocked, true);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(box.unlocked, false);
});

test("换主密码：旧密文换成新密码的（写法、提示照旧，β 也换成 γ），commit 后才用新密码", async () => {
  const answers = ["old", "new"];
  const log = { check: null as string | null };
  const box = new SecretBox({
    ask: async () => ({ password: answers.shift()!, hint: "新提示" }),
    loadCheck: () => log.check,
    saveCheck: (c) => (log.check = c),
    lockAfter: () => 0,
    later: () => () => {},
    changed: () => {},
  });
  await box.unlock();
  const a = await box.seal("甲");
  const shownHinted = writeSecret(parseSecret(await encryptText("old", "乙"))!.data, "旧提示", true);
  const rk = (await box.beginRekey())!;
  const a2 = (await rk.reseal(a))!;
  const b2 = (await rk.reseal(shownHinted))!;
  assert.equal(await rk.reseal(MELD_HIDDEN), null, "别的密码的不动");
  assert.equal(await decryptText("new", a2), "甲");
  assert.equal(await decryptText("old", a2), null);
  assert.equal(parseSecret(b2)?.hint, "旧提示");
  assert.equal(parseSecret(b2)?.shown, true);
  // commit 之前：还是旧密码
  const oldCheck = log.check;
  assert.equal(await box.open(a), "甲");
  rk.commit();
  assert.notEqual(log.check, oldCheck);
  assert.equal(parseSecret(log.check!)?.hint, "新提示");
  assert.equal(await decryptText("new", log.check!), "gogoga-table");
  assert.equal(await box.open(a2), "甲");
  assert.equal(await decryptText("new", await box.seal("丙")), "丙");
});
