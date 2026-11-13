import { type App, getLanguage, MarkdownView, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Extension } from "@codemirror/state";
import { setLanguage, t } from "./editor/i18n";
import { activeTableEditor, TABLE_COMMANDS } from "./editor/editor";
import { emptyTable, serializeTable } from "./core/table";
import { GridModal, insertTableText, textToTable } from "./obsidian/insert";
import { canPasteTableAt, gridToTable, insertTableAtSelection, pastedGrid, pastedSource } from "./obsidian/paste";
import { DEFAULT_SETTINGS, makeFactory, type TableHostFactory, type TableSettings } from "./obsidian/host";
import { livePreviewTables } from "./obsidian/live-preview";
import { readingProcessor } from "./obsidian/reading";

export default class TablePlugin extends Plugin {
  settings: TableSettings = { ...DEFAULT_SETTINGS };
  /** 注册给编辑器的扩展：关掉接管时清空，再 updateOptions，Obsidian 会整个重建（原生表格也回来） */
  private readonly extensions: Extension[] = [];
  private livePreview: Extension | null = null;
  private factory: TableHostFactory | null = null;

  async onload(): Promise<void> {
    setLanguage(typeof getLanguage === "function" ? getLanguage() : window.localStorage.getItem("language"));
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<TableSettings> | null) };
    const factory = makeFactory(this.app, () => this.settings);
    this.factory = factory;
    this.livePreview = livePreviewTables(factory);
    if (this.settings.enabled) this.extensions.push(this.livePreview);
    this.registerEditorExtension(this.extensions);
    this.registerMarkdownPostProcessor(readingProcessor(this.app, factory));
    this.addSettingTab(new TableSettingTab(this.app, this));
    // 新建表格、文字转表格
    this.addCommand({
      id: "insert-table",
      name: t("cmd_insertTable"),
      icon: "table",
      editorCallback: (editor) => new GridModal(this.app, (r, c) => insertTableText(editor, serializeTable(emptyTable(r, c)))).open(),
    });
    this.addCommand({
      id: "text-to-table",
      name: t("cmd_textToTable"),
      editorCheckCallback: (checking, editor) => {
        const table = textToTable(editor.getSelection());
        if (!table) return false;
        if (!checking) editor.replaceSelection(serializeTable(table).join("\n"));
        return true;
      },
    });
    // 正文里粘贴 Excel、网页上的表格：直接生成表格（#1）。表格里面的粘贴由表格自己处理，不会走到这里
    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        if (evt.defaultPrevented || !this.settings.enabled || !evt.clipboardData) return;
        // 从我们的表格复制来的：表格连同颜色、列宽、合并原样贴上（#8）
        const source = pastedSource(evt.clipboardData);
        const grid = source ? null : pastedGrid(evt.clipboardData, activeDocument);
        const lines = source ?? (grid ? serializeTable(gridToTable(grid)) : null);
        if (!lines || !canPasteTableAt(editor)) return;
        evt.preventDefault();
        insertTableAtSelection(editor, lines);
      }),
    );
    // 表格操作：作用在最近选中格子的那张表上，可以绑快捷键
    for (const id of TABLE_COMMANDS) {
      this.addCommand({
        id,
        name: t(`cmd_${id.replace(/-/g, "_")}` as Parameters<typeof t>[0]),
        checkCallback: (checking) => {
          const ed = activeTableEditor();
          if (!ed) return false;
          if (!checking) ed.runCommand(id);
          return true;
        },
      });
    }
    // 打开着的笔记重画一遍：已经渲染好的阅读视图不会自己再跑一遍后处理
    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  onunload(): void {
    // 关掉插件：阅读视图换回原生表格
    window.setTimeout(() => this.refresh(), 0);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refresh();
  }

  /** 设置改了：打开着的笔记重新画一遍表格（阅读视图只重画正在显示的，藏着的重画会变成空白） */
  refresh(): void {
    this.extensions.length = 0;
    if (this.settings.enabled && this.livePreview) this.extensions.push(this.livePreview);
    this.app.workspace.updateOptions();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) return;
      // 样式、行距：屏幕上已有的表格直接换
      leaf.view.containerEl.querySelectorAll<HTMLElement>(".ggt").forEach((root) => this.factory?.style(root));
      if (leaf.view.getMode() === "preview") leaf.view.previewMode.rerender(true);
    });
  }
}

class TableSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TablePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const zh = getLanguage?.().startsWith("zh");
    const s = this.plugin.settings;
    new Setting(containerEl)
      .setName(zh ? "接管 Markdown 表格" : "Enhance Markdown tables")
      .setDesc(zh ? "关掉后完全恢复 Obsidian 原生表格；文件里的注释留着，不影响显示。" : "Turn off to go back to Obsidian's own tables. Comments already in your notes stay and do no harm.")
      .addToggle((tg) =>
        tg.setValue(s.enabled).onChange(async (v) => {
          s.enabled = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName(zh ? "样式" : "Style")
      .addDropdown((dd) =>
        dd
          .addOptions(zh ? { default: "默认", zebra: "斑马纹", minimal: "极简线", academic: "三线表" } : { default: "Default", zebra: "Zebra", minimal: "Minimal", academic: "Three-line" })
          .setValue(s.preset)
          .onChange(async (v) => {
            s.preset = v as TableSettings["preset"];
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName(zh ? "行距" : "Row spacing")
      .addDropdown((dd) =>
        dd
          .addOptions(zh ? { comfortable: "舒适", compact: "紧凑" } : { comfortable: "Comfortable", compact: "Compact" })
          .setValue(s.density)
          .onChange(async (v) => {
            s.density = v as TableSettings["density"];
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName(zh ? "表格默认撑满页面宽度" : "Tables fill the page width")
      .setDesc(
        zh
          ? "没拖过列宽的表格铺满正文宽度，各列按内容多少分；拖过列宽的表格还按设的宽度。只改显示，不往笔记里写东西。单张表也可以用表格左上角菜单里的「撑满页面宽度」。"
          : "Tables whose column widths you haven't set stretch to the page width, with columns sized by their content; tables with set widths keep them. Display only — nothing is written to your notes. For a single table you can also use Fit to page width in its table menu.",
      )
      .addToggle((tg) =>
        tg.setValue(s.fullWidth).onChange(async (v) => {
          s.fullWidth = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName(zh ? "列宽按比例缩放" : "Scale column widths to fit")
      .setDesc(
        zh
          ? "拖过列宽的表格比正文宽时（比如打开了侧栏），各列按比例缩小到正好放下，不出横向滚动条；正文变宽后恢复原来的宽度。只改显示，笔记里还是原来的列宽。列太多、缩到很窄时照样横向滚动。"
          : "When a table with set column widths is wider than the page (say, with a sidebar open), its columns shrink proportionally to fit instead of scrolling sideways, and grow back when there's room. Display only — your notes keep the original widths. Tables with too many columns still scroll.",
      )
      .addToggle((tg) =>
        tg.setValue(s.fitCols).onChange(async (v) => {
          s.fitCols = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName(zh ? "阅读视图里表格只读" : "Read-only tables in Reading view")
      .setDesc(
        zh
          ? "和 Obsidian 的阅读视图一致：表格只看不改，点格子不会进入编辑，没有手柄和加号，链接照常能点。关掉后在阅读视图里也能直接改表格。"
          : "Like the rest of Reading view: tables are view-only, clicking a cell doesn't start editing, and there are no handles or add buttons; links still work. Turn off to edit tables directly in Reading view.",
      )
      .addToggle((tg) =>
        tg.setValue(s.readingReadonly).onChange(async (v) => {
          s.readingReadonly = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName(zh ? "十字高亮" : "Crosshair highlight")
      .setDesc(zh ? "选中格子时，把它所在的整行和整列铺一层淡色，看大表格不容易串行。「悬停时」跟着鼠标走，鼠标离开表格后回到选中的格子。" : "Tint the whole row and column of the selected cell so large tables are easier to follow. On hover follows the mouse, falling back to the selected cell when the mouse leaves the table.")
      .addDropdown((dd) =>
        dd
          .addOptions(zh ? { off: "关", select: "选中格子时", hover: "选中和悬停时" } : { off: "Off", select: "On the selected cell", hover: "On selected and hovered cells" })
          .setValue(s.crosshair)
          .onChange(async (v) => {
            s.crosshair = v as TableSettings["crosshair"];
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName(zh ? "编辑格子时直接显示格式" : "Show formatting while editing a cell")
      .setDesc(
        zh
          ? "编辑格子时，加粗、斜体、文字颜色、荧光笔、下划线直接显示效果，<span style=…> 这类标签藏起来，删字时标签保持成对，和 gogoga Mind Map 的节点编辑一样。关掉时显示原始的 Markdown 和 HTML。"
          : "While editing a cell, bold, italic, text colors, highlighter colors and underline show as formatted, with tags like <span style=…> hidden and kept paired when you delete text, as in gogoga Mind Map's node editor. When off, the raw Markdown and HTML are shown.",
      )
      .addToggle((tg) =>
        tg.setValue(s.richEdit).onChange(async (v) => {
          s.richEdit = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName(zh ? "编辑格子时选中文字显示格式栏" : "Format bar when selecting text in a cell")
      .setDesc(
        zh
          ? "编辑格子时选中一段文字，上方浮出一排按钮：加粗、斜体、删除线、下划线、高亮、文字颜色、荧光笔和清除，和 gogoga Mind Map 的格式栏一样。不打开也能用快捷键：⌘B、⌘I、⌘U、⌘⇧X、⌘⇧H。"
          : "While editing a cell, selecting text shows a bar above it: bold, italic, strikethrough, underline, highlight, text colors, highlighter colors and clear, the same as in gogoga Mind Map. Without it, use the shortcuts: Mod+B, Mod+I, Mod+U, Mod+Shift+X, Mod+Shift+H.",
      )
      .addToggle((tg) =>
        tg.setValue(s.formatBar).onChange(async (v) => {
          s.formatBar = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
