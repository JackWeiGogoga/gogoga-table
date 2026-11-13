/** 实时预览、阅读视图共用：用 Obsidian 的能力（Markdown 渲染、图标、设置）拼出编辑器的宿主 */

import { type App, type Component, type HoverParent, Keymap, MarkdownRenderer, Menu, Notice, setIcon } from "obsidian";
import type { EditorHost, TableEditor } from "../editor/editor";
import { t } from "../editor/i18n";
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
  /** 设过列宽的表格比正文宽时，各列按比例缩到正好放下（默认开）：只改显示，文件里还是原来的列宽 */
  fitCols: boolean;
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
  fitCols: true,
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

/** Obsidian 自己给链接右键用的菜单（内部方法，没有就不加；有它菜单才和笔记里一模一样） */
function linkContextMenu(app: App, menu: Menu, linktext: string, sourcePath: string): void {
  const ws = app.workspace as unknown as { handleLinkContextMenu?: (menu: Menu, linktext: string, sourcePath: string) => boolean };
  ws.handleLinkContextMenu?.(menu, linktext, sourcePath);
}

/** 把格子里显示的图片复制到剪贴板（转成 PNG，剪贴板只认这个） */
async function copyImage(img: HTMLImageElement): Promise<boolean> {
  try {
    const doc = img.ownerDocument;
    const win = doc.defaultView ?? window;
    const blob = await (await fetch(img.currentSrc || img.src)).blob();
    let png = blob;
    if (blob.type !== "image/png") {
      const bmp = await win.createImageBitmap(blob);
      const canvas = doc.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext("2d")?.drawImage(bmp, 0, 0);
      png = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));
    }
    await win.navigator.clipboard.write([new win.ClipboardItem({ "image/png": png })]);
    return true;
  } catch (e) {
    new Notice((e as Error).message);
    return false;
  }
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
        // 右键格子里的双链：和笔记里一样的原生菜单（新标签页打开、重命名、移动、在访达中显示……，别的插件加的项也在）
        linkMenu: (ev, href) => {
          const menu = new Menu();
          linkContextMenu(app, menu, href, sourcePath);
          menu.showAtMouseEvent(ev);
        },
        // 右键格子里的图片：复制图片 + 原生的文件菜单 + 删除图片（删文件前用 Obsidian 自己的确认框，删了再把格子里的嵌入去掉）
        imageMenu: (ev, img, link, remove) => {
          const menu = new Menu();
          menu.addItem((item) =>
            item
              .setSection("action")
              .setTitle(t("copyImage"))
              .setIcon("copy")
              .onClick(() => void copyImage(img).then((ok) => ok && new Notice(t("copiedImage")))),
          );
          const file = link ? app.metadataCache.getFirstLinkpathDest(link, sourcePath) : null;
          if (link && file) linkContextMenu(app, menu, link, sourcePath);
          if (file && remove)
            menu.addItem((item) =>
              item
                .setSection("danger")
                .setTitle(t("deleteImage"))
                .setIcon("trash-2")
                .setWarning(true)
                .onClick(async () => {
                  if (await app.fileManager.promptForDeletion(file)) remove();
                }),
            );
          menu.showAtMouseEvent(ev);
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
      root.dataset.defFit = settings().fitCols ? "1" : "";
      root.dispatchEvent(new Event("ggt-restyle"));
    },
  };
}
