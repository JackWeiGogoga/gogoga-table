/**
 * 在一篇笔记里找表格：哪几行是表格、上方有没有我们的注释。
 * 第一版只管顶格写的表格；代码块、frontmatter、引用和 callout（> 开头）、缩进 4 格以上的都跳过，
 * 这些地方的表格仍由 Obsidian 原生显示。
 */

import { isDelimiterRow, parseMetaLine, splitRow, type TableMeta } from "./table";

export interface TableBlock {
  /** 表头所在行（从 0 开始） */
  start: number;
  /** 表格最后一行的下一行 */
  end: number;
  /** 上方注释所在行；没有注释是 null */
  metaLine: number | null;
  meta: TableMeta | null;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** 能当表格行的：不缩进、不是引用，有竖线、不是空行 */
function rowLike(line: string): boolean {
  if (!line.trim() || !line.includes("|")) return false;
  if (/^\s/.test(line) || line.startsWith(">")) return false;
  return true;
}

/** 表格上一行是这些时，Obsidian 一定把它当表格：空行、标题、单独一行的 HTML 注释 */
function blockBoundary(line: string): boolean {
  const t = line.trim();
  return t === "" || /^#{1,6}\s/.test(t) || (t.startsWith("<!--") && t.endsWith("-->"));
}

export function findTables(lines: readonly string[]): TableBlock[] {
  const out: TableBlock[] = [];
  let i = 0;
  // frontmatter
  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((l, j) => j > 0 && (l.trim() === "---" || l.trim() === "..."));
    if (close > 0) i = close + 1;
  }
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE_RE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1].trim()) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    if (!rowLike(line) || i + 1 >= lines.length || !isDelimiterRow(lines[i + 1]) || /^\s/.test(lines[i + 1])) continue;
    if (splitRow(line).length !== splitRow(lines[i + 1]).length) continue;
    const meta = i > 0 ? parseMetaLine(lines[i - 1]) : null;
    // 紧跟在一段文字后面的不算（拿不准 Obsidian 会不会当表格，交给它原样处理）：上一行得是空行、标题或笔记开头
    const prev = meta ? i - 2 : i - 1;
    if (prev >= 0 && !blockBoundary(lines[prev])) continue;
    let end = i + 2;
    while (end < lines.length && rowLike(lines[end])) end++;
    out.push({ start: i, end, metaLine: meta ? i - 1 : null, meta });
    i = end - 1;
  }
  return out;
}
