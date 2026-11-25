import type { Diag } from "../core/diag";

/** 表格插件的诊断实例（main.ts 建好放进来），写回表格的地方用它记一笔；手机上一直是 null */
export const diagRef: { diag: Diag | null } = { diag: null };
