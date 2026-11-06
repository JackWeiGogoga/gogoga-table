/** 新建表格：悬停网格选行列数（像 Word、Google 文档）；把选中的文字转成表格 */

import { type App, type Editor, Modal } from "obsidian";
import { fromTSV } from "../core/clipboard";
import { emptyTable, type Table } from "../core/table";
import { t } from "../editor/i18n";

const MAX_R = 10;
const MAX_C = 8;

/** 插到光标所在行：前后各留一个空行（表格前面紧贴文字时 Obsidian 不认） */
export function insertTableText(editor: Editor, lines: string[]): void {
  const cur = editor.getCursor();
  const line = editor.getLine(cur.line);
  const prevBlank = cur.line === 0 || editor.getLine(cur.line - 1).trim() === "";
  if (line.trim() === "") {
    const text = (prevBlank ? "" : "\n") + lines.join("\n") + "\n";
    editor.replaceRange(text, { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
    editor.setCursor({ line: cur.line + (prevBlank ? 0 : 1) + lines.length, ch: 0 });
  } else {
    const text = "\n\n" + lines.join("\n") + "\n";
    editor.replaceRange(text, { line: cur.line, ch: line.length });
    editor.setCursor({ line: cur.line + 2 + lines.length, ch: 0 });
  }
}

export class GridModal extends Modal {
  constructor(
    app: App,
    private readonly pick: (rows: number, cols: number) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t("gridTitle"));
    this.modalEl.addClass("ggt-grid-modal");
    const grid = this.contentEl.createDiv({ cls: "ggt-grid" });
    const hint = this.contentEl.createDiv({ cls: "ggt-grid-hint" });
    const cells: HTMLElement[][] = [];
    const mark = (r: number, c: number) => {
      cells.forEach((row, i) => row.forEach((el, j) => el.toggleClass("is-on", i <= r && j <= c)));
      hint.setText(t("gridHint").replace("{r}", String(r + 1)).replace("{c}", String(c + 1)));
    };
    for (let r = 0; r < MAX_R; r++) {
      const row: HTMLElement[] = [];
      for (let c = 0; c < MAX_C; c++) {
        const el = grid.createDiv({ cls: "ggt-grid-cell" });
        el.addEventListener("pointerenter", () => mark(r, c));
        el.addEventListener("click", () => {
          this.close();
          this.pick(Math.max(2, r + 1), c + 1);
        });
        row.push(el);
      }
      cells.push(row);
    }
    mark(2, 2);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * 选中的文字转成表格：有制表符按制表符切（从表格软件复制来的），否则按逗号切（CSV，支持双引号）；
 * 第一行当表头，列数按最多的那行补齐
 */
export function textToTable(text: string): Table | null {
  const raw = text.replace(/\r\n?/g, "\n").trim();
  if (!raw) return null;
  const rows = raw.includes("\t") ? fromTSV(raw) : raw.split("\n").map(splitCSV);
  if (!rows.length) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const t = emptyTable(Math.max(2, rows.length), width);
  rows.forEach((row, i) => row.forEach((v, j) => (t.cells[i][j] = v.trim())));
  return t;
}

function splitCSV(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && !cur.trim()) q = true;
    else if (ch === "," || ch === "，") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

