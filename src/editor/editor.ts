/**
 * 表格编辑器：给一个元素就挂出一张能编辑的表。不依赖 Obsidian，实时预览、阅读视图、脑图节点都用它，
 * 和宿主之间只通过 EditorHost 打交道（渲染格子里的 Markdown、把改好的表交回去、撤销……）。
 *
 * 交互（参考飞书、Notion）：
 * - 单击格子选中；直接打字替换内容，双击或 Enter 在原内容上改；手机上点一下就进入编辑
 * - 编辑中 Enter 完成并往下走一格，Shift+Enter 换行，Tab / Shift+Tab 左右走，Esc 取消
 * - 选中时方向键移动，Delete / Backspace 清空，⌘Z 交给宿主撤销
 * - 鼠标停在格子上，行左边、列上边出现手柄，点开是行 / 列菜单；表格右边、下边的加号加列加行
 * - 拖表头右边缘改列宽，双击恢复自动
 *
 * 选中时焦点在一个看不见的输入框里（放在选中的格子上），打字和输入法组字都先落到它身上，
 * 第一下输入就把它变成这一格的编辑框，组字不会被打断。
 */

import { type Align, CELL_COLORS, type CellColor, type Table } from "../core/table";
import { bgOf, colCount, deleteCol, deleteRow, insertCol, insertRow, moveCol, moveRow, rowCount, setAlign, setBg, setCell, setWidth, widthOf } from "../core/ops";
import { t } from "./i18n";

export interface MenuItem {
  title?: string;
  icon?: string;
  /** 色块（底色菜单用） */
  swatch?: CellColor | "none";
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  run?: () => void;
  separator?: boolean;
}

export interface EditorHost {
  /** 把格子里的 Markdown 渲染进 el；不给就按纯文本显示 */
  renderMarkdown?(el: HTMLElement, markdown: string): void;
  /** 表改了：宿主负责写回文件。previous 是改之前显示的那张（宿主按它在文件里找到这张表） */
  onChange(table: Table, previous: Table): void;
  /** 在图标元素里放图标（Obsidian 的 setIcon）；不给就用文字符号 */
  setIcon?(el: HTMLElement, name: string): void;
  undo?(): void;
  redo?(): void;
  /** 选中第一行再往上、最后一行再往下、Esc：宿主把光标挪出表格 */
  onLeave?(where: "above" | "below" | "escape"): void;
  /** 选中或开始编辑时通知宿主（实时预览里用来防止编辑器抢走光标） */
  onFocus?(): void;
  readonly?: boolean;
}

type Pos = { r: number; c: number };

