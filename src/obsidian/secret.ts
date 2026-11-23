/** 加密列在 Obsidian 里的部分：主密码弹窗、确认框、钥匙串，拼出所有表格共用的 SecretBox */

import { type App, Modal, Notice, Setting, TextFileView } from "obsidian";
import { findSecrets } from "../core/secret";
import { SecretBox } from "../core/secret-box";
import { t } from "../editor/i18n";

export interface SecretSettings {
  /** 多久不用自动锁上（分钟，0 不自动锁） */
  secretLock: number;
  /** 钥匙串里存主密码的那项的 id（空的不用钥匙串） */
  secretKeychain: string;
  /** 校验密文：主密码加密的固定文字（带提示）。核对主密码、所有格子共用它的 salt */
  secretCheck?: string;
}

/** 主密码弹窗：setup 输两遍 + 提示；unlock 输一遍，错了留在弹窗里提示 */
class PasswordModal extends Modal {
  private result: { password: string; hint: string } | null = null;

  constructor(
    app: App,
    private readonly mode: "setup" | "unlock" | "change",
    private readonly hint: string,
    private readonly verify: (password: string) => Promise<boolean>,
    private readonly done: (r: { password: string; hint: string } | null) => void,
    private readonly keychainWrong = false,
  ) {
    super(app);
  }

  onOpen(): void {
    const setup = this.mode !== "unlock";
    this.titleEl.setText(t(this.mode === "setup" ? "encSetupTitle" : this.mode === "change" ? "encRekeyTitle" : "encUnlockTitle"));
    this.modalEl.addClass("ggt-secret-modal");
    const { contentEl } = this;
    if (setup) contentEl.createEl("p", { text: t("encSetupDesc"), cls: "setting-item-description" });
    else if (this.hint) contentEl.createEl("p", { text: t("encHintIs").replace("{v}", this.hint), cls: "setting-item-description" });
    if (!setup && this.keychainWrong) contentEl.createEl("p", { text: t("encKeychainWrong"), cls: "ggt-secret-keychain-wrong" });
    const field = (label: string, type: string) => {
      const input = contentEl.createEl("input", { type, cls: "ggt-secret-input" });
      input.placeholder = label;
      input.setAttribute("aria-label", label);
      return input;
    };
    const pw = field(t("encPassword"), "password");
    const pw2 = setup ? field(t("encPassword2"), "password") : null;
    const hint = setup ? field(t("encHint"), "text") : null;
    const error = contentEl.createDiv({ cls: "ggt-secret-error" });
    let busy = false;
    const submit = async () => {
      if (busy) return;
      error.setText("");
      if (!pw.value) return error.setText(t("encEmpty"));
      if (pw2 && pw2.value !== pw.value) return error.setText(t("encMismatch"));
      busy = true;
      const ok = await this.verify(pw.value);
      busy = false;
      if (!ok) {
        error.setText(t("encWrong"));
        pw.select();
        return;
      }
      this.result = { password: pw.value, hint: hint?.value.trim() ?? "" };
      this.close();
    };
    for (const el of [pw, pw2, hint])
      el?.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" || ev.isComposing) return;
        ev.preventDefault();
        void submit();
      });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText(t("encCancel")).onClick(() => this.close()))
      .addButton((b) => b.setButtonText(t("encOk")).setCta().onClick(() => void submit()));
    window.setTimeout(() => pw.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    this.done(this.result);
  }
}

/** 确认框 */
export function confirmBox(app: App, message: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => {
    let yes = false;
    const m = new Modal(app);
    m.contentEl.createEl("p", { text: message });
    new Setting(m.contentEl)
      .addButton((b) => b.setButtonText(t("encCancel")).onClick(() => m.close()))
      .addButton((b) => {
        b.setButtonText(ok).onClick(() => {
          yes = true;
          m.close();
        });
        // 红色按钮：新版本叫 setDestructive，旧版本只有 setWarning
        const btn = b as unknown as { setDestructive?: () => unknown; setWarning: () => unknown };
        if (btn.setDestructive) btn.setDestructive();
        else btn.setWarning();
      });
    m.onClose = () => resolve(yes);
    m.open();
  });
}

/** 钥匙串（Obsidian 1.11.4 起有）：没有这个功能返回 null */
export function keychain(app: App): { getSecret(id: string): string | null } | null {
  const s = (app as unknown as { secretStorage?: { getSecret?(id: string): string | null } }).secretStorage;
  return s && typeof s.getSecret === "function" ? (s as { getSecret(id: string): string | null }) : null;
}

