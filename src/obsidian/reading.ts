/**
 * 阅读视图：把 Obsidian 渲染出来的表格换成我们的编辑器，改了写回文件。
 *
 * 写回时不用渲染那一刻记下的行号：阅读视图会复用没变的段落，表格上面的内容改过之后行号就过时了。
 * 每次写回都在文件里按内容重新找这张表（编辑器改之前显示的样子），找到唯一的一处（有几处一样的就取离这一段最近的）才写；
 * 一处都找不到说明文件在别处改过，不写，并把编辑器换回文件里现在的内容，免得两边对不上。
 */

import { type App, MarkdownRenderChild, type MarkdownPostProcessorContext, TFile } from "obsidian";
import { findTables } from "../core/find";
import { parseTable, serializeBlock, type Table } from "../core/table";
import { sameTable, TableEditor } from "../editor/editor";
import type { TableHostFactory } from "./host";

class TableChild extends MarkdownRenderChild {
  editor: TableEditor | null = null;
  /** 换下来的原生表格：卸载时（关掉插件、重新加载）放回去，缓存着的段落不会变成空白 */
  original: HTMLElement | null = null;
  onunload(): void {
    this.editor?.destroy();
    if (this.original) this.containerEl.replaceWith(this.original);
  }
}

/** 文件里和 base 内容一样的表格，按离 near 行的远近排 */
function locate(lines: string[], base: Table, near: number): { from: number; to: number; tail: string[] }[] {
  return findTables(lines)
    .filter((b) => {
      const t = parseTable(lines.slice(b.start, b.end), b.meta);
      return t && sameTable(t, base);
    })
    .map((b) => ({ from: b.start, to: b.stop, tail: b.tail, dist: Math.abs(b.start - near) }))
    .sort((a, b) => a.dist - b.dist);
}

export function readingProcessor(app: App, factory: TableHostFactory) {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (!factory.enabled()) return;
    const tables = Array.from(new Set(el.querySelectorAll<HTMLTableElement>("table")));
    if (!tables.length) return;
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const lines = info.text.split("\n");
    // 这一段里的表格，按顺序和渲染出来的 <table> 对上
    const blocks = findTables(lines).filter((b) => b.start >= info.lineStart && b.start <= info.lineEnd);
    tables.forEach((tableEl, i) => {
      const block = blocks[i];
      if (!block || tableEl.closest(".ggt")) return;
      const table = parseTable(lines.slice(block.start, block.end), block.meta);
      if (!table) return;
      const holder = createDiv({ cls: "ggt-reading" });
      tableEl.replaceWith(holder);
      const child = new TableChild(holder);
      child.original = tableEl;
      ctx.addChild(child);
      const editor = new TableEditor(holder, table, factory.host(ctx.sourcePath, child, {
        onChange: (next, prev) => {
          const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
          if (!(file instanceof TFile)) return;
          const near = ctx.getSectionInfo(el)?.lineStart ?? block.start;
          let written = false;
          void app.vault
            .process(file, (data) => {
              const all = data.split("\n");
              const at = locate(all, prev, near)[0];
              if (!at) return data;
              all.splice(at.from, at.to - at.from, ...serializeBlock(next, at.tail));
              written = true;
              return all.join("\n");
            })
            .then(() => {
              // 没写成（文件在别处改过）：换回改之前的样子，和文件对得上
              if (!written) {
                editor.update(prev);
                return;
              }
              // 写成了：Obsidian 会给新内容重新渲染一段，这一段被换下来后按原来的文字缓存着，以后可能被复用。
              // 换下来以后把它恢复成原来的文字对应的样子，复用时显示的就和文件一致
              window.setTimeout(() => {
                if (!holder.isConnected) editor.update(prev);
              }, 800);
            });
        },
      }));
      child.editor = editor;
      factory.style(editor.root);
    });
  };
}
