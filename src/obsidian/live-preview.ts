/**
 * 实时预览：把笔记里的表格换成我们的编辑器。
 * 用 StateField 给表格那几行加一个块级替换装饰（范围和原生表格完全一样），优先级最高，盖住 Obsidian 自己的表格；
 * 下面的注释行另外用一个不带内容的块级替换藏起来。改动都走编辑器事务，撤销和 Obsidian 的是同一条历史。
 * 只动顶格写的表格（规则见 core/find.ts），其余照旧由 Obsidian 显示。
 */

import { EditorSelection, EditorState, type Extension, Prec, RangeSetBuilder, StateEffect, StateField, type Text, Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { Component, editorInfoField, editorLivePreviewField } from "obsidian";
import { blockTable, findTables, type TableBlock, writeBlock } from "../core/find";
import { diffText } from "../core/diff";
import { canIndent, indentTable } from "../core/indent";
import { parseTable, type Table } from "../core/table";
import { clearSearchMark, sameTable, TableEditor } from "../editor/editor";
import type { TableHostFactory } from "./host";


function docLines(doc: Text): string[] {
  const out: string[] = [];
  for (let i = 1; i <= doc.lines; i++) out.push(doc.line(i).text);
  return out;
}

class TableWidget extends WidgetType {
  editor: TableEditor | null = null;

  constructor(
    readonly table: Table,
    readonly source: string,
    readonly factory: TableHostFactory,
    /** 列表里的表格缩进几层（顶格是 0）：画的时候往右挪，和列表项的文字对齐 */
    readonly depth = 0,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source && other.depth === this.depth;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ggt-lp";
    if (this.depth) {
      wrap.classList.add("is-in-list");
      wrap.style.setProperty("--ggt-depth", String(this.depth));
    }
    // 表格里的事件不往编辑器上冒：我们的格子也是 <td>/<th>，Obsidian 自己的表格逻辑看到会把整张表重新排版
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "keydown", "keyup", "keypress", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend", "focusin", "focusout", "paste", "copy", "cut", "dragstart", "drop"]) {
      wrap.addEventListener(type, (ev) => ev.stopPropagation());
    }
    const owner = new Component();
    owner.load();
    (wrap as HTMLElement & { ggtOwner?: Component }).ggtOwner = owner;
    const editor = new TableEditor(wrap, this.table, this.factory.host(view.state.field(editorInfoField, false)?.file?.path ?? "", owner, {
      onChange: (next) => writeBack(view, wrap, next),
      undo: () => undo(view),
      redo: () => redo(view),
      onLeave: (where) => leave(view, wrap, where),
      onDeleteTable: () => removeTable(view, wrap),
      indentTable: (dir) => indentAt(view, wrap, dir),
      canIndentTable: (dir) => {
        const at = blockAt(view, wrap);
        return !!at && canIndent(docLines(view.state.doc), at.block, dir);
      },
    }));
    this.factory.style(editor.root);
    (wrap as HTMLElement & { ggtCleanup?: () => void }).ggtCleanup = this.factory.attach(editor);
    this.editor = editor;
    (wrap as HTMLElement & { ggtEditor?: TableEditor }).ggtEditor = editor;
    return wrap;
  }

  /** 内容变了但还是这张表：沿用原来的编辑器，只换数据（不丢焦点、不闪） */
  updateDOM(dom: HTMLElement): boolean {
    const editor = (dom as HTMLElement & { ggtEditor?: TableEditor }).ggtEditor;
    if (!editor) return false;
    // 沿用的元素可能是别的缩进层数的表格留下的（比如换了笔记，同一位置原来是顶格的表）：缩进跟着这一张走
    dom.classList.toggle("is-in-list", this.depth > 0);
    if (this.depth) dom.style.setProperty("--ggt-depth", String(this.depth));
    else dom.style.removeProperty("--ggt-depth");
    editor.update(this.table);
    this.editor = editor;
    return true;
  }

  destroy(dom: HTMLElement): void {
    const d = dom as HTMLElement & { ggtEditor?: TableEditor; ggtOwner?: Component; ggtCleanup?: () => void };
    d.ggtCleanup?.();
    d.ggtEditor?.destroy();
    d.ggtOwner?.unload();
  }

  ignoreEvent(): boolean {
    return true;
  }

  get estimatedHeight(): number {
    return 38 * this.table.cells.length + 40;
  }
}

