/** 实时预览、阅读视图共用：用 Obsidian 的能力（Markdown 渲染、图标、设置）拼出编辑器的宿主 */

import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import type { EditorHost } from "../editor/editor";

export interface TableSettings {
  /** 接管 Markdown 表格（关掉就完全是 Obsidian 原生表格） */
  enabled: boolean;
  preset: "default" | "zebra" | "minimal";
  density: "comfortable" | "compact";
}

export const DEFAULT_SETTINGS: TableSettings = {
  enabled: true,
  preset: "default",
  density: "comfortable",
};

export interface TableHostFactory {
  enabled(): boolean;
  /** owner：格子里渲染出来的 Markdown 挂在它下面，编辑器拆掉时一起卸载 */
  host(sourcePath: string, owner: Component, own: Pick<EditorHost, "onChange"> & Partial<EditorHost>): EditorHost;
  /** 把样式预设、行距放到编辑器根元素上 */
  style(root: HTMLElement): void;
}

export function makeFactory(app: App, settings: () => TableSettings): TableHostFactory {
  return {
    enabled: () => settings().enabled,
    host: (sourcePath, owner, own) => ({
      renderMarkdown: (el, md) => {
        void MarkdownRenderer.render(app, md, el, sourcePath, owner);
      },
      setIcon: (el, name) => setIcon(el, name),
      ...own,
    }),
    // 设置里的是默认值：表格自己在注释里定了样式就用表格的（编辑器收到 ggt-restyle 后重新套）
    style: (root) => {
      root.dataset.defPreset = settings().preset;
      root.dataset.defDensity = settings().density;
      root.dispatchEvent(new Event("ggt-restyle"));
    },
  };
}
