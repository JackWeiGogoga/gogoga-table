# Changelog

All notable changes to gogoga Table are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). 中文版见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [Unreleased]

### Added
- Multi-row headers: in the table's top-left menu, set **Header rows** to 2 or 3. Those rows are drawn as the header and stick together at the top, and sorting, totals and fill skip them, which suits grouped headers such as "Q1" over "Jan Feb Mar". Inserting or deleting rows inside the header adjusts the count, and merges can't cross the line between header and body. The file keeps the first row as the Markdown header and stores the count in the comment below the table; without the plugin the other rows show as ordinary rows.
- Freeze the header column: with **First column as header** on, the menu gains **Freeze header column**, which keeps the first column pinned on the left with a shadow along its edge while the table scrolls sideways. Turning the header column off removes the freeze too.
- Crosshair highlight (in settings, off by default): selecting a cell tints its whole row and column so large tables are easier to follow; **On selected and hovered cells** follows the mouse as well.

## [0.3.0] - 2026-11-07

### Added
- **Delete table** in the menu of the table button (top-left corner): removes the whole table along with its comment line; ⌘Z brings it back in Live Preview.

## [0.2.0] - 2026-11-07

### Added
- Tables indented under a list item (how gogoga Mind Map stores a table under a node) now become gogoga tables too. Obsidian doesn't render them in Live Preview, only the source, and in Reading view a table written right under the list item shows as plain text; now both views show a table aligned with the list item's text that you can edit, and write-back keeps each line's indentation.

### Fixed
- Giving header cells a background (click the header row's handle → **Background**, or select header cells) had no effect: the header's default light gray covered it, also with the Minimal and Three-line styles and while the header was stuck to the top. Header colors now show, sticky header included.
- After scrolling a wide table sideways, the row handle and the table button in the top-left corner scrolled out of sight with it. They now stay at the visible left edge, and hide when their row or column is scrolled out.

## [0.1.0] - 2026-11-06

### Added
- First version: Markdown tables in Live Preview and Reading view become Notion-style tables. Click a cell to edit, Enter / Tab to move, add rows and columns, row and column handles plus a right-click menu, drag to resize columns, seven cell backgrounds, three styles and two row spacings; on mobile, tap to edit and long-press for the menu. Select a range to color, align or clear it at once; copy and paste with Excel, Feishu and the web; merge cells; drag row and column handles to reorder; sticky headers on long tables and scroll hints on wide ones. Fill handle; a per-table corner menu (style, three-line style, header column, align all, distribute or fit widths); sort by column; duplicate rows and columns and insert many at once; checkboxes; text colors; total rows; status columns; formatting keys plus [[ link and # tag completion while editing; Insert table and Convert text to table commands. Styled HTML copy. Coexists with Advanced Tables formulas and block ids. Files stay plain Markdown tables, with widths, colors, merges and more in one comment below the table.

[Unreleased]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.3.0...HEAD
[0.3.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/JackWeiGogoga/gogoga-table/releases/tag/0.1.0