/** 搜索、跳转把选区放进了表格（随后被挪出来）：原来选中的是文档里 [from, to]，所在表格从 tableFrom 开始 */
const revealEffect = StateEffect.define<{ tableFrom: number; from: number; to: number }>();

/**
 * 文档里 [from, to] 落在表格的哪一格、是这格里第几处这段字（按源码数）。表头是第 0 行，分隔行不算；
 * 跨了格子、落在分隔行上返回 null
 */
function cellOfRange(doc: Text, tableFrom: number, from: number, to: number): { r: number; c: number; text: string; k: number } | null {
  const first = doc.lineAt(tableFrom).number;
  const line = doc.lineAt(from);
  if (to > line.to) return null;
  const idx = line.number - first;
  if (idx === 1) return null;
  const r = idx === 0 ? 0 : idx - 1;
  const t = line.text;
  const off = from - line.from;
  const lead = t.length - t.trimStart().length;
  let pipes = 0;
  let cellStart = lead;
  for (let i = lead; i < off; i++) {
    if (t[i] === "\\") {
      i++;
      continue;
    }
    if (t[i] === "|") {
      pipes++;
      cellStart = i + 1;
    }
  }
  for (let i = off; i < to - line.from; i++) if (t[i] === "|" && t[i - 1] !== "\\") return null;
  const c = t.trimStart().startsWith("|") ? pipes - 1 : pipes;
  if (c < 0) return null;
  const text = doc.sliceString(from, to);
  const before = t.slice(cellStart, off);
  let k = 0;
  for (let i = before.indexOf(text); i >= 0; i = before.indexOf(text, i + text.length)) k++;
  return { r, c, text, k };
}

/** 这个编辑器所在标签页的查找框（在文件中查找）开着没有 */
function findBarOpen(view: EditorView): boolean {
  const box = view.dom.closest(".workspace-leaf-content")?.querySelector<HTMLElement>(".document-search-container");
  return !!box && box.offsetParent !== null;
}

/**
 * 搜索标出的那一处要是落在某张表格里，返回它：查找框开着时是当前这一处（obsidian-search-match-highlight 装饰），
 * 从全局搜索点进来时是闪一下的那一处（is-flashing 装饰）
 */
function findBarMatch(view: EditorView, tables: DecorationSet | undefined): { tableFrom: number; from: number; to: number } | null {
  if (!tables || tables.size === 0) return null;
  const want = findBarOpen(view) ? ["obsidian-search-match-highlight", "is-flashing"] : ["is-flashing"];
  const sources = view.state.facet(EditorView.decorations).map((d) => (typeof d === "function" ? d(view) : d));
  let out: { tableFrom: number; from: number; to: number } | null = null;
  tables.between(0, view.state.doc.length, (tFrom, tTo, value) => {
    if (!(value.spec as { widget?: unknown }).widget) return undefined;
    for (const set of sources) {
      set.between(tFrom, tTo, (from, to, d) => {
        const cls = (d.spec as { class?: string }).class ?? "";
        if (from >= tFrom && to <= tTo && to > from && want.some((w) => cls.split(/\s+/).includes(w))) {
          out = { tableFrom: tFrom, from, to };
          return false;
        }
        return undefined;
      });
      if (out) return false;
    }
    return undefined;
  });
  return out;
}

/** 这个编辑器现在在文件里哪几行：按它在文档里的位置找回所在的表格 */
function blockAt(view: EditorView, dom: HTMLElement): { block: TableBlock; from: number; to: number } | null {
  let pos: number;
  try {
    pos = view.posAtDOM(dom);
  } catch {
    return null;
  }
  const doc = view.state.doc;
  const line = doc.lineAt(Math.min(pos, doc.length)).number - 1;
  const block = findTables(docLines(doc)).find((b) => b.start <= line && line < b.end) ?? findTables(docLines(doc)).find((b) => b.start === line);
  if (!block) return null;
  const from = doc.line(block.start + 1).from;
  const to = doc.line(block.stop).to;
  return { block, from, to };
}

