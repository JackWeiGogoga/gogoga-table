# gogoga Table

**English** | [简体中文](https://github.com/JackWeiGogoga/gogoga-table/blob/main/README.zh-CN.md)

Tables that look and feel like Notion or Feishu docs: click a cell to edit, color cells and resize columns in a click or a drag. Files stay plain Markdown tables, so they read fine without the plugin, on mobile and on GitHub.

The interface follows Obsidian's language setting (English and Simplified Chinese). Works on desktop and mobile.

## Usage

It works as soon as it's on: Markdown tables in Live Preview and Reading view become gogoga tables, with no new syntax to learn.

- **Edit**: click a cell to select it and just type to replace it; double-click or press Enter to edit the existing text. While editing, Enter finishes and moves down, Shift+Enter adds a line break inside the cell, Tab / Shift+Tab move sideways, Esc cancels. Tab in the last cell adds a row.
- **Selected cell**: arrow keys move, Delete clears, ⌘Z / ⌘⇧Z undo and redo (same history as the editor). Moving up from the first row, down from the last, or pressing Esc puts the cursor back in the text around the table.
- **Select a range**: drag across cells, Shift+click, or Shift+arrow keys. Color, align or clear (Delete) a whole range at once; right-click inside a range to act on all of it, and Esc goes back to a single cell.
- **Copy and paste**: ⌘C / ⌘X copy the selected cells as tab-separated text (Excel, Numbers) plus a styled HTML table (backgrounds, text colors, bold, alignment, widths, merges) that keeps its look in Feishu, Word or email; pasting back into a gogoga table uses the Markdown source, so links and bold survive. ⌘V pastes tables copied from Excel, Feishu or web pages, tab-separated text, or Markdown table source, starting at the selected cell and adding rows and columns as needed; copy one cell and paste over a range to fill every cell.
- **Merge cells**: select a range and right-click → **Merge cells**; the merged cell shows all their text and nothing is lost; unmerging gives each cell its own text back. Right-click a merged cell → **Unmerge cells**. Inserting rows or columns inside a merged area grows it, deleting shrinks it.
- **Add rows and columns**: hover the table and use the plus buttons on the right and bottom edges.
- **Row and column handles**: hover a cell to show handles on its row's left edge and its column's top edge. Drag a handle to reorder rows or columns (backgrounds, widths and merges move along); click it for the row / column menu: insert, move, color the whole row or column, delete; the column menu also has alignment and auto width.
- **Right-click a cell**: insert rows and columns, alignment, background, clear, delete.
- **Column width**: drag the right edge of a header cell; double-click it to go back to auto.
- **Backgrounds**: gray, red, orange, yellow, green, blue and purple, taken from your theme's colors and softened, so they work in light and dark mode.
- **Fill handle**: drag the small square at the bottom-right of a selection to continue a series down or right: numbers count up, numbered text (Item 1), dates, weekdays and months continue, anything else is copied; hold ⌥ to always copy. Dragging past the edge adds rows or columns.
- **Table menu** (top-left corner): style for this table (Default, Zebra, Minimal, Three-line) and row spacing, first column as header, align the whole table, distribute columns evenly, fit to page width, auto width for all columns, clear all colors.
- **Sort**: from the column menu, A→Z or Z→A; numbers by value, dates by time, Chinese by pinyin, empty cells last; a total row stays put.
- **Duplicate and insert many**: Duplicate row / column in the row and column menus; select several rows (or columns) and insert to add that many at once.
- **Checkboxes**: `[ ]` or `[x]` in a cell becomes a clickable checkbox; Space toggles a selected one; right-click → Turn into checkbox.
- **Text color**: the row of "A" swatches under the backgrounds in the right-click menu.
- **Total row**: column menu → Total → Sum, Average, Count, Max or Min adds a "Total" row at the bottom that updates as the data changes; new rows go above it.
- **Status columns**: column menu → Use as status column turns the values into colored labels, offers existing statuses while editing, and gives new ones a color; right-click a status to recolor it everywhere.
- **While editing a cell**: ⌘B bold, ⌘I italic, ⌘⇧X strikethrough, ⌘⇧H highlight, ⌘K link; type `[[` for note links and `#` for tags. Obsidian's editor shortcuts never touch the note around the table while you're in it.
- **Commands**: Insert table (pick the size on a grid), Convert selected text (CSV or tab-separated) to table, and row/column insert, duplicate, delete, sort, merge, align and more, all in the command palette and bindable to hotkeys.
- **Long and wide tables**: the header sticks to the top as you scroll down, and a soft shadow on either side shows when a wide table can scroll sideways.
- **Mobile**: tap a cell to edit, long-press for the menu, swipe to scroll as usual; after tapping a cell its row and column handles appear, and you can drag them with a finger.
- Bold, links, `[[link\|alias]]`, tags and math render inside cells, and links open on click.

## Settings

- **Enhance Markdown tables** (on by default): turn off to go back to Obsidian's own tables.
- **Style**: Default (Notion-like: square corners, faint lines, a light header), Zebra, Minimal.
- **Row spacing**: Comfortable, Compact.

## What's stored in your notes

The table is a standard GFM table, with alignment in the standard `:---:` form. Column widths, backgrounds and merged cells, which Markdown can't express, go in one HTML comment right below the table:

```markdown
| Plan | Price | Storage |
| :--- | :---: | ---: |
| Basic | $1 | 5 GB |
<!-- gogoga-table: {"w":[120,null,200],"bg":{"B2":"yellow"},"merge":["A3:B3"]} -->
```

- Elsewhere, merged cells show as ordinary cells: the top-left one has the text and the rest are empty, so nothing is lost.
- Cells are addressed like Excel: columns A, B, C, and row 1 is the header. Inserting, deleting or moving rows and columns updates the comment.
- Other editors don't show the comment, and in Obsidian the plugin hides it. It sits below the table because a comment directly above stops Obsidian's own Live Preview from recognizing the table.
- No comment is written when there are no widths or colors. If the comment is broken or removed, the table still shows, just without widths and colors.
- Tables padded with spaces stay aligned after edits (CJK characters count as two columns), and tables without outer pipes are written back without them.

## Current scope

- An Advanced Tables formula comment (`<!-- TBLFM -->`) or a block id (`^id`) under a table is kept as is, with our comment after it, so formulas and block references keep working.
- Tables at the start of a line, and tables indented under a list item (right after the item or after one blank line, every row with the same indentation). Tables in code blocks, quotes and callouts (lines starting with `>`), and indented text outside lists, are left to Obsidian.
- A table directly after a paragraph (no blank line in between) is left to Obsidian.

## License

[MIT](LICENSE)
