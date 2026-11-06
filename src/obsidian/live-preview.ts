/**
 * 实时预览：把笔记里的表格换成我们的编辑器。
 * 用 StateField 给表格那几行加一个块级替换装饰（范围和原生表格完全一样），优先级最高，盖住 Obsidian 自己的表格；
 * 下面的注释行另外用一个不带内容的块级替换藏起来。改动都走编辑器事务，撤销和 Obsidian 的是同一条历史。
 * 只动顶格写的表格（规则见 core/find.ts），其余照旧由 Obsidian 显示。
 */

import { type EditorState, type Extension, Prec, RangeSetBuilder, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { Component, editorInfoField, editorLivePreviewField } from "obsidian";
import { findTables, type TableBlock } from "../core/find";
import { parseTable, serializeTable, type Table } from "../core/table";
import { TableEditor } from "../editor/editor";
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
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ggt-lp";
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
    const d = dom as HTMLElement & { ggtEditor?: TableEditor; ggtOwner?: Component };
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
  const text = serializeTable(table).join("\n");
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

function build(state: EditorState, factory: TableHostFactory): DecorationSet {
  if (!factory.enabled() || !state.field(editorLivePreviewField, false)) return Decoration.none;
  const doc = state.doc;
  const lines = docLines(doc);
  const builder = new RangeSetBuilder<Decoration>();
  for (const b of findTables(lines)) {
    const table = parseTable(lines.slice(b.start, b.end), b.meta);
    if (!table) continue;
    const from = doc.line(b.start + 1).from;
    const to = doc.line(b.end).to;
    const source = lines.slice(b.start, b.stop).join("\n");
    builder.add(from, to, Decoration.replace({ block: true, widget: new TableWidget(table, source, factory) }));
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
  return field;
}
