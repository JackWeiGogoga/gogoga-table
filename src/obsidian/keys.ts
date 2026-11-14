/**
 * 光标在表格里时接管 Obsidian 的编辑器快捷键。
 * Obsidian 在最外层就把 ⌘B、⌘I、⌘K、⌘/ 这些编辑器命令的快捷键拦下，作用到 Markdown 编辑器自己的光标上——
 * 表格里按 ⌘B 会把 `****` 插进正文（2026-11-06 实测）。这里在表格的输入框拿到焦点时压一个快捷键作用域：
 * 是编辑器命令的快捷键（按用户实际的设置，包括改过的）一律拦下，其中加粗、斜体、删除线、高亮、链接交给表格自己处理；
 * 命令面板、切换标签页这类不是编辑器命令的照常放行。
 */

import { type App, type Modifier, Scope } from "obsidian";
import type { TableEditor } from "../editor/editor";

interface Hotkey {
  modifiers: string[];
  key: string;
}

interface HotkeyManager {
  getHotkeys(id: string): Hotkey[] | undefined;
  getDefaultHotkeys(id: string): Hotkey[] | undefined;
}

interface CommandLike {
  id: string;
  editorCallback?: unknown;
  editorCheckCallback?: unknown;
}

/** Obsidian 的格式命令 → 表格里对应的格式。用户把这些命令改成了别的快捷键，在表格里按也照样起作用 */
const FORMAT_COMMANDS: Record<string, "bold" | "italic" | "strike" | "highlight" | "link"> = {
  "editor:toggle-bold": "bold",
  "editor:toggle-italics": "italic",
  "editor:toggle-strikethrough": "strike",
  "editor:toggle-highlight": "highlight",
  "editor:insert-link": "link",
};

/** 编辑器命令的快捷键（用户改过的优先，没改的用默认），带上是哪个命令 */
function editorHotkeys(app: App): (Hotkey & { command?: string })[] {
  const a = app as unknown as { hotkeyManager?: HotkeyManager; commands?: { commands?: Record<string, CommandLike> } };
  const hm = a.hotkeyManager;
  const cmds = Object.values(a.commands?.commands ?? {});
  const out: (Hotkey & { command?: string })[] = [];
  for (const c of cmds) {
    if (!c.editorCallback && !c.editorCheckCallback) continue;
    const keys = hm?.getHotkeys(c.id) ?? hm?.getDefaultHotkeys(c.id) ?? [];
    out.push(...keys.map((k) => ({ ...k, command: c.id })));
  }
  return out;
}

/** 表格自己处理的格式键（就算用户把对应的编辑器命令改成了别的键，也照样能用） */
const OWN: Hotkey[] = [
  { modifiers: ["Mod"], key: "B" },
  { modifiers: ["Mod"], key: "I" },
  { modifiers: ["Mod"], key: "K" },
  { modifiers: ["Mod", "Shift"], key: "X" },
  { modifiers: ["Mod", "Shift"], key: "H" },
];

/** 拿不到快捷键表时的兜底：常见的编辑器快捷键 */
const FALLBACK: Hotkey[] = ["B", "I", "K", "/", "L", "Enter", "]", "["].map((key) => ({ modifiers: ["Mod"], key }));

/** 表格的输入框拿到 / 失去焦点时压入 / 弹出作用域 */
export function guardEditorHotkeys(app: App, editor: TableEditor): () => void {
  let scope: Scope | null = null;
  const onIn = () => {
    if (scope) return;
    scope = new Scope(app.scope);
    // 只注册编辑器命令的快捷键（加上表格自己的格式键）：没注册的键照常交给 Obsidian（⌘P、切换标签页……）
    const list = editorHotkeys(app);
    const keys: (Hotkey & { command?: string })[] = [...(list.length ? list : FALLBACK), ...OWN];
    const seen = new Set<string>();
    for (const hk of keys) {
      const id = [...hk.modifiers].sort().join("+") + "+" + hk.key.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      const format = hk.command ? FORMAT_COMMANDS[hk.command] : undefined;
      scope.register(hk.modifiers as Modifier[], hk.key, (ev: KeyboardEvent) => {
        // 加粗、斜体、删除线、高亮、链接由表格处理（按 ⌘B 这类固定键，或用户给这几个命令设的键）；
        // 别的编辑器命令直接拦下，不让它改到正文
        if (!editor.formatKey(ev) && format) editor.formatCommand(format);
        return false;
      });
    }
    app.keymap.pushScope(scope);
  };
  const onOut = () => {
    if (!scope) return;
    app.keymap.popScope(scope);
    scope = null;
  };
  const root = editor.root;
  root.addEventListener("focusin", onIn);
  root.addEventListener("focusout", onOut);
  return () => {
    onOut();
    root.removeEventListener("focusin", onIn);
    root.removeEventListener("focusout", onOut);
  };
}
