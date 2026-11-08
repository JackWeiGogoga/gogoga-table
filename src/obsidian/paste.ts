/**
 * 在正文里粘贴表格数据（Excel、WPS、Numbers、飞书、Google 表格、网页上的表格）直接生成表格（#1）。
 * 只在剪贴板里「整段就是一张表」时接管：至少 2 行 2 列；HTML 里除了这张表没有别的文字；
 * 纯文字时每行都用制表符分成同样多列。代码块、行内代码、公式、frontmatter、已有表格里不接管
 */

import type { Editor } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { fromTSV } from "../core/clipboard";
import { findTables } from "../core/find";
import { emptyTable, type Table } from "../core/table";
import { gridFromClipboard } from "../editor/editor";

const squash = (s: string) => s.replace(/\s+/g, "");

/** 制表符分隔的文字是不是一张整齐的表：至少 2 行 2 列，每行列数一样 */
export function isTsvTable(text: string): boolean {
  if (!text.includes("\t")) return false;
  // 只去掉末尾的换行：行尾的制表符是最后一格空着（Excel 就这样），不能去
  const rows = fromTSV(text.replace(/[\r\n]+$/, ""));
  if (rows.length < 2 || rows[0].length < 2 || !rows.every((r) => r.length === rows[0].length)) return false;
  // 每行都以制表符开头：是用 Tab 缩进的代码、文字，不是表
  return !rows.every((r) => r[0] === "");
}

/** 剪贴板里是不是一张表；是就返回各格文字，不是返回 null（交给 Obsidian 照常粘贴） */
export function pastedGrid(data: DataTransfer, doc: Document): string[][] | null {
  const html = data.getData("text/html");
  const text = data.getData("text/plain");
  let ok = isTsvTable(text);
  if (!ok && html && /<table/i.test(html)) {
    const body = new (doc.defaultView ?? window).DOMParser().parseFromString(html, "text/html").body;
    const tables = body.querySelectorAll("table");
    // 网页上连表格带前后文字一起复制的：不接管，不然别的文字就丢了
    ok = tables.length === 1 && squash(body.textContent ?? "") === squash(tables[0].textContent ?? "");
  }
  if (!ok) return null;
  const grid = gridFromClipboard(data, doc);
  if (!grid || grid.length < 2) return null;
  const width = Math.max(...grid.map((r) => r.length));
  return width >= 2 ? grid : null;
}

/** 第一行当表头，列数按最多的那行补齐 */
export function gridToTable(grid: readonly (readonly string[])[]): Table {
  const width = Math.max(...grid.map((r) => r.length));
  const t = emptyTable(grid.length, width);
  grid.forEach((row, i) => row.forEach((v, j) => (t.cells[i][j] = v.trim())));
  return t;
}

/** 这一行在代码块、公式块（$$）、开头的 frontmatter 里面没有：按行数围栏（空的代码块里语法树认不出来） */
export function inFence(lines: readonly string[], line: number): boolean {
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end < 0 || line <= end) return true;
  }
  let fence: string | null = null;
  for (let i = 0; i < line; i++) {
    const m = /^\s*(`{3,}|~{3,}|\$\$)/.exec(lines[i]);
    if (!m) continue;
    const mark = m[1].startsWith("$") ? "$$" : m[1];
    if (fence === null) fence = mark;
    else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null;
  }
  return fence !== null;
}

/** 光标在代码块、行内代码、公式、frontmatter、已有表格里：不接管 */
export function canPasteTableAt(editor: Editor): boolean {
  const from = editor.getCursor("from");
  const lines = Array.from({ length: editor.lineCount() }, (_, i) => editor.getLine(i));
  if (findTables(lines).some((b) => b.start <= from.line && from.line < b.stop)) return false;
  if (inFence(lines, from.line)) return false;
  const cm = (editor as Editor & { cm?: EditorView }).cm;
  if (!cm) return true;
  const pos = cm.state.selection.main.from;
  type Node = { name: string; parent: Node | null };
  for (let n: Node | null = syntaxTree(cm.state).resolveInner(pos, -1); n; n = n.parent) {
    if (/code|math|frontmatter|table/i.test(n.name)) return false;
  }
  const line = cm.state.doc.lineAt(pos);
  // 行内代码、公式的节点在光标正好挨着反引号时不一定解析得到：再按这一行的文字看一眼
  const head = line.text.slice(0, pos - line.from);
  if ((head.match(/`/g)?.length ?? 0) % 2 === 1 || (head.match(/\$/g)?.length ?? 0) % 2 === 1) return false;
  return true;
}

/**
 * 把表格放到选区的位置（选中的文字被替换）：同一行前后有文字时各自留在表格前后，表格前后都空一行
 * （表格前面紧贴文字 Obsidian 不认，后面紧贴文字会被当成表格的一行）。一次改动，撤销一下就回去
 */
export function insertTableAtSelection(editor: Editor, lines: readonly string[]): void {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const before = editor.getRange({ line: from.line, ch: 0 }, from).replace(/\s+$/, "");
  const after = editor.getRange(to, { line: to.line, ch: editor.getLine(to.line).length }).replace(/^\s+/, "");
  const prevBlank = from.line === 0 || editor.getLine(from.line - 1).trim() === "";
  const nextBlank = to.line + 1 >= editor.lineCount() || editor.getLine(to.line + 1).trim() === "";
  const lead = before ? `${before}\n\n` : prevBlank ? "" : "\n";
  const tail = after ? `\n\n${after}` : nextBlank ? "" : "\n";
  editor.replaceRange(lead + lines.join("\n") + tail, { line: from.line, ch: 0 }, { line: to.line, ch: editor.getLine(to.line).length });
  const end = from.line + (lead.match(/\n/g)?.length ?? 0) + lines.length - 1;
  editor.setCursor({ line: Math.min(editor.lineCount() - 1, end + (after ? 2 : 1)), ch: 0 });
}
