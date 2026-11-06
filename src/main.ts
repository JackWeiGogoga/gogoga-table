import { type App, getLanguage, MarkdownView, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Extension } from "@codemirror/state";
import { setLanguage } from "./editor/i18n";
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
          .addOptions(zh ? { default: "默认", zebra: "斑马纹", minimal: "极简线" } : { default: "Default", zebra: "Zebra", minimal: "Minimal" })
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
  }
}
