# Changelog

All notable changes to gogoga Table are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). 中文版见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [Unreleased]

## [0.13.1] - 2026-11-14

### Fixed
- If you changed the hotkeys for Obsidian's bold, italic, strikethrough, highlight or insert link, pressing them in a table cell did nothing (only the default ⌘B, ⌘I and so on worked). Your own hotkeys now work too: while editing they format the selected text, and with cells selected they format whole cells.
- On iPhone and iPad (#15): in wide tables that scroll sideways, the sticky header turned transparent while scrolling, its text overlapping the rows with the header colors left behind, and sometimes the body disappeared. iOS's browser engine moved the header row's text but not its backgrounds; the header's cells are now moved one by one instead.

## [0.13.0] - 2026-11-14

### Added
- Text size: "Table text size" in the table menu and "Text size" in the cell menu, with five steps (smallest, small, normal, large, largest); a selection can be set at once. The table and cell sizes multiply, so a wordy table can be shrunk as a whole. Stored in the comment below the table (fs for the table, fz per cell), follows its cells when rows and columns are inserted, deleted or moved, and applies in Reading view and when copying to Word.

### Fixed
- With a plugin that adds items to right-click menus (such as adjustable-media) and "Native menus" on, right-clicking a link or image in a cell did nothing in Live Preview (#9): that plugin popped up a second menu that replaced the table's. A right-click now opens a single menu that includes the other plugin's items (such as "Wrap in a layout"); on a plain cell, those items are added at the end of the table's own menu instead of opening a second one.

## [0.12.2] - 2026-11-14

### Fixed
- Some themes add large cell padding to tables with !important, on top of the table's own padding: cells get wide empty margins, left- and right-aligned text in narrow columns looks centered, and when the theme pads cells differently in Reading view and Live Preview, column widths differ between the two (#14). With "Table style over theme" on (the default), cell padding now follows the plugin too, so alignment is visible and both views have the same column widths.

## [0.12.1] - 2026-11-14

### Fixed
- Exporting a note with the Export Image plugin (#7): tables came out as plain Obsidian tables, losing merged cells, colors, column widths and styles. Tables in the exported image (whole note, selection, or a folder) now look the same as in the note (read-only), and tables with dragged column widths shrink to the image width instead of being cut off.

## [0.12.0] - 2026-11-14

### Added
- Setting **Table style over theme** (on by default, #12): themes such as OnePage, Minimal, Blue Topaz, Border and phycat restyle table borders, header backgrounds, text colors and corners with !important, overriding this plugin. On, tables keep this plugin's look in all four styles, and cell colors still apply; off, the theme's table style wins.
- On phones and tablets, editing a cell shows the table's own toolbar above the keyboard: Done, Undo, Redo, Bold, Italic, Strikethrough, Highlight, Insert link, Checkbox, New line in cell, Previous cell and Next cell. With nothing selected, a format button inserts a pair of markers with the cursor between them, so what you type next gets that format. (Obsidian's own mobile toolbar hides while a cell is being edited, and its buttons only act on the note text.)
- Column widths can be changed on touch screens: tap a cell and a round handle appears on that column's right edge; drag it to resize, double-tap it to go back to automatic width.

### Fixed
- Empty lines in a cell (Shift+Enter) disappeared once you left the cell (#13). They now take up a line; the file is unchanged.
- With themes whose page background is translucent (phycat with a wallpaper, for example), the table menu, suggestions, format bar and color palette were see-through and hard to read. They now use Obsidian's menu background, like Obsidian's own menus.

## [0.11.0] - 2026-11-13

### Added
- Setting **Scale column widths to fit** (on by default): when a table with set column widths is wider than the page (say, after opening a sidebar or the file list), its columns shrink in proportion to fit instead of scrolling sideways, and grow back when there's room. Display only — your notes keep the original widths; tables with too many columns still scroll. Dragging a column border while scaled stores the width scaled back up (#10).
- Vertical alignment: right-click a cell or open the column menu for **Align top / Center vertically / Align bottom**, per column; the table menu can set it for the whole table. Stored in the comment below the table (`va`); top is the default and isn't written. Kept when copying to Word or Feishu. Alignment in the menus (left / center / right, top / middle / bottom) is now one row of icons with names on hover, so menus are a few rows shorter and fit short windows without scrolling.

### Changed
- The format bar's text color and highlighter (setting **Format bar when selecting text in a cell**) are now split buttons like gogoga Mind Map's: click the left half to reuse the last color, or ▾ for a palette with frequent colors, a 60-color grid, recent colors, opacity and a custom picker, so any color works. The last and recent colors are kept in settings and shared by all tables. The separate Highlight button moved into the highlighter palette (Highlight (==text==)).

### Fixed
- Some themes force a background on table headers and cells (Blue Topaz, Border and others, sometimes with !important), hiding the background and text colors you set on cells so they looked unapplied. Cell colors now win over the theme, and colored cells in a sticky header or frozen column stay opaque.
- In the format bar, No highlighter didn't remove a plain ==highlight== (only colored ones), and picking a highlighter color on ==highlighted== text stacked two highlights. Both now replace it.
- Inline code in cells had no background or monospace font in Live Preview, unlike inline code elsewhere in the note (Reading view was fine). It now matches.

## [0.10.0] - 2026-11-13

### Added
- Setting **Read-only tables in Reading view** (on by default): like the rest of Reading view, tables are view-only — clicking a cell doesn't start editing, there are no handles or add buttons, and links still work. Tables used to be editable in Reading view; turn this off to get that back.
- Typing 【【 with a Chinese input method in a cell now opens link suggestions too: 【【 becomes [[ and 】】 closes it as ]], so you don't have to switch input methods (same as gogoga Mind Map).
- Double-click an image in a cell to view it enlarged (click or Esc to close; in Reading view a single click opens Obsidian's own image viewer) (#9).
- Right-click an image in a cell: Copy image, open in a new tab, rename, move, open in default app, reveal in Finder, and **Delete image** (Obsidian's delete confirmation first; after the file is deleted the image is removed from the cell too, and Mod+Z brings the cell text back). Read-only tables don't offer Delete image (#9).
- Right-click a link in a cell for the same native link menu as in notes (#9).
- Setting **Tables fill the page width** (off by default): tables whose column widths you haven't set stretch to the page width, with columns sized by their content; tables with set widths keep them. Display only — nothing is written to your notes.

### Fixed
- On Windows (or macOS with scroll bars always shown), the horizontal scroll bar of a wide table sat under the add-row button and couldn't be dragged or clicked. The button now sits below the scroll bar.

## [0.9.1] - 2026-11-12

### Added
- Paste images into cells (#9): with a cell selected or being edited, Ctrl/Cmd+V a screenshot or copied image; it is saved per Obsidian's attachment settings and `![[image]]` is inserted. When the cell is only selected, the image is appended after its content instead of replacing it. Images in cells are at most 320 px wide so they don't blow up the column; write `![[image|100]]` to set a width.

### Fixed
- `[[links]]` in cells did nothing when clicked (#9). A click now opens the note in the current tab, Ctrl/Cmd-click or middle-click in a new tab, and hovering with Ctrl/Cmd shows a preview.
- Copying to Word (#8): in a dark theme, header, background and status colors came along dark and looked bad on white paper. Colors are now always taken from the light theme, and translucent ones are flattened onto white.
- **Copy as Markdown table** pasted into Word as plain text, not a table (#8). It now also carries a plain table without colors, so Word and email get a table; pasting into Obsidian still gives the plain Markdown table.

## [0.9.0] - 2026-11-12

### Added
- Copying a table to another note keeps its look (#8). Select cells and press Ctrl/Cmd+C, then paste into another note: cell colors, text colors, column widths, merged cells, alignment, status columns and the header column come along. Copying part of a table makes a new table from it (if the header isn't included, the first copied row becomes the header). Pasting into Excel, Word and other apps works as before.
- Two items in the table menu: **Copy whole table** (with its styles, no need to select it first) and **Copy as Markdown table (no styles)** (a plain Markdown table without the settings comment).

### Fixed
- Clicking an option in the status column's dropdown now fills it into the cell (#6). Before, the click ended editing and the cell stayed as it was; only the arrow keys and Enter worked. Clicking a `[[` link or `#` tag suggestion had the same problem and is fixed too.

## [0.8.4] - 2026-11-12

### Fixed
- With the first column frozen in the **Zebra** style, every other row of the frozen column was see-through: columns scrolled underneath showed through it and the text overlapped. The frozen column is now opaque in every row.
- When a selected range doesn't include the first column, its blue box now goes under the frozen column instead of lying on top of it.

## [0.8.3] - 2026-11-12

### Changed
- Adjusted how the PDF export sets column widths so the plugin passes the community plugin review. No change in behavior.

## [0.8.2] - 2026-11-12

### Fixed
- **Export to PDF** now prints tables the way they look in the note: cell colors, column widths, merged cells, the table style and alignment. Before, the PDF showed Obsidian's plain table. Handles, buttons and selection are not printed.
- In the PDF, a table whose set column widths add up to more than the page is shrunk to the page width, keeping the columns' proportions, instead of being cut off on the right.

## [0.8.1] - 2026-11-11

### Fixed
- When a table (with its comment) is the last thing in a note, clicking below it now puts the cursor on a new line under the table. Before, the cursor landed at the end of the table's last row, and pressing Enter split the table from its comment: the `<!-- gogoga-table … -->` line showed up as text and the table lost its colors and column widths (#5).
- When a table is at the end of a note and the file is changed from outside (sync, another plugin) starting at the table's end, the editor now picks up the change. Before, it could be mistaken for Obsidian reformatting the table and dropped, leaving the editor out of step with the file.

## [0.8.0] - 2026-11-10

### Added
- Two new items in the table's corner menu, **Indent (under the list item above)** and **Outdent (move out of the list)**. In Live Preview the table is drawn over its lines, so Tab can't indent it; now the whole table (with its comment) can be moved under the nearest list item above, becoming that item's note (in gogoga Mind Map, that node's note), or moved out after the list. ⌘Z undoes it.

### Fixed
- In reading view, an indented table written right below a list item (the way gogoga Mind Map stores node notes) is now drawn as a table instead of showing `| a | b |` source. Before, this only worked with a blank line between them.
- Copying part of a colored text while editing a cell no longer pastes as a half `<span …>` tag, and Shift+Enter inside colored text keeps each line complete.

## [0.7.0] - 2026-11-10

### Added
- **Show formatting while editing a cell** setting (off by default): the cell editor becomes a CodeMirror editor like gogoga Mind Map's node editor — bold, italic, text colors, highlighter colors and underline show as formatted while you type, tags like `<span style=…>` stay hidden and are kept paired when you delete text, and long colored text no longer turns into a wall of tags. Typing or using an input method on a selected cell still starts editing right away. The editor is only created for a table when you first select one of its cells.

### Changed
- Drag handles work like native tables (#2): the row handle appears when the mouse is in the first column, the column handle when it's on the header row, instead of on every hovered cell. Handles hide while scrolling and come back when the mouse moves, so they no longer jump with the sticky header or lag behind the row under the mouse.

### Fixed
- The sticky header no longer shakes when scrolling quickly with a trackpad (#2), for example when scrolling up from a table further down into a long table. Tables that don't scroll sideways now use the browser's native sticky positioning, which stays put while the editor redraws content during the scroll; wide tables move the header in whole device pixels. With the header stuck to the top, the column handle shows fully inside the header instead of being cut in half.
- In reading view, the table menu button and the row handle are no longer cut in half on the left: Obsidian's table wrapper used to clip everything outside the table border. Tables that don't scroll sideways now also stick their header natively in reading view.
- Reading view tables are taken over again when Obsidian passes an empty note text to plugins (seen in a real vault after reloading): the text is read from the open note instead, so tables don't silently stay native.
- A table inside a list item could lose its indent in Live Preview and line up with the left margin instead of the list text, when the same spot had held a top-level table before (for example after switching notes).
- In reading view, tables far down a long note (rendered before Obsidian attaches them to the page) now get a sticky header too; before, the header stayed put once you scrolled to them.
- When scrolling quickly, the sticky header no longer lets the text underneath show through along its top edge or between two header rows: headers of tables that can stick now always have an opaque background.

## [0.6.0] - 2026-11-09

### Added
- **Format bar when selecting text in a cell** setting (off by default): while editing a cell, selecting text shows the same bar as gogoga Mind Map — bold, italic, strikethrough, underline, highlight, text colors, highlighter colors and clear. It works in Live Preview and reading view. Mod+U now underlines the selected text while editing (`<u>…</u>`).

### Changed
- Deleting rows and columns follows the selection (#4): after selecting several cells, the right-click menu (and the row / column handle menus) offers **Delete 2 rows** / **Delete 3 columns** and so on, instead of greying out Delete row and Delete column. The header row still can't be deleted, and at least one data row and one column are kept.

### Fixed
- With crosshair highlight on, the row highlight now grows with the cell when the text wraps while editing, instead of covering only the first line.

## [0.5.1] - 2026-11-09

### Fixed
- In notes with tables, clicking text below the tables could land on the next line, for example clicking the paragraph right above a heading selected the heading instead. Each table's top and bottom margin wasn't counted in its height, so every table shifted the lines after it by 18 px.

## [0.5.0] - 2026-11-08

### Added
- Paste a table copied from Excel, WPS, Numbers, Feishu, Google Sheets or a web page into your note and it becomes a table, with the first row as the header (#1). Only content that is just a table (at least 2 rows and 2 columns) is converted; inside code blocks, math and frontmatter it pastes as before. Undo once to get back.

### Fixed
- Long tables no longer jitter while scrolling: the sticky header used to trail one step behind every scroll and snap back. On desktop the browser now moves the header in the same frame as the scroll; older environments keep the previous behavior. (#2)
- The sticky header now works in Reading view too; it used to stay at the top of the table there.

## [0.4.1] - 2026-11-08

### Changed
- Big tables are much faster: plain-text and number cells skip Markdown rendering, and selecting, arrow keys and the crosshair only update what changed. On a 1000 × 20 table, opening goes from 1.6 s to 0.4 s, undo from 9 s to 0.5 s, moving the selection from about 0.2 s to under 0.1 s, and switching to Reading view from 2.4 s to 0.6 s.
- Editing a cell in a big table is much faster: writing back changes only the characters that changed instead of replacing the whole table, so Obsidian's own native table updates just that cell instead of rebuilding it. On a 1000 × 20 table, editing a cell goes from about 3 s (over 10 s at worst) to about 0.1 s.

## [0.4.0] - 2026-11-08

### Added
- Multi-row headers: in the table's top-left menu, set **Header rows** to 2 or 3. Those rows are drawn as the header and stick together at the top, and sorting, totals and fill skip them, which suits grouped headers such as "Q1" over "Jan Feb Mar". Inserting or deleting rows inside the header adjusts the count, and merges can't cross the line between header and body. The file keeps the first row as the Markdown header and stores the count in the comment below the table; without the plugin the other rows show as ordinary rows.
- Freeze the header column: with **First column as header** on, the menu gains **Freeze header column**, which keeps the first column pinned on the left with a shadow along its edge while the table scrolls sideways. Turning the header column off removes the freeze too.
- Crosshair highlight (in settings, off by default): selecting a cell tints its whole row and column so large tables are easier to follow; **On selected and hovered cells** follows the mouse as well.

### Changed
- When a wide table scrolls sideways, the cut-off side now fades out. The old grey shadow sat a little inside the actual edge, leaving part of a column showing past it, which looked unfinished.

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

[Unreleased]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.13.1...HEAD
[0.13.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.13.0...0.13.1
[0.13.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.12.2...0.13.0
[0.12.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.12.1...0.12.2
[0.12.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.12.0...0.12.1
[0.12.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.11.0...0.12.0
[0.11.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.10.0...0.11.0
[0.10.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.9.1...0.10.0
[0.9.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.9.0...0.9.1
[0.9.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.8.4...0.9.0
[0.8.4]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.8.3...0.8.4
[0.8.3]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.8.2...0.8.3
[0.8.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.8.1...0.8.2
[0.8.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.8.0...0.8.1
[0.8.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.7.0...0.8.0
[0.7.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.6.0...0.7.0
[0.6.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.5.1...0.6.0
[0.5.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.4.1...0.5.0
[0.4.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/JackWeiGogoga/gogoga-table/releases/tag/0.1.0
