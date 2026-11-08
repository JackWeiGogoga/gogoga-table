# gogoga Table

**English** | [简体中文](https://github.com/JackWeiGogoga/gogoga-table/blob/main/README.zh-CN.md)

Tables that look and feel like Notion or Feishu docs: click a cell to edit, color cells and resize columns in a click or a drag. Files stay plain Markdown tables, so they read fine without the plugin, on mobile and on GitHub.

The interface follows Obsidian's language setting (English and Simplified Chinese). Works on desktop and mobile.

## Install

### Community plugins (recommended)

Settings → Community plugins → turn off **Restricted mode** → **Browse**, search for **gogoga Table**, install it, then click **Enable**. Updates show up there too.

### Manual install

For offline machines (such as a company network) or to pin a specific version:

1. Open the [Releases page](https://github.com/JackWeiGogoga/gogoga-table/releases/latest) and download the three files `main.js`, `manifest.json`, `styles.css` under **Assets**. **Don't download the Source code archives**: they are the source code, which Obsidian can't load.
2. In your vault's folder, go to `.obsidian/plugins/`, create a folder named `gogoga-table`, and put the files in it, so you end up with paths like `<vault>/.obsidian/plugins/gogoga-table/main.js`.
   - `.obsidian` is a hidden folder: press `⌘ ⇧ .` in Finder on macOS; on Windows, tick **Hidden items** under **View** in File Explorer.
3. Restart Obsidian (or click the refresh button under Settings → Community plugins), then enable **gogoga Table** in the list of installed plugins.

On phones, where moving files around is awkward, use the community plugins browser.

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

## Performance

### Summary

- **Tables up to a few hundred rows (a few thousand cells) are smooth**: on 200 rows × 10 columns (2,000 cells), everything takes under 0.3 s, and selecting a cell or pressing an arrow key takes about 20 ms.
- **Tables with tens of thousands of cells open, scroll and select fine, but edits are slow**: on 1,000 rows × 20 columns (20,000 cells), opening takes about 0.4 s and selecting about 0.15 s; editing a cell, inserting a row, sorting or undoing takes 0.5–10 s. Most of that is Obsidian's own native table, which is just as slow without this plugin (see "Bottlenecks" below).
- **Recommendation**: keep a table to a few thousand cells. For more data, split it into several tables, or use Obsidian Bases or a CSV file.

### Stress test results

Measured in Obsidian 1.15 (macOS, Apple Silicon) with real mouse and keyboard events, from the input event to the next painted frame.

| Action | 200 rows × 10 columns | 1,000 rows × 20 columns |
|---|---|---|
| Open the note until the table is drawn | 0.05 s | 0.4 s |
| Switch to Reading view | 0.1 s | 0.7 s |
| Select a cell | 0.02 s | 0.15 s |
| Move with an arrow key | 0.01 s | 0.1 s |
| Select 50 rows | 0.01 s | 0.1 s |
| Crosshair following the mouse | — | 0.06 s |
| Longest frame while scrolling | 0.02 s | 0.09 s |
| Edit a cell and write it back | 0.1 s | 0.15–10 s |
| Insert a row | 0.15 s | 3.2 s |
| Sort by a column | 0.1–0.26 s | 3.4–10.5 s |
| Undo | 0.2 s | 0.5–14 s |

The same 1,000 × 20 table without this plugin, with changes of the same size made to Obsidian's native table:

| Change | Native table |
|---|---|
| Change a few characters in one cell | 0.16–3.1 s |
| Insert a row | 3.1–3.4 s |
| Reorder all body rows (like sorting) | 0.07–11 s |

In 0.4.0 and earlier, the same 1,000 × 20 table took 1.6 s to open, 2.4 s to switch to Reading view, 0.2 s to select a cell and up to 9.5 s to undo. This version adds three optimizations:

- Plain-text and number cells are shown directly instead of going through Markdown rendering one by one.
- Selecting, arrow keys and the crosshair update only the cells that changed.
- The crosshair is drawn as bands over the table instead of a style on each cell.

The table processing itself is fast: on 2,000 rows × 20 columns, parsing, writing back, inserting, moving and sorting each take a few milliseconds, and finding every table in a note with 200 tables takes about 3 ms.

### Bottlenecks and limits

1. **Obsidian's own native table (the main reason edits are slow).** In Live Preview, Obsidian builds its own table object for every table, even when this plugin's table covers it and it is never shown. When the table text changes:
   - If every change falls inside a single cell, it updates only those cells.
   - Inserting or deleting rows, sorting or replacing the whole table makes it rebuild the entire table right away.

   On a 20,000-cell table that takes 3–10 s, and it varies a lot depending on whether Obsidian has finished parsing the whole note. It happens without this plugin too: that is the native table's own speed. Obsidian skips the rebuild in only two cases: changes made by its own table editor (which carry an internal marker), and tables containing a search highlight. Both are Obsidian internals that plugins can't reach. Relying on them would break the plugin when Obsidian updates, possibly to the point of tables not showing at all, so this plugin doesn't.
2. **Selecting and arrow keys take about 0.1 s in big tables.** Selecting a cell makes the browser lay out and repaint the whole table, which alone takes tens of milliseconds on 20,000 cells. The hidden input that receives typing has to move into the selected cell, so that the IME candidate window shows up in the right place, and that move triggers a relayout of the whole table.
3. **Every row is drawn.** There's no rendering of only the visible rows, so bigger tables take longer to open and to switch views, roughly 20 ms per 1,000 cells. The same goes for Reading view.

### Running the stress tests

- The processing stress test is `scripts/tests/perf.test.ts`. It runs with `npm test` (and in CI), with generous limits that only catch changes that make things several times slower.
- The UI stress test (`t_perf.py`) lives in the e2e scripts outside this repository and runs inside Obsidian. It prints the timing table above, and turns the plugin off to time Obsidian's native table on the same note for comparison.

## Current scope

- An Advanced Tables formula comment (`<!-- TBLFM -->`) or a block id (`^id`) under a table is kept as is, with our comment after it, so formulas and block references keep working.
- Tables at the start of a line, and tables indented under a list item (right after the item or after one blank line, every row with the same indentation). Tables in code blocks, quotes and callouts (lines starting with `>`), and indented text outside lists, are left to Obsidian.
- A table directly after a paragraph (no blank line in between) is left to Obsidian.

## License

[MIT](LICENSE)
