# 更新日志

gogoga Table 每个版本的主要变化都记在这里。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。English: [CHANGELOG.md](CHANGELOG.md).

## [Unreleased]

### 新增
- 列表项下面缩进写的表格也换成 gogoga 表格了（gogoga Mind Map 里节点下的表格就是这样存的）。Obsidian 自己在实时预览里不显示这种表格、只露出源码，阅读视图里紧跟着列表项写的也只是一串文字；现在两种视图都显示成表格，和列表项的文字对齐，能直接编辑，写回时每行的缩进原样保留。

## [0.1.0] - 2026-11-06

### 新增
- 第一个版本：实时预览和阅读视图里的 Markdown 表格换成 Notion 风格的表格。点格子编辑，Enter / Tab 跳格，加行加列，行列手柄和右键菜单，拖列宽，七种底色，三套样式和两档行距；手机上点一下编辑、长按出菜单。选一片格子一起设底色、对齐、清空；和 Excel、飞书、网页互相复制粘贴；合并单元格；拖动行列手柄调整顺序；长表格表头吸顶，宽表格左右有滚动提示。下拉填充；表格左上角菜单（单表样式、三线表、标题列、整表对齐、平均分布列宽、撑满页面）；按列排序；复制行列、一次插入多行；勾选框；文字颜色；合计行；状态列；编辑格子时的格式快捷键和 [[ 链接、# 标签补全；插入表格、文字转表格等命令。复制带样式的 HTML。兼容 Advanced Tables 的公式注释和块标识。文件仍是标准 Markdown 表格，列宽、颜色、合并等存在表格下面的一行注释里。

[Unreleased]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.1.0...HEAD
[0.1.0]: https://github.com/JackWeiGogoga/gogoga-table/releases/tag/0.1.0
