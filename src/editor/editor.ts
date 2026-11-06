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

import { type Align, CELL_COLORS, type CellColor, isDelimiterRow, parseTable, type Rect, type Table } from "../core/table";
import { bgOf, clearCells, colCount, deleteCol, deleteRow, insertCol, insertRow, mergeAt, mergeCells, merges, moveCol, moveRow, pasteGrid, rowCount, setAlign, setBg, setCell, setWidth, unmergeAt, widthOf } from "../core/ops";
import { fromTSV, toHTML, toTSV } from "../core/clipboard";
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


export class TableEditor {
  readonly root: HTMLElement;
  private table: Table;
  private readonly scroller: HTMLElement;
  private readonly tableEl: HTMLTableElement;
  private readonly input: HTMLTextAreaElement;
  private readonly rowHandle: HTMLElement;
  private readonly colHandle: HTMLElement;
  private sel: Pos | null = null;
  /** 多格选区的另一头（拖选、Shift）；null 是只选了一格 */
  private anchor: Pos | null = null;
  private editing = false;
  /** 编辑时宿主送来的新表：等这一格改完再换上 */
  private pending: Table | null = null;
  private hover: Pos | null = null;
  private popover: HTMLElement | null = null;
  private resize: { c: number; startX: number; startW: number; col: HTMLElement } | null = null;
  private destroyed = false;
  /** 上一次长按开菜单的时间（安卓随后还会来一次右键事件，忽略掉） */
  private longPressAt = -Infinity;
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
    this.watchScroll();
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

  // ---------- 表头吸顶、横向滚动阴影 ----------