/** 所有表格共用的主密码会话 */
export function makeSecretBox(app: App, settings: () => SecretSettings, persist: () => void): SecretBox {
  return new SecretBox({
    ask: (mode, hint, verify, keychainWrong) => new Promise((resolve) => new PasswordModal(app, mode, hint, verify, resolve, keychainWrong).open()),
    loadCheck: () => settings().secretCheck ?? null,
    saveCheck: (check) => {
      settings().secretCheck = check;
      persist();
    },
    remembered: () => {
      const id = settings().secretKeychain;
      if (!id) return null;
      try {
        return keychain(app)?.getSecret(id) || null;
      } catch {
        return null;
      }
    },
    lockAfter: () => Math.max(0, settings().secretLock) * 60000,
    later: (fn, ms) => {
      const id = window.setTimeout(fn, ms);
      return () => window.clearTimeout(id);
    },
  });
}

/**
 * 更改主密码：把库里所有笔记中用旧主密码加密的内容（表格的加密格子，也包括 Meld Encrypt 用同一密码加密的行内内容）
 * 换成新主密码加密的。先数一遍、确认，再问新密码；全部写好才换掉校验密文。
 * 用别的密码加密的、整篇加密的 .mdenc 文件不动。
 *
 * 不能漏：漏掉的一段还是旧密码，换完校验密文后就再也解不开了。所以先把打开着的笔记存盘、读磁盘上的原文（不用缓存），
 * 写的时候文件又变了就按新内容重算这个文件
 */
export async function changeMasterPassword(app: App, box: SecretBox, keychainUsed: boolean): Promise<void> {
  await saveOpenNotes(app);
  const scan = async () => {
    const out: { path: string; text: string; segs: string[] }[] = [];
    for (const f of app.vault.getMarkdownFiles()) {
      const text = await app.vault.read(f);
      if (!text.includes("🔐")) continue;
      const segs = [...new Set(findSecrets(text))];
      if (segs.length) out.push({ path: f.path, text, segs });
    }
    return out;
  };
  const found = await scan();
  const all = found.flatMap((x) => x.segs);
  if (!(await box.unlock(all))) return;
  await box.openAll(all);
  const mineOf = (segs: string[]) => segs.filter((s) => typeof box.peek(s) === "string");
  const mine = found.filter((x) => mineOf(x.segs).length);
  const n = mine.reduce((a, x) => a + mineOf(x.segs).length, 0);
  const other = all.length - n;
  const msg = t("encRekeyConfirm").replace("{n}", String(n)).replace("{f}", String(mine.length)) + (other ? " " + t("encRekeyOther").replace("{n}", String(other)) : "");
  if (!(await confirmBox(app, msg, t("encRekeyGo")))) return;
  const rk = await box.beginRekey();
  if (!rk) return;
  /** 一个文件里旧密码的每一段 → 新密文；有一段换不了返回 null */
  const resealAll = async (text: string): Promise<[string, string][] | null> => {
    const segs = [...new Set(findSecrets(text))];
    await box.openAll(segs);
    const pairs: [string, string][] = [];
    for (const seg of mineOf(segs)) {
      const next = await rk.reseal(seg);
      if (next === null) return null;
      pairs.push([seg, next]);
    }
    return pairs;
  };
  // 先全部算好，有一段出问题就整个放弃（一个文件都不改，主密码不变）
  const plan: { path: string; text: string; pairs: [string, string][] }[] = [];
  await saveOpenNotes(app);
  for (const x of await scan()) {
    const pairs = await resealAll(x.text);
    if (!pairs) {
      new Notice(t("encRekeyFailed"));
      return;
    }
    if (pairs.length) plan.push({ path: x.path, text: x.text, pairs });
  }
  const apply = (data: string, pairs: [string, string][]) => pairs.reduce((out, [a, b]) => out.split(a).join(b), data);
  let files = 0;
  for (const x of plan) {
    const f = app.vault.getFileByPath(x.path);
    if (!f) continue;
    let text = x.text;
    let pairs = x.pairs;
    // 读完以后文件又被改了：按新内容重算，最多几次
    for (let tries = 0; tries < 5; tries++) {
      let stale = false;
      await app.vault.process(f, (data) => {
        if (data !== text) {
          stale = true;
          return data;
        }
        return apply(data, pairs);
      });
      if (!stale) break;
      text = await app.vault.read(f);
      const again = await resealAll(text);
      if (!again) break;
      pairs = again;
    }
    files++;
  }
  rk.commit();
  const done = plan.reduce((a, x) => a + x.pairs.length, 0);
  new Notice(t("encRekeyDone").replace("{n}", String(done)).replace("{f}", String(files)) + (keychainUsed ? " " + t("encRekeyKeychain") : ""), 10000);
}

/** 打开着的笔记先存盘（Markdown 编辑器、脑图这类文本文件视图）：还没存的改动也要算进去 */
async function saveOpenNotes(app: App): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof TextFileView && leaf.view.file) jobs.push(leaf.view.save());
  });
  await Promise.all(jobs);
}
