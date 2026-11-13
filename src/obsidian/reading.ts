/**
 * 阅读视图：把 Obsidian 渲染出来的表格换成我们的编辑器，改了写回文件。
 *
 * 写回时不用渲染那一刻记下的行号：阅读视图会复用没变的段落，表格上面的内容改过之后行号就过时了。
 * 每次写回都在文件里按内容重新找这张表（编辑器改之前显示的样子），找到唯一的一处（有几处一样的就取离这一段最近的）才写；
 * 一处都找不到说明文件在别处改过，不写，并把编辑器换回文件里现在的内容，免得两边对不上。
 */

import { type App, MarkdownRenderChild, type MarkdownPostProcessorContext, MarkdownRenderer, MarkdownView, TFile } from "obsidian";
import { blockTable, findTables, type TableBlock, writeBlock } from "../core/find";
import type { Table } from "../core/table";
import { canIndent, indentTable } from "../core/indent";
import { sameTable, TableEditor } from "../editor/editor";
import type { TableHostFactory } from "./host";

class TableChild extends MarkdownRenderChild {
  editor: TableEditor | null = null;
  /** 换下来的原生表格（或列表项那一段）：卸载时（关掉插件、重新加载）放回去，缓存着的段落不会变成空白 */
  original: HTMLElement | null = null;
  /** 列表项那一段被拆成了「前半段、表格、后半段」：卸载时这几块一起换回原来的一段 */
  extra: HTMLElement[] = [];
  onunload(): void {
    this.editor?.destroy();
    if (!this.original) return;
    for (const e of this.extra) e.remove();
    this.containerEl.replaceWith(this.original);
  }
}

/**
 * 段落 p 里第 first 行起的 count 行（行之间是 <br>）换成 holder：p 拆成前半段、holder、后半段。
 * 返回原来的段落（克隆）供卸载时放回；行数对不上返回 null，不动
 */
function spliceLines(p: HTMLElement, first: number, count: number, holder: HTMLElement): HTMLElement | null {
  const nodes = Array.from(p.childNodes);
  // 每行的节点：按 <br> 切开（<br> 后面紧跟的换行文本归下一行，去掉）
  const rows: ChildNode[][] = [[]];
  for (const n of nodes) {
    if (n.nodeName === "BR") rows.push([]);
    else rows[rows.length - 1].push(n);
  }
  if (rows.length < first + count) return null;
  const original = p.cloneNode(true) as HTMLElement;
  const after = p.ownerDocument.createElement("p");
  const rest = rows.slice(first + count);
  // 表格下面接着写的文字留在后半段（第一行前面那个换行去掉）
  rest.forEach((row, i) => {
    if (i > 0) after.appendChild(p.ownerDocument.createElement("br"));
    for (const n of row) after.appendChild(n);
  });
  // 前半段：表格前面的几行，去掉最后一个 <br>
  p.replaceChildren();
  rows.slice(0, first).forEach((row, i) => {
    if (i > 0) p.appendChild(p.ownerDocument.createElement("br"));
    for (const n of row) p.appendChild(n);
  });
  p.after(holder);
  const hasRest = Array.from(after.childNodes).some((n) => n.nodeName !== "#comment" && (n.textContent ?? "").trim() !== "");
  if (hasRest) holder.after(after);
  (holder as HTMLElement & { ggtSplit?: HTMLElement[] }).ggtSplit = [p, ...(hasRest ? [after] : [])];
  return original;
}

/**
 * 列表项自己的那段文字：松散列表在 <p> 里；紧凑列表（脑图存的就是这种）直接写在 <li> 里，
 * 把子列表前面的文字节点包进一个 span 再按行切（项目符号、折叠箭头一起包进去，算第一行）
 */
function leadText(li: HTMLElement): HTMLElement | null {
  const p = Array.from(li.children).find((c): c is HTMLElement => c.tagName === "P");
  if (p) return p;
  const lead: ChildNode[] = [];
  for (const n of Array.from(li.childNodes)) {
    if (n.nodeName === "UL" || n.nodeName === "OL") break;
    lead.push(n);
  }
  if (!lead.some((n) => n.nodeName === "BR")) return null;
  const span = li.ownerDocument.createElement("span");
  span.className = "ggt-li-text";
  lead[0].before(span);
  span.append(...lead);
  return span;
}

/** 文件里和 base 内容一样的表格，按离 near 行的远近排 */
function locate(lines: string[], base: Table, near: number): { from: number; to: number; block: TableBlock }[] {
  return findTables(lines)
    .filter((b) => {
      const t = blockTable(lines, b);
      return t && sameTable(t, base);
    })
    .map((b) => ({ from: b.start, to: b.stop, block: b, dist: Math.abs(b.start - near) }))
    .sort((a, b) => a.dist - b.dist);
}

