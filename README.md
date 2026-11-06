# gogoga Table

**English** | [简体中文](https://github.com/JackWeiGogoga/gogoga-table/blob/main/README.zh-CN.md)

Tables that look and feel like Notion or Feishu docs: click a cell to edit, color cells and resize columns in a click or a drag. Files stay plain Markdown tables, so they read fine without the plugin, on mobile and on GitHub.

The interface follows Obsidian's language setting (English and Simplified Chinese). Works on desktop and mobile.

## Usage

It works as soon as it's on: Markdown tables in Live Preview and Reading view become gogoga tables, with no new syntax to learn.

- **Edit**: click a cell to select it and just type to replace it; double-click or press Enter to edit the existing text. While editing, Enter finishes and moves down, Shift+Enter adds a line break inside the cell, Tab / Shift+Tab move sideways, Esc cancels. Tab in the last cell adds a row.
- **Selected cell**: arrow keys move, Delete clears, ⌘Z / ⌘⇧Z undo and redo (same history as the editor). Moving up from the first row, down from the last, or pressing Esc puts the cursor back in the text around the table.
- **Add rows and columns**: hover the table and use the plus buttons on the right and bottom edges.
- **Row and column handles**: hover a cell to show handles on its row's left edge and its column's top edge. They open row / column menus: insert, move, color the whole row or column, delete; the column menu also has alignment and auto width.
- **Right-click a cell**: insert rows and columns, alignment, background, clear, delete.
- **Column width**: drag the right edge of a header cell; double-click it to go back to auto.
- **Backgrounds**: gray, red, orange, yellow, green, blue and purple, taken from your theme's colors and softened, so they work in light and dark mode.
- **Mobile**: tap a cell to edit, long-press for the menu, swipe to scroll as usual.
- Bold, links, `[[link\|alias]]`, tags and math render inside cells, and links open on click.

## Settings

- **Enhance Markdown tables** (on by default): turn off to go back to Obsidian's own tables.
- **Style**: Default (Notion-like: square corners, faint lines, a light header), Zebra, Minimal.
- **Row spacing**: Comfortable, Compact.

## What's stored in your notes

The table is a standard GFM table, with alignment in the standard `:---:` form. Column widths and backgrounds, which Markdown can't express, go in one HTML comment right below the table:

```markdown
| Plan | Price | Storage |
| :--- | :---: | ---: |
| Basic | $1 | 5 GB |
<!-- gogoga-table: {"w":[120,null,200],"bg":{"B2":"yellow"}} -->
```

- Cells are addressed like Excel: columns A, B, C, and row 1 is the header. Inserting, deleting or moving rows and columns updates the comment.
- Other editors don't show the comment, and in Obsidian the plugin hides it. It sits below the table because a comment directly above stops Obsidian's own Live Preview from recognizing the table.
- No comment is written when there are no widths or colors. If the comment is broken or removed, the table still shows, just without widths and colors.
- Tables padded with spaces stay aligned after edits (CJK characters count as two columns), and tables without outer pipes are written back without them.

## Current scope

- Only tables that start at the beginning of a line. Tables in code blocks, quotes and callouts (lines starting with `>`), or indented inside lists, are left to Obsidian.
- A table directly after a paragraph (no blank line in between) is left to Obsidian.
- Merged cells, multi-cell selection, copy and paste with Excel / Feishu, and dragging rows and columns are planned for later versions.

## License

[MIT](LICENSE)
