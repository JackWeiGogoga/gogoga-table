/**
 * 实时预览：把笔记里的表格换成我们的编辑器。
 * 用 StateField 给表格那几行加一个块级替换装饰（范围和原生表格完全一样），优先级最高，盖住 Obsidian 自己的表格；
 * 下面的注释行另外用一个不带内容的块级替换藏起来。改动都走编辑器事务，撤销和 Obsidian 的是同一条历史。
 * 只动顶格写的表格（规则见 core/find.ts），其余照旧由 Obsidian 显示。
 */

import { EditorSelection, EditorState, type Extension, Prec, RangeSetBuilder, StateField, type Text, Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { Component, editorInfoField, editorLivePreviewField } from "obsidian";
import { blockTable, findTables, type TableBlock, writeBlock } from "../core/find";
import { parseTable, type Table } from "../core/table";
import { sameTable, TableEditor } from "../editor/editor";
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
    return 36 * this.table.cells.length + 40;
  }
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
  if (view.state.sliceDoc(at.from, at.to) === text) return;
  view.dispatch({ changes: { from: at.from, to: at.to, insert: text }, userEvent: "input.table" });
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
      const ranges = tr.state.selection.ranges.map((r) => {
        let head = r.head;
        let anchor = r.anchor;
        // 表格和下面的注释是相邻的两段，挪出一段可能落进下一段：一直挪到不在任何一段里
        const out = (pos: number): number => {
          let res = pos;
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
            if (h.to < doc.length) res = doc.lineAt(h.to + 1).from;
            else {
              res = Math.max(0, h.from - 1);
              break;
            }
          }
          return res;
        };
        head = out(head);
        anchor = r.empty ? head : out(anchor);
        return EditorSelection.range(anchor, head);
      });
      if (!moved) return tr;
      // 整个换掉这次更新（不是在后面追加一次）：别的扩展从头到尾都看不到光标在表格里
      return {
        changes: tr.changes,
        selection: EditorSelection.create(ranges, tr.state.selection.mainIndex),
        effects: tr.effects,
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
  return [field, keepCursorOut, blockReformat];
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