/** 内容、对齐、设置都一样（写回风格不算） */
export function sameTable(a: Table, b: Table): boolean {
  return JSON.stringify([a.cells, a.align, a.meta]) === JSON.stringify([b.cells, b.align, b.meta]);
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export class TableEditor {
  readonly root: HTMLElement;
  private table: Table;
  private readonly scroller: HTMLElement;
  private readonly tableEl: HTMLTableElement;
  private readonly input: HTMLTextAreaElement;
  private readonly rowHandle: HTMLElement;
  private readonly colHandle: HTMLElement;
  private sel: Pos | null = null;
  private editing = false;
  /** 编辑时宿主送来的新表：等这一格改完再换上 */
  private pending: Table | null = null;
  private hover: Pos | null = null;
  private popover: HTMLElement | null = null;
  private resize: { c: number; startX: number; startW: number; col: HTMLElement } | null = null;
  private destroyed = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    parent: HTMLElement,
    table: Table,
    private readonly host: EditorHost,
  ) {
    this.table = table;
    const doc = parent.ownerDocument;
    this.root = doc.createElement("div");
    this.root.className = "ggt";
    this.scroller = this.root.appendChild(doc.createElement("div"));
    this.scroller.className = "ggt-scroll";
    this.tableEl = this.scroller.appendChild(doc.createElement("table"));
    this.tableEl.className = "ggt-table";
    this.input = doc.createElement("textarea");
    this.input.className = "ggt-input";
    this.input.rows = 1;
    this.input.spellcheck = false;
    this.input.setAttribute("autocapitalize", "off");
    this.rowHandle = this.handle("ggt-row-handle", t("rowMenu"), "grip-vertical");
    this.colHandle = this.handle("ggt-col-handle", t("colMenu"), "grip-horizontal");
    this.addButton("ggt-add-col", t("addCol"), () => this.apply(insertCol(this.table, colCount(this.table)), { r: this.sel?.r ?? 0, c: colCount(this.table) }));
    this.addButton("ggt-add-row", t("addRow"), () => this.apply(insertRow(this.table, rowCount(this.table)), { r: rowCount(this.table), c: this.sel?.c ?? 0 }));
    this.root.classList.toggle("is-readonly", !!host.readonly);
    parent.appendChild(this.root);
    this.bind();
    this.render();
  }

  // ---------- 对外 ----------

  /** 宿主那边的表变了（比如撤销、别处改了文件） */
  update(table: Table): void {
    // 自己刚交出去、宿主写回文件后又送回来的同一张表：不重画（重画会丢掉焦点和悬停状态）
    if (sameTable(table, this.table)) {
      this.table = table;
      return;
    }
    if (this.editing) {
      this.pending = table;
      return;
    }
    this.table = table;
    this.render();
  }

  getTable(): Table {
    return this.table;
  }

  select(r: number, c: number): void {
    this.setSel({ r, c }, true);
  }

  isEditing(): boolean {
    return this.editing;
  }

  destroy(): void {
    this.destroyed = true;
    this.closePopover();
    for (const f of this.cleanups) f();
    this.root.remove();
  }

  // ---------- 渲染 ----------

  private render(): void {
    const doc = this.root.ownerDocument;
    const hadFocus = doc.activeElement === this.input;
    const tb = this.table;
    const rows = rowCount(tb);
    const cols = colCount(tb);
    if (this.sel) this.sel = { r: Math.min(this.sel.r, rows - 1), c: Math.min(this.sel.c, cols - 1) };
    this.tableEl.replaceChildren();
    const colgroup = this.tableEl.appendChild(doc.createElement("colgroup"));
    for (let c = 0; c < cols; c++) {
      const col = colgroup.appendChild(doc.createElement("col"));
      const w = widthOf(tb, c);
      if (w) col.style.width = `${w}px`;
    }
    const thead = this.tableEl.appendChild(doc.createElement("thead"));
    const tbody = this.tableEl.appendChild(doc.createElement("tbody"));
    for (let r = 0; r < rows; r++) {
      const tr = (r === 0 ? thead : tbody).appendChild(doc.createElement("tr"));
      for (let c = 0; c < cols; c++) {
        const cell = tr.appendChild(doc.createElement(r === 0 ? "th" : "td"));
        cell.className = "ggt-cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        const a = tb.align[c];
        if (a) cell.dataset.align = a;
        const bg = bgOf(tb, r, c);
        if (bg) cell.dataset.bg = bg;
        const content = cell.appendChild(doc.createElement("div"));
        content.className = "ggt-content";
        this.fill(content, tb.cells[r][c]);
        if (r === 0 && !this.host.readonly) {
          const h = cell.appendChild(doc.createElement("span"));
          h.className = "ggt-resize";
          h.dataset.c = String(c);
          h.setAttribute("aria-label", t("resize"));
        }
      }
    }
    this.markSel();
    if (hadFocus && this.sel) this.input.focus({ preventScroll: true });
  }

  private fill(el: HTMLElement, md: string): void {
    el.replaceChildren();
    if (!md.trim()) {
      el.classList.add("is-empty");
      return;
    }
    el.classList.remove("is-empty");
    if (this.host.renderMarkdown) this.host.renderMarkdown(el, md);
    else el.textContent = md;
  }

  private cellEl(p: Pos): HTMLElement | null {
    return this.tableEl.querySelector<HTMLElement>(`.ggt-cell[data-r="${p.r}"][data-c="${p.c}"]`);
  }

  private markSel(): void {
    for (const el of Array.from(this.tableEl.querySelectorAll(".is-selected, .is-sel-head"))) el.classList.remove("is-selected", "is-sel-head");
    const cell = this.sel && this.cellEl(this.sel);
    if (!cell || !this.sel) {
      this.input.remove();
      this.placeHandles();
      return;
    }
    cell.classList.add("is-selected");
    if (this.sel.r > 0) this.cellEl({ r: 0, c: this.sel.c })?.classList.add("is-sel-head");
    // 看不见的输入框放进选中的格子里：打字、组字从这里开始
    if (this.input.parentElement !== cell) cell.appendChild(this.input);
    this.placeHandles();
  }

  // ---------- 选中、编辑 ----------

  private setSel(p: Pos | null, focus: boolean): void {
    if (this.editing) this.commit();
    this.sel = p;
    this.markSel();
    if (p && focus && !this.host.readonly) {
      this.input.value = "";
      this.input.focus({ preventScroll: true });
      this.cellEl(p)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      this.host.onFocus?.();
    }
  }

  /** 进入编辑：keep 为 true 在原内容上改，否则从输入框里已经打进去的字开始 */
  private startEdit(keep: boolean): void {
    if (!this.sel || this.host.readonly) return;
    const cell = this.cellEl(this.sel);
    if (!cell) return;
    this.editing = true;
    cell.classList.add("is-editing");
    if (keep) {
      this.input.value = this.table.cells[this.sel.r][this.sel.c];
      const end = this.input.value.length;
      this.input.setSelectionRange(end, end);
    }
    if (this.root.ownerDocument.activeElement !== this.input) this.input.focus({ preventScroll: true });
    this.autosize();
    this.host.onFocus?.();
  }

  private autosize(): void {
    this.input.style.height = "auto";
    this.input.style.height = `${this.input.scrollHeight}px`;
  }

  /** 编辑完：内容变了就交给宿主 */
  private commit(): void {
    if (!this.editing || !this.sel) return;
    const p = this.sel;
    this.editing = false;
    this.cellEl(p)?.classList.remove("is-editing");
    const text = this.input.value.replace(/\r\n?/g, "\n");
    this.input.value = "";
    this.input.style.height = "";
    const next = setCell(this.table, p.r, p.c, text.replace(/^\s+|\s+$/g, ""));
    const pending = this.pending;
    this.pending = null;
    if (next !== this.table) {
      const prev = this.table;
      this.table = next;
      const content = this.cellEl(p)?.querySelector<HTMLElement>(".ggt-content");
      if (content) this.fill(content, next.cells[p.r][p.c]);
      this.host.onChange(next, prev);
    } else if (pending) {
      this.table = pending;
      this.render();
    }
  }

  private cancel(): void {
    if (!this.editing || !this.sel) return;
    this.editing = false;
    this.cellEl(this.sel)?.classList.remove("is-editing");
    this.input.value = "";
    this.input.style.height = "";
    if (this.pending) {
      this.table = this.pending;
      this.pending = null;
      this.render();
    }
  }

  /** 换一张表并交给宿主，选中挪到 sel */
  private apply(next: Table, sel?: Pos): void {
    if (this.editing) this.commit();
    if (next === this.table) return;
    const prev = this.table;
    this.table = next;
    if (sel) this.sel = sel;
    this.render();
    this.host.onChange(next, prev);
    if (sel) this.setSel(this.sel, true);
  }

  private move(dr: number, dc: number, wrap = false): void {
    if (!this.sel) return;
    const rows = rowCount(this.table);
    const cols = colCount(this.table);
    let { r, c } = this.sel;
    c += dc;
    if (wrap && c >= cols) {
      c = 0;
      r++;
    } else if (wrap && c < 0) {
      c = cols - 1;
      r--;
    }
    r += dr;
    if (r < 0) {
      this.setSel(null, false);
      this.host.onLeave?.("above");
      return;
    }
    if (r >= rows) {
      if (wrap) {
        // 最后一格按 Tab：加一行，和飞书、Notion 一样
        this.apply(insertRow(this.table, rows), { r: rows, c: 0 });
        return;
      }
      this.setSel(null, false);
      this.host.onLeave?.("below");
      return;
    }
    this.setSel({ r, c: Math.max(0, Math.min(cols - 1, c)) }, true);
  }

  // ---------- 事件 ----------

  private on<K extends keyof HTMLElementEventMap>(el: HTMLElement | Document, type: K, fn: (ev: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void {
    el.addEventListener(type, fn as EventListener, opts);
    this.cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts));
  }

  private bind(): void {
    const doc = this.root.ownerDocument;
    this.on(this.tableEl, "pointerdown", (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest(".ggt-resize")) return this.startResize(ev, target);
      if (target === this.input) return;
      const cell = target.closest<HTMLElement>(".ggt-cell");
      if (!cell || this.host.readonly) return;
      // 点链接、标签：照常打开，不选中
      if (target.closest("a, .tag, input[type=checkbox]")) return;
      ev.preventDefault();
      const p = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
      const same = this.sel && this.sel.r === p.r && this.sel.c === p.c;
      if (!same || !this.editing) this.setSel(p, true);
      // 手机上点一下就编辑（不然键盘弹不出来）
      if (ev.pointerType === "touch" && !this.editing) this.startEdit(true);
    });
    this.on(this.tableEl, "dblclick", (ev) => {
      const target = ev.target as HTMLElement;
      const rz = target.closest<HTMLElement>(".ggt-resize");
      if (rz) {
        this.apply(setWidth(this.table, Number(rz.dataset.c), null));
        return;
      }
      if (target.closest(".ggt-cell") && !this.editing) this.startEdit(true);
    });
    this.on(this.tableEl, "contextmenu", (ev) => {
      const cell = (ev.target as HTMLElement).closest<HTMLElement>(".ggt-cell");
      if (!cell || this.host.readonly || (this.editing && ev.target === this.input)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const p = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
      this.setSel(p, true);
      this.openMenu(this.cellMenu(p), ev.clientX, ev.clientY);
    });
    this.on(this.root, "pointermove", (ev) => {
      if (this.resize || ev.pointerType === "touch") return;
      const cell = (ev.target as HTMLElement).closest<HTMLElement>(".ggt-cell");
      if (!cell || !this.tableEl.contains(cell)) return;
      const p = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
      if (!this.hover || this.hover.r !== p.r || this.hover.c !== p.c) {
        this.hover = p;
        this.placeHandles();
      }
    });
    this.on(this.root, "pointerleave", () => {
      if (this.popover) return;
      this.hover = null;
      this.placeHandles();
    });
    this.on(this.scroller, "scroll", () => this.placeHandles(), { passive: true });

    this.on(this.input, "keydown", (ev) => this.onKey(ev));
    this.on(this.input, "input", () => {
      if (!this.editing) this.startEdit(false);
      else this.autosize();
    });
    this.on(this.input, "compositionstart", () => {
      if (!this.editing) this.startEdit(false);
    });
    this.on(this.input, "blur", () => {
      // 焦点去了别处（不是去开菜单）：编辑中的这一格就此保存
      window.setTimeout(() => {
        if (this.destroyed || doc.activeElement === this.input) return;
        if (this.popover && this.popover.contains(doc.activeElement)) return;
        if (this.editing) this.commit();
      }, 0);
    });
    this.on(doc, "pointerdown", (ev) => {
      const target = ev.target as Node;
      if (this.popover && !this.popover.contains(target)) this.closePopover();
      // 点到表格外面：取消选中
      if (this.sel && !this.root.contains(target) && !(this.popover && this.popover.contains(target))) {
        if (this.editing) this.commit();
        this.sel = null;
        this.markSel();
      }
    }, { capture: true });
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.isComposing || ev.keyCode === 229) return;
    const mod = isMac ? ev.metaKey : ev.ctrlKey;
    if (this.editing) {
      if (ev.key === "Enter" && !ev.shiftKey && !ev.altKey && !mod) {
        ev.preventDefault();
        this.commit();
        this.move(1, 0);
      } else if (ev.key === "Tab") {
        ev.preventDefault();
        this.commit();
        this.move(0, ev.shiftKey ? -1 : 1, true);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        this.cancel();
      }
      ev.stopPropagation();
      return;
    }
    // 选中、没在编辑
    const key = ev.key;
    const stop = () => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    if (mod && key.toLowerCase() === "z") {
      stop();
      if (ev.shiftKey) this.host.redo?.();
      else this.host.undo?.();
      return;
    }
    if (mod && key.toLowerCase() === "y" && !isMac) {
      stop();
      this.host.redo?.();
      return;
    }
    if (mod || ev.altKey) {
      ev.stopPropagation();
      return;
    }
    switch (key) {
      case "ArrowUp":
        stop();
        return this.move(-1, 0);
      case "ArrowDown":
        stop();
        return this.move(1, 0);
      case "ArrowLeft":
        stop();
        return this.move(0, -1);
      case "ArrowRight":
        stop();
        return this.move(0, 1);
      case "Tab":
        stop();
        return this.move(0, ev.shiftKey ? -1 : 1, true);
      case "Enter":
      case "F2":
        stop();
        return this.startEdit(true);
      case "Backspace":
      case "Delete":
        stop();
        if (this.sel) this.apply(setCell(this.table, this.sel.r, this.sel.c, ""), this.sel);
        return;
      case "Escape":
        stop();
        this.setSel(null, false);
        this.host.onLeave?.("escape");
        return;
    }
    // 其他键（打字）：落到输入框里，input 事件里开始编辑
    ev.stopPropagation();
  }

  // ---------- 列宽 ----------

  private startResize(ev: PointerEvent, handle: HTMLElement): void {
    if (this.host.readonly) return;
    ev.preventDefault();
    ev.stopPropagation();
    const c = Number(handle.dataset.c);
    const col = this.tableEl.querySelectorAll("col")[c];
    const cell = this.cellEl({ r: 0, c });
    if (!col || !cell) return;
    this.resize = { c, startX: ev.clientX, startW: cell.getBoundingClientRect().width, col };
    handle.classList.add("is-active");
    this.root.classList.add("is-resizing");
    try {
      handle.setPointerCapture(ev.pointerId);
    } catch {
      // 合成事件
    }
    const move = (e: PointerEvent) => {
      const r = this.resize;
      if (!r) return;
      r.col.style.width = `${Math.max(40, Math.round(r.startW + e.clientX - r.startX))}px`;
      this.placeHandles();
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      handle.classList.remove("is-active");
      this.root.classList.remove("is-resizing");
      const r = this.resize;
      this.resize = null;
      if (!r) return;
      const w = parseFloat(r.col.style.width);
      if (Math.abs(w - r.startW) >= 1) this.apply(setWidth(this.table, r.c, w));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  // ---------- 手柄、加号 ----------

  private handle(cls: string, label: string, icon: string): HTMLElement {
    const doc = this.root.ownerDocument;
    const el = this.root.appendChild(doc.createElement("button"));
    el.type = "button";
    el.className = `ggt-handle ${cls}`;
    el.setAttribute("aria-label", label);
    el.tabIndex = -1;
    if (this.host.setIcon) this.host.setIcon(el, icon);
    else el.textContent = cls.includes("row") ? "⋮" : "⋯";
    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const p = el.dataset.r !== undefined ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
      if (!p) return;
      this.setSel(p, true);
      const rect = el.getBoundingClientRect();
      this.openMenu(cls.includes("row") ? this.rowMenu(p) : this.colMenu(p), rect.left, rect.bottom + 4);
    });
    return el;
  }

  private addButton(cls: string, label: string, run: () => void): HTMLElement {
    const doc = this.root.ownerDocument;
    const el = this.root.appendChild(doc.createElement("button"));
    el.type = "button";
    el.className = `ggt-add ${cls}`;
    el.setAttribute("aria-label", label);
    el.tabIndex = -1;
    if (this.host.setIcon) this.host.setIcon(el, "plus");
    else el.textContent = "+";
    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!this.host.readonly) run();
    });
    return el;
  }

  /** 行手柄放在悬停（或选中）那一行的左边框上，列手柄放在那一列的上边框上 */
  private placeHandles(): void {
    const p = this.hover ?? this.sel;
    const show = !!p && !this.host.readonly && !this.resize;
    this.rowHandle.classList.toggle("is-shown", show && !!p && p.r > 0);
    this.colHandle.classList.toggle("is-shown", show);
    if (!show || !p) return;
    const base = this.root.getBoundingClientRect();
    const cell = this.cellEl(p);
    const first = this.cellEl({ r: p.r, c: 0 });
    const head = this.cellEl({ r: 0, c: p.c });
    if (!cell || !first || !head) return;
    const fr = first.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    this.rowHandle.style.top = `${fr.top - base.top + fr.height / 2}px`;
    this.rowHandle.style.left = `${fr.left - base.left}px`;
    this.rowHandle.dataset.r = String(p.r);
    this.rowHandle.dataset.c = String(p.c);
    this.colHandle.style.left = `${hr.left - base.left + hr.width / 2}px`;
    this.colHandle.style.top = `${hr.top - base.top}px`;
    this.colHandle.dataset.r = String(p.r);
    this.colHandle.dataset.c = String(p.c);
  }

  // ---------- 菜单 ----------

  private rowMenu(p: Pos): MenuItem[] {
    const tb = this.table;
    const head = p.r === 0;
    return [
      { title: t("insertRowAbove"), icon: "arrow-up-to-line", disabled: head, run: () => this.apply(insertRow(tb, p.r), p) },
      { title: t("insertRowBelow"), icon: "arrow-down-to-line", run: () => this.apply(insertRow(tb, p.r + 1), { r: p.r + 1, c: p.c }) },
      { separator: true },
      { title: t("moveRowUp"), icon: "arrow-up", disabled: p.r <= 1, run: () => this.apply(moveRow(tb, p.r, p.r - 1), { r: p.r - 1, c: p.c }) },
      { title: t("moveRowDown"), icon: "arrow-down", disabled: head || p.r >= rowCount(tb) - 1, run: () => this.apply(moveRow(tb, p.r, p.r + 1), { r: p.r + 1, c: p.c }) },
      { separator: true },
      ...this.colorItems(Array.from({ length: colCount(tb) }, (_, c) => ({ r: p.r, c }))),
      { separator: true },
      { title: t("deleteRow"), icon: "trash-2", danger: true, disabled: head || rowCount(tb) <= 2, run: () => this.apply(deleteRow(tb, p.r), { r: Math.min(p.r, rowCount(tb) - 2), c: p.c }) },
    ];
  }

  private colMenu(p: Pos): MenuItem[] {
    const tb = this.table;
    return [
      { title: t("insertColLeft"), icon: "arrow-left-to-line", run: () => this.apply(insertCol(tb, p.c), p) },
      { title: t("insertColRight"), icon: "arrow-right-to-line", run: () => this.apply(insertCol(tb, p.c + 1), { r: p.r, c: p.c + 1 }) },
      { separator: true },
      { title: t("moveColLeft"), icon: "arrow-left", disabled: p.c === 0, run: () => this.apply(moveCol(tb, p.c, p.c - 1), { r: p.r, c: p.c - 1 }) },
      { title: t("moveColRight"), icon: "arrow-right", disabled: p.c >= colCount(tb) - 1, run: () => this.apply(moveCol(tb, p.c, p.c + 1), { r: p.r, c: p.c + 1 }) },
      { separator: true },
      ...this.alignItems(p.c),
      { title: t("autoWidth"), icon: "move-horizontal", disabled: widthOf(tb, p.c) == null, run: () => this.apply(setWidth(tb, p.c, null), p) },
      { separator: true },
      ...this.colorItems(Array.from({ length: rowCount(tb) }, (_, r) => ({ r, c: p.c }))),
      { separator: true },
      { title: t("deleteCol"), icon: "trash-2", danger: true, disabled: colCount(tb) <= 1, run: () => this.apply(deleteCol(tb, p.c), { r: p.r, c: Math.min(p.c, colCount(tb) - 2) }) },
    ];
  }

  private cellMenu(p: Pos): MenuItem[] {
    const tb = this.table;
    return [
      { title: t("insertRowAbove"), icon: "arrow-up-to-line", disabled: p.r === 0, run: () => this.apply(insertRow(tb, p.r), p) },
      { title: t("insertRowBelow"), icon: "arrow-down-to-line", run: () => this.apply(insertRow(tb, p.r + 1), { r: p.r + 1, c: p.c }) },
      { title: t("insertColLeft"), icon: "arrow-left-to-line", run: () => this.apply(insertCol(tb, p.c), p) },
      { title: t("insertColRight"), icon: "arrow-right-to-line", run: () => this.apply(insertCol(tb, p.c + 1), { r: p.r, c: p.c + 1 }) },
      { separator: true },
      ...this.alignItems(p.c),
      { separator: true },
      ...this.colorItems([p]),
      { separator: true },
      { title: t("clearCell"), icon: "eraser", disabled: !tb.cells[p.r][p.c], run: () => this.apply(setCell(tb, p.r, p.c, ""), p) },
      { title: t("deleteRow"), icon: "trash-2", danger: true, disabled: p.r === 0 || rowCount(tb) <= 2, run: () => this.apply(deleteRow(tb, p.r), { r: Math.min(p.r, rowCount(tb) - 2), c: p.c }) },
      { title: t("deleteCol"), icon: "trash-2", danger: true, disabled: colCount(tb) <= 1, run: () => this.apply(deleteCol(tb, p.c), { r: p.r, c: Math.min(p.c, colCount(tb) - 2) }) },
    ];
  }

  private alignItems(c: number): MenuItem[] {
    const cur = this.table.align[c];
    const item = (a: Align, title: string, icon: string): MenuItem => ({
      title,
      icon,
      checked: (cur ?? "left") === a,
      run: () => this.apply(setAlign(this.table, c, a), this.sel ?? undefined),
    });
    return [item("left", t("alignLeft"), "align-left"), item("center", t("alignCenter"), "align-center"), item("right", t("alignRight"), "align-right")];
  }

  /** 底色：一排色块，标题是「底色」 */
  private colorItems(cells: Pos[]): MenuItem[] {
    const current = new Set(cells.map((p) => bgOf(this.table, p.r, p.c) ?? "none"));
    const one = current.size === 1 ? [...current][0] : null;
    return [
      { title: t("color") },
      { swatch: "none", title: t("noColor"), checked: one === "none", run: () => this.apply(setBg(this.table, cells, null), this.sel ?? undefined) },
      ...CELL_COLORS.map((color): MenuItem => ({ swatch: color, title: t(color), checked: one === color, run: () => this.apply(setBg(this.table, cells, color), this.sel ?? undefined) })),
    ];
  }

  /** 自己画的弹出菜单：样式统一，色块能排成一行，手机上也好点 */
  private openMenu(items: MenuItem[], x: number, y: number): void {
    this.closePopover();
    const doc = this.root.ownerDocument;
    const pop = doc.body.appendChild(doc.createElement("div"));
    pop.className = "ggt-menu";
    pop.setAttribute("role", "menu");
    let swatches: HTMLElement | null = null;
    for (const item of items) {
      if (item.separator) {
        swatches = null;
        if (pop.lastElementChild && !pop.lastElementChild.classList.contains("ggt-menu-sep")) pop.appendChild(doc.createElement("div")).className = "ggt-menu-sep";
        continue;
      }
      if (item.swatch) {
        if (!swatches) {
          swatches = pop.appendChild(doc.createElement("div"));
          swatches.className = "ggt-menu-swatches";
        }
        const b = swatches.appendChild(doc.createElement("button"));
        b.type = "button";
        b.className = "ggt-swatch" + (item.checked ? " is-checked" : "");
        b.dataset.bg = item.swatch;
        b.setAttribute("aria-label", item.title ?? "");
        b.title = item.title ?? "";
        b.addEventListener("click", () => {
          this.closePopover();
          item.run?.();
        });
        continue;
      }
      if (!item.run) {
        const label = pop.appendChild(doc.createElement("div"));
        label.className = "ggt-menu-label";
        label.textContent = item.title ?? "";
        continue;
      }
      const b = pop.appendChild(doc.createElement("button"));
      b.type = "button";
      b.className = "ggt-menu-item" + (item.danger ? " is-danger" : "") + (item.checked ? " is-checked" : "");
      b.disabled = !!item.disabled;
      b.setAttribute("role", "menuitem");
      const ic = b.appendChild(doc.createElement("span"));
      ic.className = "ggt-menu-icon";
      if (item.icon && this.host.setIcon) this.host.setIcon(ic, item.icon);
      b.appendChild(doc.createElement("span")).textContent = item.title ?? "";
      if (item.checked) {
        const ck = b.appendChild(doc.createElement("span"));
        ck.className = "ggt-menu-check";
        if (this.host.setIcon) this.host.setIcon(ck, "check");
        else ck.textContent = "✓";
      }
      b.addEventListener("click", () => {
        this.closePopover();
        item.run?.();
      });
    }
    if (pop.lastElementChild?.classList.contains("ggt-menu-sep")) pop.lastElementChild.remove();
    // 放在点击处，超出窗口就往回挪
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    const r = pop.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(x, vw - r.width - 8))}px`;
    pop.style.top = `${Math.max(8, y + r.height > vh - 8 ? Math.max(8, y - r.height) : y)}px`;
    pop.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        this.closePopover();
        this.input.focus({ preventScroll: true });
      }
    });
    this.popover = pop;
  }

  private closePopover(): void {
    this.popover?.remove();
    this.popover = null;
  }
}