function writeBack(view: EditorView, dom: HTMLElement, table: Table): void {
  const at = blockAt(view, dom);
  if (!at) return;
  const text = writeBlock(table, at.block).join("\n");
  const old = view.state.sliceDoc(at.from, at.to);
  if (old === text) return;
  // 只写回变了的那几个字：Obsidian 背后的原生表格才走局部更新，不整张重建（大表上差几倍）
  view.dispatch({ changes: diffText(old, text, at.from), userEvent: "input.table" });
}

/** 整张表往里缩 / 移出列表：按行算出新文件，只改变了的那几处；走编辑器事务，⌘Z 能撤回 */
function indentAt(view: EditorView, dom: HTMLElement, dir: 1 | -1): void {
  const at = blockAt(view, dom);
  if (!at) return;
  const doc = view.state.doc;
  const next = indentTable(docLines(doc), at.block, dir);
  if (!next) return;
  view.dispatch({ changes: diffText(doc.toString(), next.join("\n")), userEvent: "input.table" });
}

/** 删掉整张表（连同下面的注释），表格前后多出来的一个空行也去掉；走编辑器事务，⌘Z 能撤回 */
function removeTable(view: EditorView, dom: HTMLElement): void {
  const at = blockAt(view, dom);
  if (!at) return;
  const doc = view.state.doc;
  let from = at.from;
  let to = at.to;
  // 吃掉后面的换行；表格在最后一行时吃掉前面的换行
  if (to < doc.length) to += 1;
  else if (from > 0) from -= 1;
  // 前后都是空行时再去掉一个，别留下两个空行
  const before = from > 0 ? doc.lineAt(from - 1) : null;
  const after = to < doc.length ? doc.lineAt(to) : null;
  if (before && after && before.text.trim() === "" && after.text.trim() === "") to = Math.min(doc.length, after.to + 1);
  view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from }, userEvent: "delete.table" });
  view.focus();
}

/** 从表格里出来：光标放到表格上面或下面一行 */
function leave(view: EditorView, dom: HTMLElement, where: "above" | "below" | "escape"): void {
  const at = blockAt(view, dom);
  if (!at) return;
  const doc = view.state.doc;
  const pos = where === "above" ? Math.max(0, at.from - 1) : Math.min(doc.length, at.to + 1);
  view.dispatch({ selection: { anchor: where === "above" ? doc.lineAt(pos).from : pos }, scrollIntoView: true });
  view.focus();
}

/** 缩进算几层：一个 tab 一层，空格按 4 个一层 */
function depthOf(indent: string): number {
  let w = 0;
  for (const ch of indent) w += ch === "\t" ? 4 : 1;
  return Math.round(w / 4);
}

function build(state: EditorState, factory: TableHostFactory): DecorationSet {
  if (!factory.enabled() || !state.field(editorLivePreviewField, false)) return Decoration.none;
  const doc = state.doc;
  const lines = docLines(doc);
  const builder = new RangeSetBuilder<Decoration>();
  for (const b of findTables(lines)) {
    const table = blockTable(lines, b);
    if (!table) continue;
    const from = doc.line(b.start + 1).from;
    const to = doc.line(b.end).to;
    const source = lines.slice(b.start, b.stop).join("\n");
    builder.add(from, to, Decoration.replace({ block: true, widget: new TableWidget(table, source, factory, depthOf(b.indent)) }));
    if (b.metaLine !== null) {
      const m = doc.line(b.metaLine + 1);
      builder.add(m.from, m.to, Decoration.replace({ block: true }));
    }
  }
  return builder.finish();
}