/**
 * 这一段所在笔记的原文。Obsidian 给的 getSectionInfo().text 偶尔是空字符串（2026-11-09 在用户库里遇到：
 * 行号是对的、原文为空，阅读视图里的表格就全没接管），这时从打开着这篇笔记的视图里取，再不行读文件
 */
async function sectionText(app: App, ctx: MarkdownPostProcessorContext, text: string): Promise<string> {
  if (text) return text;
  let found = "";
  app.workspace.iterateAllLeaves((leaf) => {
    if (!found && leaf.view instanceof MarkdownView && leaf.view.file?.path === ctx.sourcePath) found = leaf.view.data;
  });
  if (found) return found;
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  return file instanceof TFile ? app.vault.cachedRead(file) : "";
}

/** 渲染出来的原生表格有几行几列（表头算一行） */
function domSize(tableEl: HTMLTableElement): [number, number] {
  const rows = Array.from(tableEl.rows);
  return [rows.length, rows[0]?.cells.length ?? 0];
}

/**
 * 导出 PDF：Obsidian 把整篇笔记一次渲染成一大块再调后处理，getSectionInfo 一律是 null，拿不到行号。
 * 这时读整篇原文，把顶格（或列表里前面空一行）的表格按顺序和页面上的原生表格对上：
 * 引用块、callout 里的不归我们管，跳过；行数列数对不上的那张不换，保持原生，不会把别的表的样式套上去。
 * 只读：不写回、没有手柄。格子里的 Markdown 异步渲染，把等待交给 Obsidian（ctx.promises），印之前会等它们画完
 */
async function exportProcessor(app: App, factory: TableHostFactory, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  if (!(file instanceof TFile)) return;
  const tables = Array.from(el.querySelectorAll<HTMLTableElement>("table")).filter(
    (t) => !t.closest(".ggt, blockquote, .callout, .internal-embed, .markdown-embed"),
  );
  if (!tables.length) return;
  const lines = (await app.vault.cachedRead(file)).split("\n");
  const blocks = findTables(lines).filter((b) => !b.indent || lines[b.start - 1]?.trim() === "");
  const promises = (ctx as MarkdownPostProcessorContext & { promises?: Promise<unknown>[] }).promises;
  const local: Promise<unknown>[] = [];
  const sized: TableEditor[] = [];
  let bi = 0;
  for (const tableEl of tables) {
    const [rows, cols] = domSize(tableEl);
    // 往后找第一张行列数一样的；中间对不上的（Obsidian 没当成表格的写法）跳过
    let hit = -1;
    for (let j = bi; j < blocks.length; j++) {
      const t = blockTable(lines, blocks[j]);
      if (t && t.cells.length === rows && (t.cells[0]?.length ?? 0) === cols) {
        hit = j;
        break;
      }
    }
    if (hit < 0) continue;
    const table = blockTable(lines, blocks[hit]);
    bi = hit + 1;
    if (!table) continue;
    const holder = createDiv({ cls: "ggt-reading" });
    tableEl.replaceWith(holder);
    const child = new TableChild(holder);
    child.original = tableEl;
    ctx.addChild(child);
    const host = factory.host(ctx.sourcePath, child, { onChange: () => {}, readonly: true });
    if (host.renderMarkdown) {
      host.renderMarkdown = (cell, md) => {
        const p = MarkdownRenderer.render(app, md, cell, ctx.sourcePath, child);
        local.push(p);
        promises?.push(p);
      };
    }
    const editor = new TableEditor(holder, table, host);
    child.editor = editor;
    factory.style(editor.root);
    if (table.meta.w?.some((w) => w)) sized.push(editor);
  }
  if (!sized.length) return;
  await Promise.all(local);
  for (const editor of sized) fitWidths(editor.root);
}

/**
 * 设了列宽的表格：列宽加起来可能比纸宽（列宽在编辑器里是按像素定的，屏幕上能横向滚动，纸上不行）。
 * 量出每列现在的宽度，换成百分比，表格宽度取「原来的总宽」和「页面宽」里小的那个，各列按比例缩
 */
function fitWidths(root: HTMLElement): void {
  const tableEl = root.querySelector<HTMLTableElement>("table.ggt-table");
  const cols = tableEl ? Array.from(tableEl.querySelectorAll<HTMLElement>("colgroup > col")) : [];
  if (!tableEl || !cols.length) return;
  const widths = cols.map((_, c) => {
    let w = 0;
    tableEl.querySelectorAll<HTMLTableCellElement>(`.ggt-cell[data-c="${c}"]`).forEach((cell) => {
      if (cell.colSpan === 1) w = Math.max(w, cell.getBoundingClientRect().width);
    });
    return w;
  });
  const total = widths.reduce((a, b) => a + b, 0);
  if (!total || widths.some((w) => !w)) return;
  cols.forEach((col, c) => col.setCssStyles({ width: `${((widths[c] / total) * 100).toFixed(3)}%` }));
  tableEl.setCssStyles({ tableLayout: "fixed", width: `min(100%, ${Math.ceil(total)}px)` });
}

