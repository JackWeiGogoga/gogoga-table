/** 界面文字：跟着 Obsidian 的界面语言，中文以外都用英文 */

const zh = {
  insertRowAbove: "在上方插入行",
  insertRowBelow: "在下方插入行",
  insertColLeft: "在左侧插入列",
  insertColRight: "在右侧插入列",
  deleteRow: "删除行",
  deleteCol: "删除列",
  moveRowUp: "上移一行",
  moveRowDown: "下移一行",
  moveColLeft: "左移一列",
  moveColRight: "右移一列",
  align: "对齐",
  alignLeft: "左对齐",
  alignCenter: "居中",
  alignRight: "右对齐",
  color: "底色",
  noColor: "无底色",
  autoWidth: "自动列宽",
  clearCell: "清空内容",
  mergeCells: "合并单元格",
  unmergeCells: "取消合并",
  addRow: "加一行",
  addCol: "加一列",
  rowMenu: "行操作",
  colMenu: "列操作",
  resize: "拖动改列宽，双击自动",
  gray: "灰",
  red: "红",
  orange: "橙",
  yellow: "黄",
  green: "绿",
  blue: "蓝",
  purple: "紫",
};

type Key = keyof typeof zh;

const en: Record<Key, string> = {
  insertRowAbove: "Insert row above",
  insertRowBelow: "Insert row below",
  insertColLeft: "Insert column left",
  insertColRight: "Insert column right",
  deleteRow: "Delete row",
  deleteCol: "Delete column",
  moveRowUp: "Move row up",
  moveRowDown: "Move row down",
  moveColLeft: "Move column left",
  moveColRight: "Move column right",
  align: "Align",
  alignLeft: "Align left",
  alignCenter: "Align center",
  alignRight: "Align right",
  color: "Background",
  noColor: "No background",
  autoWidth: "Auto width",
  clearCell: "Clear contents",
  mergeCells: "Merge cells",
  unmergeCells: "Unmerge cells",
  addRow: "Add row",
  addCol: "Add column",
  rowMenu: "Row actions",
  colMenu: "Column actions",
  resize: "Drag to resize, double-click for auto",
  gray: "Gray",
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
};

let lang: "zh" | "en" = "en";

export function setLanguage(code: string | null | undefined): void {
  lang = code?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function t(key: Key): string {
  return (lang === "zh" ? zh : en)[key];
}