export function livePreviewTables(factory: TableHostFactory): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => build(state, factory),
    update(deco, tr) {
      const lpChanged = tr.startState.field(editorLivePreviewField, false) !== tr.state.field(editorLivePreviewField, false);
      if (tr.docChanged || lpChanged) return build(tr.state, factory);
      return deco;
    },
    provide: (f) => Prec.highest(EditorView.decorations.from(f)),
  });
  /**
   * 编辑器的光标不能停在我们接管的表格里：光标一进表格那几行，Obsidian 自己的表格逻辑就会把整张表按它的格式重排
   * （补空格对齐，中文宽度还算错）。恢复上次位置、搜索跳转、链接跳到标题、撤销都可能把光标放进去，
   * 这里在同一次更新里挪到表格后面一行（表格在最后时挪到前面）
   */
  const keepCursorOut = Prec.highest(
    EditorState.transactionFilter.of((tr) => {
      if (!tr.selection && !tr.docChanged) return tr;
      const deco = tr.state.field(field, false);
      if (!deco || deco.size === 0) return tr;
      const doc = tr.state.doc;
      let moved = false;
      // 表格（连同注释）在笔记最后、用户点了表格下面：笔记末尾补一个换行，光标放到那里（#5）
      let append = false;
      const pointer = !tr.docChanged && tr.isUserEvent("select.pointer");
      // 搜索、跳转（没标用户操作）选中了表格里的一段字：挪出去之前记下来，交给表格标出来（#15）
      let reveal: { tableFrom: number; from: number; to: number } | null = null;
      const main = tr.state.selection.main;
      if (!tr.docChanged && !main.empty && !tr.annotation(Transaction.userEvent)) {
        deco.between(main.from, main.from, (from, to, value) => {
          if ((value.spec as { widget?: unknown }).widget && main.from >= from && main.to <= to) {
            reveal = { tableFrom: from, from: main.from, to: main.to };
            return false;
          }
          return undefined;
        });
      }
      const ranges = tr.state.selection.ranges.map((r) => {
        let head = r.head;
        let anchor = r.anchor;
        // 表格和下面的注释是相邻的两段，挪出一段可能落进下一段：一直挪到不在任何一段里。
        // 往后挪到了笔记末尾就改成往前，并且一路往前跨过相邻的段：只退到注释前面会落在表格最后一行的行尾，
        // 光标还在表格里，按回车就把表格和注释拆开，注释露出来、颜色列宽全丢（#5）
        const out = (pos: number): number => {
          let res = pos;
          let back = false;
          for (let guard = 0; guard < 8; guard++) {
            let hit: { from: number; to: number } | null = null;
            deco.between(res, res, (from, to) => {
              if (res >= from && res <= to) {
                hit = { from, to };
                return false;
              }
              return undefined;
            });
            if (!hit) break;
            const h: { from: number; to: number } = hit;
            moved = true;
            if (!back && h.to < doc.length) res = doc.lineAt(h.to + 1).from;
            else {
              if (!back && pointer && r.empty && pos >= h.from) {
                append = true;
                return doc.length + 1;
              }
              back = true;
              if (h.from === 0) return 0;
              res = h.from - 1;
            }
          }
          return res;
        };
        head = out(head);
        anchor = r.empty ? head : out(anchor);
        return EditorSelection.range(anchor, head);
      });
      if (!moved) return tr;
      if (append) {
        return {
          changes: { from: doc.length, insert: "\n" },
          selection: EditorSelection.create(ranges, tr.state.selection.mainIndex),
          effects: tr.effects,
          scrollIntoView: true,
          annotations: [Transaction.userEvent.of("input.table")],
        };
      }
      // 整个换掉这次更新（不是在后面追加一次）：别的扩展从头到尾都看不到光标在表格里
      return {
        changes: tr.changes,
        selection: EditorSelection.create(ranges, tr.state.selection.mainIndex),
        effects: reveal ? [...tr.effects, revealEffect.of(reveal)] : tr.effects,
        scrollIntoView: tr.scrollIntoView,
        annotations: tr.annotation(Transaction.userEvent) ? [Transaction.userEvent.of(tr.annotation(Transaction.userEvent) as string)] : [],
      };
    }),
  );
  /**
   * 挡住 Obsidian 对我们表格的重排：它在背后还留着自己的表格对象，光标一碰到表格就会异步把整张表按它的格式重写
   * （placeCursorInCell → dispatchTable）。不是我们发起的、并且改完内容 / 对齐 / 设置都没变的改动，就是纯排版，丢掉。
   * 真正改了内容的照常放过；源码模式、关掉接管时我们没有装饰，这里什么都不管
   */
  const blockReformat = Prec.highest(
    EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged || tr.isUserEvent("input.table") || tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
      const deco = tr.startState.field(field, false);
      if (!deco || deco.size === 0) return tr;
      const oldDoc = tr.startState.doc;
      const newDoc = tr.newDoc;
      let reformat = false;
      let other = false;
      tr.changes.iterChangedRanges((fromA, toA) => {
        let inTable = false;
        deco.between(fromA, toA, (from, to, value) => {
          if (!((value.spec as { widget?: unknown }).widget instanceof TableWidget)) return;
          if (toA < from || fromA > to) return;
          inTable = true;
          // 改动超出了表格这几行（比如外部改文件时连表格后面的注释、正文一起换掉）：不是重排，放过。
          // 以前这里只比较表格本身，表格在笔记最后时整次外部更新都会被丢掉，编辑器和磁盘不一致
          if (fromA < from || toA > to) {
            other = true;
            return;
          }
          const before = parseAt(oldDoc, from, to);
          const nf = tr.changes.mapPos(from, -1);
          const nt = tr.changes.mapPos(to, 1);
          const after = parseAt(newDoc, nf, nt);
          if (before && after && sameTable(before, after)) reformat = true;
          else other = true;
        });
        if (!inTable) other = true;
      });
      if (reformat && !other) return [];
      return tr;
    }),
  );
  /**
   * 搜索跳进了表格，在对应那张表里把那一处标出来（#15）：
   * - 在文件中查找（⌘F）不动选区，只给当前这一处加一个 obsidian-search-match-highlight 装饰：查找框开着时在表格范围里找它；
   * - 全局搜索点进来是把选区放到那里（随后被挪出表格）：看 revealEffect。
   * 当前这一处挪到表格外面、选区换到别处，就去掉
   */
  let shown = "";
  clearSearchMark();
  const revealListener = EditorView.updateListener.of((u) => {
    let hit: { tableFrom: number; from: number; to: number } | null = null;
    for (const tr of u.transactions) for (const e of tr.effects) if (e.is(revealEffect)) hit = e.value;
    if (!hit) hit = findBarMatch(u.view, u.state.field(field, false));
    if (!hit) {
      if (shown && (u.selectionSet || u.docChanged || findBarOpen(u.view))) {
        shown = "";
        clearSearchMark();
      }
      return;
    }
    const key = `${hit.from}:${hit.to}`;
    if (key === shown && !u.docChanged) return;
    shown = key;
    const where = cellOfRange(u.state.doc, hit.tableFrom, hit.from, hit.to);
    if (!where) return;
    const view = u.view;
    const at = hit.tableFrom;
    // 等这次更新画完（表格可能刚滚进视野、才建出来）
    view.dom.win.requestAnimationFrame(() => {
      let node: Node | null = null;
      try {
        node = view.domAtPos(at + 1).node;
      } catch {
        return;
      }
      const el = node.instanceOf(HTMLElement) ? node : node.parentElement;
      const wrap: (HTMLElement & { ggtEditor?: TableEditor }) | null = el?.closest(".ggt-lp") ?? el?.querySelector(".ggt-lp") ?? null;
      wrap?.ggtEditor?.showMatch(where.r, where.c, where.text, where.k);
    });
  });
  return [field, keepCursorOut, blockReformat, revealListener];
}

/** 文档里 [from, to] 这几行当成一张表解析（解析不了返回 null） */
function parseAt(doc: Text, from: number, to: number): Table | null {
  const a = doc.lineAt(Math.max(0, Math.min(from, doc.length))).number;
  const b = doc.lineAt(Math.max(0, Math.min(to, doc.length))).number;
  const lines: string[] = [];
  // 列表里的表格每行有缩进：去掉再解析
  for (let i = a; i <= b; i++) lines.push(doc.line(i).text.trimStart());
  return parseTable(lines, null);
}
