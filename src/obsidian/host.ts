/** 实时预览、阅读视图共用：用 Obsidian 的能力（Markdown 渲染、图标、设置）拼出编辑器的宿主 */

import { type App, type Component, type HoverParent, Keymap, MarkdownRenderer, Notice, setIcon } from "obsidian";
import type { EditorHost, TableEditor } from "../editor/editor";
import { guardEditorHotkeys } from "./keys";

export interface TableSettings {
  /** 接管 Markdown 表格（关掉就完全是 Obsidian 原生表格） */
  enabled: boolean;
  preset: "default" | "zebra" | "minimal" | "academic";
  density: "comfortable" | "compact";
  /** 十字高亮：选中（或悬停）格子时整行整列铺一层淡色；默认关 */
  crosshair: "off" | "select" | "hover";
  /** 编辑格子时选中文字浮出格式栏（加粗、颜色、荧光笔……）；默认关 */
  formatBar: boolean;
  /** 编辑格子时直接显示格式（加粗、颜色、荧光笔），标签藏起来；默认关 */
  richEdit: boolean;
  /** 阅读视图里表格只读（默认开）：关掉才能在阅读视图里直接改表格 */
  readingReadonly: boolean;
  /** 没设过列宽的表格撑满页面宽度（默认关）：只改显示，不往文件里写列宽 */
  fullWidth: boolean;
}

/** 格式栏的颜色：和 gogoga Mind Map 的默认「常用文字颜色 / 荧光笔颜色」一样 */
export const FORMAT_TEXT_COLORS = ["#e03e3e", "#2f80ed", "#27ae60"];
export const FORMAT_HIGHLIGHT_COLORS = ["#ffd43b99", "#69db7c99", "#ff8fab99"];

export const DEFAULT_SETTINGS: TableSettings = {
  enabled: true,
  preset: "default",
  density: "comfortable",
  crosshair: "off",
  formatBar: false,
  richEdit: false,
  readingReadonly: true,
  fullWidth: false,
};

export interface TableHostFactory {
  enabled(): boolean;
  /** 阅读视图里的表格是不是只读 */
  readingReadonly(): boolean;
  /** owner：格子里渲染出来的 Markdown 挂在它下面，编辑器拆掉时一起卸载 */
  host(sourcePath: string, owner: Component, own: Pick<EditorHost, "onChange"> & Partial<EditorHost>): EditorHost;
  /** 把样式预设、行距放到编辑器根元素上 */
  style(root: HTMLElement): void;
  /** 编辑器挂上以后：接管 Obsidian 的编辑器快捷键等。返回拆掉时调的清理 */
  attach(editor: TableEditor): () => void;
}

/** 本地时间的 YYYYMMDDHHmmss（和 Obsidian 粘贴图片的文件名一样） */
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function makeFactory(app: App, settings: () => TableSettings): TableHostFactory {
  return {
    enabled: () => settings().enabled,
    readingReadonly: () => settings().readingReadonly,
    host: (sourcePath, owner, own) => {
      // 悬停预览挂在这里（Obsidian 把弹出的预览记在 hoverPopover 上）
      const hoverParent: HoverParent = { hoverPopover: null };
      return {
        renderMarkdown: (el, md) => {
          void MarkdownRenderer.render(app, md, el, sourcePath, owner);
        },
        setIcon: (el, name) => setIcon(el, name),
        notice: (message) => new Notice(message),
        // 格子里的双链：照 Obsidian 的习惯，⌘/Ctrl 点在新标签打开，⌘⌥ 点在右侧分屏
        openLink: (href, ev) => {
          void app.workspace.openLinkText(href, sourcePath, Keymap.isModEvent(ev));
        },
        // 悬停预览：和笔记里的链接一样（实时预览里要按住 ⌘/Ctrl，按「页面预览」设置）
        hoverLink: (event, linktext, targetEl) => {
          app.workspace.trigger("hover-link", {
            event,
            source: "editor",
            hoverParent,
            targetEl,
            linktext,
            sourcePath,
          });
        },
        // 粘贴的图片按 Obsidian 的附件设置存，名字和 Obsidian 自己粘贴的一样
        saveImage: async (file) => {
          try {
            const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/\+.*$/, "");
            const name = file.name && file.name !== "image.png" ? file.name : `Pasted image ${stamp()}.${ext}`;
            const path = await app.fileManager.getAvailablePathForAttachment(name, sourcePath);
            const saved = await app.vault.createBinary(path, await file.arrayBuffer());
            return `![[${app.metadataCache.fileToLinktext(saved, sourcePath)}]]`;
          } catch (e) {
            new Notice((e as Error).message);
            return null;
          }
        },
        richEdit: () => settings().richEdit,
        formatColors: () => (settings().formatBar ? { text: FORMAT_TEXT_COLORS, highlight: FORMAT_HIGHLIGHT_COLORS } : null),
        // [[ 补全：笔记按名字找（名字开头的排前面），插的是 Obsidian 生成的最短链接
        suggestLinks: (query) => {
          const q = query.toLowerCase();
          const files = app.vault.getFiles().filter((f) => f.basename.toLowerCase().includes(q));
          files.sort((a, b) => Number(b.basename.toLowerCase().startsWith(q)) - Number(a.basename.toLowerCase().startsWith(q)) || a.basename.length - b.basename.length);
          return files.slice(0, 12).map((f) => {
            const text = app.metadataCache.fileToLinktext(f, sourcePath, true);
            return text;
          });
        },
        // # 补全：库里已有的标签
        suggestTags: (query) => {
          const q = query.toLowerCase();
          const all = Object.keys(
            (
              app.metadataCache as unknown as {
                getTags?: () => Record<string, number>;
              }
            ).getTags?.() ?? {},
          ).map((x) => x.replace(/^#/, ""));
          return all
            .filter((x) => x.toLowerCase().includes(q))
            .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)) || a.length - b.length)
            .slice(0, 12);
        },
        ...own,
      };
    },
    attach: (editor) => guardEditorHotkeys(app, editor),
    // 设置里的是默认值：表格自己在注释里定了样式就用表格的（编辑器收到 ggt-restyle 后重新套）
    style: (root) => {
      root.dataset.defPreset = settings().preset;
      root.dataset.defDensity = settings().density;
      root.dataset.cross = settings().crosshair;
      root.dataset.defFull = settings().fullWidth ? "1" : "";
      root.dispatchEvent(new Event("ggt-restyle"));
    },
  };
}