export function readingProcessor(app: App, factory: TableHostFactory) {
  return async (el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    if (!factory.enabled()) return;
    const info = ctx.getSectionInfo(el);
    if (!info) {
      // 导出 PDF 时整篇一次渲染，el 是整篇的容器（带 markdown-preview-view）；别的地方拿不到行号的照旧不管
      if (el.closest(".print")) await exportProcessor(app, factory, el, ctx);
      return;
    }
    // 原文正常拿得到时同步处理（不多等一拍，免得先闪一下原生表格）
    const text = info.text || (await sectionText(app, ctx, info.text));
    if (!text) return;
    const lines = text.split("\n");
    const blocks = findTables(lines).filter((b) => b.start >= info.lineStart && b.start <= info.lineEnd);
    if (!blocks.length) return;
    // Obsidian 自己画成 <table> 的：顶格的，和列表里前面空一行的。按顺序和渲染出来的 <table> 对上
    const native = blocks.filter((b) => !b.indent || lines[b.start - 1]?.trim() === "");
    const tables = Array.from(new Set(el.querySelectorAll<HTMLTableElement>("table")));
    const slots: { block: TableBlock; mount: (holder: HTMLElement) => HTMLElement | null }[] = [];
    native.forEach((block, i) => {
      const tableEl = tables[i];
      if (!tableEl || tableEl.closest(".ggt")) return;
      slots.push({
        block,
        mount: (holder) => {
          tableEl.replaceWith(holder);
          return tableEl;
        },
      });
    });
    // 列表项下面紧跟着写的：Obsidian 当成这一项的文字续行（每行一个 <br>），把这几行摘出来换成表格
    for (const block of blocks) {
      if (native.includes(block) || block.owner === null) continue;
      const li = el.querySelector<HTMLElement>(`li[data-line="${block.owner - info.lineStart}"]`);
      if (!li || li.closest(".ggt")) continue;
      const owner = block.owner;
      slots.push({
        block,
        mount: (holder) => {
          const p = leadText(li);
          return p ? spliceLines(p, block.start - owner, block.end - block.start, holder) : null;
        },
      });
    }
    for (const { block, mount } of slots) {
      const table = blockTable(lines, block);
      if (!table) continue;
      const holder = createDiv({ cls: "ggt-reading" });
      const original = mount(holder);
      if (!original) continue;
      const child = new TableChild(holder);
      child.original = original;
      child.extra = (holder as HTMLElement & { ggtSplit?: HTMLElement[] }).ggtSplit ?? [];
      ctx.addChild(child);
      const editor = new TableEditor(holder, table, factory.host(ctx.sourcePath, child, {
        // 设置「阅读视图里表格只读」（默认开）：和 Obsidian 的阅读视图一致，点格子不进编辑、没有手柄和加号
        readonly: factory.readingReadonly(),
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
              all.splice(at.from, at.to - at.from, ...writeBlock(next, at.block));
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
        // 往里缩 / 移出列表：按现在显示的这张在文件里找到，算出新文件
        indentTable: (dir) => {
          const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
          if (!(file instanceof TFile)) return;
          const near = ctx.getSectionInfo(el)?.lineStart ?? block.start;
          const base = editor.getTable();
          void app.vault.process(file, (data) => {
            const all = data.split("\n");
            const at = locate(all, base, near)[0];
            const next = at && indentTable(all, at.block, dir);
            return next ? next.join("\n") : data;
          });
        },
        canIndentTable: (dir) => canIndent(lines, block, dir),
        // 删除整张表：按现在显示的这张在文件里找到，连同注释删掉；前后都是空行时多删一个
        onDeleteTable: () => {
          const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
          if (!(file instanceof TFile)) return;
          const near = ctx.getSectionInfo(el)?.lineStart ?? block.start;
          const base = editor.getTable();
          void app.vault.process(file, (data) => {
            const all = data.split("\n");
            const at = locate(all, base, near)[0];
            if (!at) return data;
            let { from, to } = at;
            if ((all[from - 1] ?? "").trim() === "" && (all[to] ?? "").trim() === "" && to < all.length) to += 1;
            all.splice(from, to - from);
            return all.join("\n");
          });
        },
      }));
      child.editor = editor;
      factory.style(editor.root);
      child.register(factory.attach(editor));
    }
  };
}