  /** 往上找会滚动的容器（编辑器、阅读视图），表头在表格滚出它顶端时贴着顶端 */
  private watchScroll(): void {
    const win = this.root.ownerDocument.defaultView ?? window;
    const update = () => {
      if (this.destroyed) return;
      const sc = this.scroller;
      this.root.classList.toggle("can-left", sc.scrollLeft > 1);
      this.root.classList.toggle("can-right", sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1);
      this.stickHeader();
    };
    const onScroll = () => win.requestAnimationFrame(update);
    this.on(this.scroller, "scroll", onScroll, { passive: true });
    // 外面的滚动容器要等挂到文档上才找得到
    win.requestAnimationFrame(() => {
      for (let el = this.root.parentElement; el; el = el.parentElement) {
        const oy = win.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") {
          this.outer = el;
          el.addEventListener("scroll", onScroll, { passive: true });
          this.cleanups.push(() => el.removeEventListener("scroll", onScroll));
          break;
        }
      }
      update();
    });
    const ro = new win.ResizeObserver(onScroll);
    ro.observe(this.scroller);
    this.cleanups.push(() => ro.disconnect());
  }

  private outer: HTMLElement | null = null;

  private stickHeader(): void {
    const head = this.tableEl.tHead;
    if (!head) return;
    const outer = this.outer;
    let offset = 0;
    if (outer) {
      const top = outer.getBoundingClientRect().top;
      const t = this.tableEl.getBoundingClientRect();
      const h = head.getBoundingClientRect().height;
      // 表格顶端滚出去了、底部还在：表头往下挪，贴着容器顶端；表格快滚完时跟着走
      if (t.top < top && t.bottom - h > top) offset = Math.min(top - t.top, t.height - h * 2);
    }
    const stuck = offset > 0;
    this.root.classList.toggle("is-stuck", stuck);
    if (stuck) head.setAttribute("style", `transform: translateY(${Math.round(offset)}px)`);
    else head.removeAttribute("style");
  }

  // ---------- 渲染 ----------

  private render(): void {
    const doc = this.root.ownerDocument;
    const hadFocus = doc.activeElement === this.input;
    const tb = this.table;
    const rows = rowCount(tb);
    const cols = colCount(tb);
    if (this.sel) this.sel = this.canon({ r: Math.min(this.sel.r, rows - 1), c: Math.min(this.sel.c, cols - 1) });
    if (this.anchor) this.anchor = { r: Math.min(this.anchor.r, rows - 1), c: Math.min(this.anchor.c, cols - 1) };
    const ms = merges(tb);
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
        // 合并的格子：左上角那格跨行跨列，其余不画
        const m = ms.find((x) => r >= x.r1 && r <= x.r2 && c >= x.c1 && c <= x.c2);
        if (m && (m.r1 !== r || m.c1 !== c)) continue;
        const cell = tr.appendChild(doc.createElement(r === 0 ? "th" : "td"));
        cell.className = "ggt-cell";
        if (m) {
          cell.colSpan = m.c2 - m.c1 + 1;
          cell.rowSpan = m.r2 - m.r1 + 1;
          cell.classList.add("is-merged");
        }
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
    this.stickHeader();
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

  /** 格子元素；落在合并区域里的取左上角那格 */
  private cellEl(p: Pos): HTMLElement | null {
    const q = this.canon(p);
    return this.tableEl.querySelector<HTMLElement>(`.ggt-cell[data-r="${q.r}"][data-c="${q.c}"]`);
  }

  /** 落在合并区域里的位置换成左上角 */
  private canon(p: Pos): Pos {
    const m = mergeAt(this.table, p.r, p.c);
    return m ? { r: m.r1, c: m.c1 } : p;
  }

  /** 选区矩形（碰到的合并区域整块算进来）；没选中是 null */
  private rangeRect(): Rect | null {
    if (!this.sel) return null;
    const a = this.anchor ?? this.sel;
    let r: Rect = { r1: Math.min(a.r, this.sel.r), c1: Math.min(a.c, this.sel.c), r2: Math.max(a.r, this.sel.r), c2: Math.max(a.c, this.sel.c) };
    for (let grew = true; grew; ) {
      grew = false;
      for (const m of merges(this.table)) {
        const hit = m.r1 <= r.r2 && r.r1 <= m.r2 && m.c1 <= r.c2 && r.c1 <= m.c2;
        if (hit && (m.r1 < r.r1 || m.c1 < r.c1 || m.r2 > r.r2 || m.c2 > r.c2)) {
          r = { r1: Math.min(r.r1, m.r1), c1: Math.min(r.c1, m.c1), r2: Math.max(r.r2, m.r2), c2: Math.max(r.c2, m.c2) };
          grew = true;
        }
      }
    }
    return r;
  }

  /** 选了不止一格（一整块合并的格子算一格） */
  private isMulti(): boolean {
    const r = this.rangeRect();
    if (!r || (r.r1 === r.r2 && r.c1 === r.c2)) return false;
    const m = mergeAt(this.table, r.r1, r.c1);
    return !(m && m.r1 === r.r1 && m.c1 === r.c1 && m.r2 === r.r2 && m.c2 === r.c2);
  }

  /** 选区里的所有格子（含被合并盖住的） */
  private rangeCells(): Pos[] {
    const r = this.rangeRect();
    if (!r) return [];
    const out: Pos[] = [];
    for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) out.push({ r: i, c: j });
    return out;
  }

  private markSel(): void {
    for (const el of Array.from(this.tableEl.querySelectorAll(".is-selected, .is-sel-head, .is-in-range"))) el.classList.remove("is-selected", "is-sel-head", "is-in-range");
    this.root.classList.toggle("has-range", this.isMulti());
    if (this.isMulti()) {
      const r = this.rangeRect();
      if (r)
        for (const el of Array.from(this.tableEl.querySelectorAll<HTMLElement>(".ggt-cell"))) {
          const er = Number(el.dataset.r);
          const ec = Number(el.dataset.c);
          if (er >= r.r1 && er <= r.r2 && ec >= r.c1 && ec <= r.c2) el.classList.add("is-in-range");
        }
    }
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

  /** extend：保留选区的另一头（Shift、拖选），否则只选这一格 */
  private setSel(p: Pos | null, focus: boolean, extend = false): void {
    if (this.editing) this.commit();
    if (extend && this.sel && p) this.anchor = this.anchor ?? this.sel;
    else this.anchor = null;
    this.sel = p && this.canon(p);
    if (this.anchor && this.sel && this.anchor.r === this.sel.r && this.anchor.c === this.sel.c) this.anchor = null;
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
    if (this.anchor) {
      this.anchor = null;
      this.markSel();
    }
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

  /**
   * 编辑框跟着内容长高：格子里的内容区换成编辑框里的原文（看不见），编辑框盖在上面，
   * 格子按这段原文的高度排版，不用量高度、设内联样式
   */
  private autosize(): void {
    const content = this.sel && this.cellEl(this.sel)?.querySelector<HTMLElement>(".ggt-content");
    if (!content) return;
    content.classList.remove("is-empty");
    content.textContent = this.input.value + "\u200b";
  }

  /** 编辑结束：内容区换回渲染好的样子 */
  private restoreContent(p: Pos): void {
    const content = this.cellEl(p)?.querySelector<HTMLElement>(".ggt-content");
    if (content) this.fill(content, this.table.cells[p.r][p.c]);
  }

  /** 编辑完：内容变了就交给宿主 */
  private commit(): void {
    if (!this.editing || !this.sel) return;
    const p = this.sel;
    this.editing = false;
    this.cellEl(p)?.classList.remove("is-editing");
    const text = this.input.value.replace(/\r\n?/g, "\n");
    this.input.value = "";
    const next = setCell(this.table, p.r, p.c, text.replace(/^\s+|\s+$/g, ""));
    const pending = this.pending;
    this.pending = null;
    if (next !== this.table) {
      const prev = this.table;
      this.table = next;
      this.restoreContent(p);
      this.host.onChange(next, prev);
    } else if (pending) {
      this.table = pending;
      this.render();
    } else this.restoreContent(p);
  }

  private cancel(): void {
    if (!this.editing || !this.sel) return;
    this.editing = false;
    this.cellEl(this.sel)?.classList.remove("is-editing");
    this.input.value = "";
    if (this.pending) {
      this.table = this.pending;
      this.pending = null;
      this.render();
    } else this.restoreContent(this.sel);
  }

  /** 换一张表，选区原样留着（批量设底色、对齐之后可以接着操作） */
  private applyKeepRange(next: Table): void {
    const anchor = this.anchor;
    this.apply(next, this.sel ?? undefined);
    if (anchor) {
      this.anchor = anchor;
      this.markSel();
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

  /** 方向键、Tab、Enter 走格；extend 是 Shift+方向键扩大选区。从合并的格子出发时从它的边上走出去 */
  private move(dr: number, dc: number, wrap = false, extend = false): void {
    if (!this.sel) return;
    const rows = rowCount(this.table);
    const cols = colCount(this.table);
    const m = mergeAt(this.table, this.sel.r, this.sel.c);
    let { r, c } = this.sel;
    if (m) {
      if (dr > 0) r = m.r2;
      if (dc > 0) c = m.c2;
    }
    if (extend) {
      const nr = Math.max(0, Math.min(rows - 1, r + dr));
      const nc = Math.max(0, Math.min(cols - 1, c + dc));
      this.setSel({ r: nr, c: nc }, true, true);
      return;
    }
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
      const p = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
      if (ev.pointerType === "touch") return this.touchStart(ev, p);
      ev.preventDefault();
      if (ev.button !== 0) return;
      if (ev.shiftKey && this.sel) {
        this.setSel(p, true, true);
        return;
      }
      const same = this.sel && this.sel.r === p.r && this.sel.c === p.c;
      if (!same || !this.editing) this.setSel(p, true);
      this.dragSelect(ev);
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
      // 安卓长按会再来一次右键事件：长按已经开过菜单了
      if (performance.now() - this.longPressAt < 1000) return;
      const p = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
      // 右键点在选区里：选区留着，菜单对整片生效
      const r = this.rangeRect();
      const inRange = this.isMulti() && r && p.r >= r.r1 && p.r <= r.r2 && p.c >= r.c1 && p.c <= r.c2;
      if (!inRange) this.setSel(p, true);
      else this.input.focus({ preventScroll: true });
      this.openMenu(this.cellMenu(inRange && this.sel ? this.sel : p), ev.clientX, ev.clientY);
    });
    this.on(this.root, "pointermove", (ev) => {
      if (this.resize || ev.pointerType === "touch" || this.root.classList.contains("is-dragging")) return;
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
    this.on(this.input, "copy", (ev) => this.onCopy(ev, false));
    this.on(this.input, "cut", (ev) => this.onCopy(ev, true));
    this.on(this.input, "paste", (ev) => this.onPaste(ev));
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
    // ⌘ 或 Ctrl 都算（不去判断平台）：Mac 上 Ctrl+Z 本来也没有别的用处
    const mod = ev.metaKey || ev.ctrlKey;
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
    if (mod && key.toLowerCase() === "y") {
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
        return this.move(-1, 0, false, ev.shiftKey);
      case "ArrowDown":
        stop();
        return this.move(1, 0, false, ev.shiftKey);
      case "ArrowLeft":
        stop();
        return this.move(0, -1, false, ev.shiftKey);
      case "ArrowRight":
        stop();
        return this.move(0, 1, false, ev.shiftKey);
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
        if (this.sel) {
          // 清空后选区留着（可以接着设底色、再清）
          const keep = this.anchor;
          this.apply(clearCells(this.table, this.rangeCells()), this.sel);
          if (keep) {
            this.anchor = keep;
            this.markSel();
          }
        }
        return;
      case "Escape":
        stop();
        // 选了一片：先收回成一格
        if (this.isMulti() && this.sel) {
          this.setSel(this.sel, true);
          return;
        }
        this.setSel(null, false);
        this.host.onLeave?.("escape");
        return;
    }
    // 其他键（打字）：落到输入框里，input 事件里开始编辑
    ev.stopPropagation();
  }

  /** 按住拖过几个格子：选中一片 */
  private dragSelect(ev: PointerEvent): void {
    const doc = this.root.ownerDocument;
    const move = (e: PointerEvent) => {
      if (this.editing) return;
      const el = doc.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".ggt-cell");
      if (!el || !this.tableEl.contains(el)) return;
      const p = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      if (this.sel && (p.r !== this.sel.r || p.c !== this.sel.c)) this.setSel(p, true, true);
    };
    const up = () => {
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("pointercancel", up);
    };
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", up);
    doc.addEventListener("pointercancel", up);
    void ev;
  }

  // ---------- 复制粘贴 ----------

  /** 选区里的内容（被合并盖住的格子是空的） */
  private rangeGrid(): string[][] {
    const r = this.rangeRect();
    if (!r) return [];
    const grid: string[][] = [];
    for (let i = r.r1; i <= r.r2; i++) {
      const row: string[] = [];
      for (let j = r.c1; j <= r.c2; j++) row.push(this.table.cells[i][j]);
      grid.push(row);
    }
    return grid;
  }

  private onCopy(ev: ClipboardEvent, cut: boolean): void {
    if (this.editing || !this.sel || !ev.clipboardData) return;
    ev.preventDefault();
    const grid = this.rangeGrid();
    const r = this.rangeRect();
    ev.clipboardData.setData("text/plain", toTSV(grid));
    ev.clipboardData.setData("text/html", toHTML(grid, r?.r1 === 0));
    if (cut && !this.host.readonly) this.applyKeepRange(clearCells(this.table, this.rangeCells()));
  }

  private onPaste(ev: ClipboardEvent): void {
    if (this.editing || !this.sel || this.host.readonly || !ev.clipboardData) return;
    const grid = gridFromClipboard(ev.clipboardData, this.root.ownerDocument);
    if (!grid) return;
    ev.preventDefault();
    const r = this.rangeRect() ?? { r1: this.sel.r, c1: this.sel.c, r2: this.sel.r, c2: this.sel.c };
    // 复制了一格、选了一片：每格都填上（和 Excel 一样）
    if (grid.length === 1 && grid[0].length === 1 && this.isMulti()) {
      let next = this.table;
      for (const p of this.rangeCells()) {
        const m = mergeAt(next, p.r, p.c);
        if (!m || (m.r1 === p.r && m.c1 === p.c)) next = setCell(next, p.r, p.c, grid[0][0]);
      }
      this.applyKeepRange(next);
      return;
    }
    const next = pasteGrid(this.table, r.r1, r.c1, grid);
    this.anchor = null;
    this.apply(next, { r: r.r1, c: r.c1 });
    // 粘贴进来的那一片选中
    if (grid.length > 1 || grid[0].length > 1) this.setSel({ r: r.r1 + grid.length - 1, c: r.c1 + Math.max(...grid.map((x) => x.length)) - 1 }, true, true);
  }

  // ---------- 触屏 ----------

  /**
   * 手指按在格子上：轻点是选中并进入编辑（键盘弹出来），按住不动半秒是菜单，滑动是滚动（什么都不做）。
   * 不在按下时 preventDefault，滚动照常
   */
  private touchStart(ev: PointerEvent, p: Pos): void {
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    let moved = false;
    let pressed = false;
    const timer = window.setTimeout(() => {
      if (moved) return;
      pressed = true;
      this.longPressAt = performance.now();
      this.setSel(p, false);
      this.openMenu(this.cellMenu(p), x0, y0);
    }, 500);
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) {
        moved = true;
        window.clearTimeout(timer);
      }
    };
    const end = (e: PointerEvent) => {
      window.clearTimeout(timer);
      this.tableEl.removeEventListener("pointermove", move);
      this.tableEl.removeEventListener("pointerup", end);
      this.tableEl.removeEventListener("pointercancel", end);
      if (moved || pressed || e.type === "pointercancel") return;
      const same = this.sel && this.sel.r === p.r && this.sel.c === p.c;
      if (same && this.editing) return;
      this.setSel(p, true);
      this.startEdit(true);
    };
    this.tableEl.addEventListener("pointermove", move);
    this.tableEl.addEventListener("pointerup", end);
    this.tableEl.addEventListener("pointercancel", end);
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
    const row = cls.includes("row");
    // 轻点打开行 / 列菜单；按住拖动换位置（和原生表格一样）
    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.button !== 0 || el.dataset.r === undefined) return;
      const p = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      this.handleDrag(ev, el, row, p);
    });
    el.addEventListener("click", (ev) => ev.preventDefault());
    return el;
  }

  /** 按住行 / 列手柄：拖出去超过几像素就是拖动换位置，否则松开时打开菜单 */
  private handleDrag(ev: PointerEvent, handle: HTMLElement, row: boolean, p: Pos): void {
    if (this.editing) this.commit();
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    const from = row ? p.r : p.c;
    let dragging = false;
    let target: number | null = null;
    const doc = this.root.ownerDocument;
    const line = doc.createElement("div");
    line.className = "ggt-drop-line" + (row ? " is-row" : " is-col");
    try {
      handle.setPointerCapture(ev.pointerId);
    } catch {
      // 合成事件
    }
    const marked = () => Array.from(this.tableEl.querySelectorAll<HTMLElement>(row ? `.ggt-cell[data-r="${from}"]` : `.ggt-cell[data-c="${from}"]`));
    /** 指针落在第几条缝上（0 = 第一行 / 列前面），返回挪过去以后的下标 */
    const slotAt = (x: number, y: number): { index: number; at: number } => {
      const cells = row
        ? Array.from({ length: rowCount(this.table) - 1 }, (_, i) => this.cellEl({ r: i + 1, c: 0 }))
        : Array.from({ length: colCount(this.table) }, (_, c) => this.cellEl({ r: 0, c }));
      const rects = cells.map((c) => c?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      let slot = rects.length;
      for (let i = 0; i < rects.length; i++) {
        const mid = row ? rects[i].top + rects[i].height / 2 : rects[i].left + rects[i].width / 2;
        if ((row ? y : x) < mid) {
          slot = i;
          break;
        }
      }
      const edge = slot < rects.length ? (row ? rects[slot].top : rects[slot].left) : row ? rects[rects.length - 1].bottom : rects[rects.length - 1].right;
      // 行的下标从 1 开始（第 0 行是表头）
      const fromIdx = row ? from - 1 : from;
      const dest = slot > fromIdx ? slot - 1 : slot;
      return { index: row ? dest + 1 : dest, at: edge };
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;
        dragging = true;
        this.root.classList.add("is-dragging");
        for (const c of marked()) c.classList.add("is-drag-source");
        this.root.appendChild(line);
      }
      const { index, at } = slotAt(e.clientX, e.clientY);
      target = index;
      const base = this.root.getBoundingClientRect();
      const t = this.tableEl.getBoundingClientRect();
      if (row) line.setAttribute("style", `top:${at - base.top - 1}px;left:${t.left - base.left}px;width:${t.width}px`);
      else line.setAttribute("style", `left:${at - base.left - 1}px;top:${t.top - base.top}px;height:${t.height}px`);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      line.remove();
      this.root.classList.remove("is-dragging");
      for (const c of marked()) c.classList.remove("is-drag-source");
      if (!dragging) {
        this.setSel(p, true);
        const rect = handle.getBoundingClientRect();
        this.openMenu(row ? this.rowMenu(p) : this.colMenu(p), rect.left, rect.bottom + 4);
        return;
      }
      if (target === null || target === from) return;
      if (row) this.apply(moveRow(this.table, from, target), { r: target, c: p.c });
      else this.apply(moveCol(this.table, from, target), { r: p.r, c: target });
    };
    const cancel = () => {
      dragging = false;
      target = null;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      line.remove();
      this.root.classList.remove("is-dragging");
      for (const c of marked()) c.classList.remove("is-drag-source");
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
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
    const multi = this.isMulti();
    const rect = this.rangeRect();
    const merged = mergeAt(tb, p.r, p.c);
    const mergeItems: MenuItem[] = [];
    if (multi && rect) mergeItems.push({ title: t("mergeCells"), icon: "combine", run: () => this.apply(mergeCells(tb, rect), { r: rect.r1, c: rect.c1 }) });
    if (merged) mergeItems.push({ title: t("unmergeCells"), icon: "split", run: () => this.apply(unmergeAt(tb, p.r, p.c), { r: merged.r1, c: merged.c1 }) });
    const cells = multi ? this.rangeCells() : [p];
    const cols = multi && rect ? Array.from({ length: rect.c2 - rect.c1 + 1 }, (_, i) => rect.c1 + i) : [p.c];
    return [
      { title: t("insertRowAbove"), icon: "arrow-up-to-line", disabled: p.r === 0, run: () => this.apply(insertRow(tb, p.r), p) },
      { title: t("insertRowBelow"), icon: "arrow-down-to-line", run: () => this.apply(insertRow(tb, (merged?.r2 ?? p.r) + 1), { r: (merged?.r2 ?? p.r) + 1, c: p.c }) },
      { title: t("insertColLeft"), icon: "arrow-left-to-line", run: () => this.apply(insertCol(tb, p.c), p) },
      { title: t("insertColRight"), icon: "arrow-right-to-line", run: () => this.apply(insertCol(tb, (merged?.c2 ?? p.c) + 1), { r: p.r, c: (merged?.c2 ?? p.c) + 1 }) },
      { separator: true },
      ...mergeItems,
      ...(mergeItems.length ? [{ separator: true }] : []),
      ...this.alignItems(cols),
      { separator: true },
      ...this.colorItems(cells),
      { separator: true },
      { title: t("clearCell"), icon: "eraser", disabled: !cells.some((c) => tb.cells[c.r][c.c]), run: () => this.apply(clearCells(tb, cells), this.sel ?? p) },
      { title: t("deleteRow"), icon: "trash-2", danger: true, disabled: p.r === 0 || rowCount(tb) <= 2 || multi, run: () => this.apply(deleteRow(tb, p.r), { r: Math.min(p.r, rowCount(tb) - 2), c: p.c }) },
      { title: t("deleteCol"), icon: "trash-2", danger: true, disabled: colCount(tb) <= 1 || multi, run: () => this.apply(deleteCol(tb, p.c), { r: p.r, c: Math.min(p.c, colCount(tb) - 2) }) },
    ];
  }

  /** 对齐（一列或选区里的几列） */
  private alignItems(c: number | number[]): MenuItem[] {
    const cols = Array.isArray(c) ? c : [c];
    const cur = new Set(cols.map((x) => this.table.align[x] ?? "left"));
    const one = cur.size === 1 ? [...cur][0] : null;
    const keep = () => ({ sel: this.sel, anchor: this.anchor });
    const item = (a: Align, title: string, icon: string): MenuItem => ({
      title,
      icon,
      checked: one === a,
      run: () => {
        const k = keep();
        let next = this.table;
        for (const x of cols) next = setAlign(next, x, a);
        this.apply(next, k.sel ?? undefined);
        if (k.anchor) {
          this.anchor = k.anchor;
          this.markSel();
        }
      },
    });
    return [item("left", t("alignLeft"), "align-left"), item("center", t("alignCenter"), "align-center"), item("right", t("alignRight"), "align-right")];
  }

  /** 底色：一排色块，标题是「底色」 */
  private colorItems(cells: Pos[]): MenuItem[] {
    const current = new Set(cells.map((p) => bgOf(this.table, p.r, p.c) ?? "none"));
    const one = current.size === 1 ? [...current][0] : null;
    return [
      { title: t("color") },
      { swatch: "none", title: t("noColor"), checked: one === "none", run: () => this.applyKeepRange(setBg(this.table, cells, null)) },
      ...CELL_COLORS.map((color): MenuItem => ({ swatch: color, title: t(color), checked: one === color, run: () => this.applyKeepRange(setBg(this.table, cells, color)) })),
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

/** 一个 HTML 格子里的文字：<br> 和块级元素之间算换行 */
function htmlCellText(el: Element): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) parts.push(n.textContent ?? "");
    else if (n.nodeName === "BR") parts.push("\n");
    else {
      const block = /^(P|DIV|LI)$/.test(n.nodeName) && parts.length && !parts[parts.length - 1].endsWith("\n");
      if (block) parts.push("\n");
      n.childNodes.forEach(walk);
    }
  };
  walk(el);
  return parts.join("").replace(/\u00a0/g, " ").trim();
}

/**
 * 剪贴板里的表格：先看 HTML（Excel、飞书、网页复制的表格），再看 Markdown 表格源码，最后按制表符分隔的文字。
 * 普通的一段文字返回 1×1；什么都没有返回 null
 */
export function gridFromClipboard(data: DataTransfer, doc: Document): string[][] | null {
  const html = data.getData("text/html");
  if (html && /<table/i.test(html)) {
    const parsed = new (doc.defaultView ?? window).DOMParser().parseFromString(html, "text/html");
    const table = parsed.querySelector("table");
    if (table) {
      const grid = Array.from(table.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("td, th")).map(htmlCellText));
      if (grid.length && grid.some((r) => r.length)) return grid;
    }
  }
  const text = data.getData("text/plain");
  if (!text) return null;
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.length >= 2 && lines[0].includes("|") && isDelimiterRow(lines[1])) {
    const t = parseTable(lines);
    if (t) return t.cells;
  }
  return fromTSV(text);
}
