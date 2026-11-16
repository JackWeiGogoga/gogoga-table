---
name: gogoga-table
description: Write Markdown tables for the gogoga Table plugin for Obsidian. Use when the user asks to create, fill in, restyle or restructure a table, 表格 or 飞书式表格 in an Obsidian note, or to turn data, a list, a plan or a comparison into one, and wants colors, column widths, merged cells, a total row, status labels, multi-row headers, folding or other styling. Covers the GFM table itself, the one-line `<!-- gogoga-table: {...} -->` comment below it and every key it holds, A1 cell addresses, and how rich text is stored inside cells.
---

# gogoga Table

The plugin has no file format of its own: a table is a standard GFM Markdown table. Anything Markdown can't express (column widths, cell colors, merges, totals, status labels and so on) lives in one HTML comment on the line right below the table. The comment is optional: a table without it is a valid table and shows with default settings. Without the plugin, the comment is invisible and the table reads as a normal table.

## The table

```markdown
| Plan | Price | Storage |
| :--- | :---: | ---: |
| Basic | $1 | 5 GB |
| Pro | $5 | 100 GB |
```

- The line before the table must be a blank line, a heading, a single-line HTML comment, or the start of the note. A table glued to a paragraph is left to Obsidian.
- The header row and the delimiter row must have the same number of cells. Body rows may differ; the table is padded to its widest row.
- Horizontal alignment uses the standard delimiter cells: `:---` left, `:---:` center, `---:` right, `---` default.
- Every row starts at the beginning of the line and contains `|`. The table ends at the first blank line or line without a pipe.
- Outer pipes are optional, and so is padding with spaces; the plugin keeps whichever style the table already has.
- A table can also sit under a list item, indented one level deeper than the item, right after it or after one blank line, every row with the same indentation. Tables in code blocks, quotes and callouts (`>`) are not handled by the plugin.

## The comment

```markdown
| Plan | Price | Storage |
| :--- | :---: | ---: |
| Basic | $1 | 5 GB |
<!-- gogoga-table: {"w":[160,null,120],"bg":{"B2":"yellow"}} -->
```

- It must be exactly one line, directly below the last table row, matching `<!-- gogoga-table: {JSON} -->`. The JSON must be a single object on that line. Broken JSON means the whole comment is ignored.
- Write any `|` inside the JSON as `|` (a pipe on the line right below a table can be read as another table row).
- Leave it out entirely when nothing needs setting.
- Exceptions: an Advanced Tables formula line (`<!-- TBLFM: ... -->`) may sit between the table and the comment. A block id (`^id`) under the table must be followed by a blank line, then the comment.

### Cell addresses

Cells are addressed like Excel: columns `A`, `B`, … `Z`, `AA`, …; rows from `1`, where row `1` is the header row. The delimiter row is not counted, so the first body row is row `2`. `B3` is the second column of the second body row. A range is `A3:B4` (top-left:bottom-right).

### Colors

Cell background (`bg`), cell text color (`fg`) and status labels (`opts`) take only these seven names: `gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`. They follow the theme in light and dark mode. Any other value (hex codes, `pink`, `teal` …) is silently dropped. For arbitrary colors on part of a cell's text, use inline HTML (see "Inside a cell").

### Keys

Per-column keys are arrays indexed by column (index 0 = column A); use `null` for columns without a value and drop trailing `null`s. Per-cell keys are objects keyed by cell address. A value with the wrong type is dropped, and the rest of the comment still applies. Keys the plugin doesn't know are kept as they are.

| Key | Type | Values | Example |
|---|---|---|---|
| `w` | per column | Column width in pixels (positive number, rounded); `null` = auto width | `"w":[200,null,120]` |
| `va` | per column | Vertical alignment: `"middle"` or `"bottom"`; `null` = top | `"va":[null,"middle"]` |
| `bg` | per cell | Background color name | `"bg":{"A2":"green","B2":"green"}` |
| `fg` | per cell | Text color name for the whole cell | `"fg":{"C4":"red"}` |
| `merge` | array of ranges | Merged rectangles, each at least two cells | `"merge":["A3:A5","B1:D1"]` |
| `fx` | per column | Calculated column: a formula using other columns' header names in braces; `null` for ordinary columns | `"fx":[null,null,null,"{Price}*{Qty}"]` |
| `fxd` | per column | Decimals of a calculated column, `0`–`3`; `null` = auto (integer when whole, else up to 2) | `"fxd":[null,null,null,2]` |
| `calc` | per column | Total: `"sum"`, `"avg"`, `"count"`, `"max"`, `"min"`. If any column has one, the **last row is the total row** | `"calc":[null,"sum","avg"]` |
| `opts` | per column | Status column: an object mapping each status value to a color name; `null` for ordinary columns | `"opts":[null,{"Done":"green","Todo":"gray"}]` |
| `headerCol` | `true` | Style the first column as a header column (tinted, bold) | `"headerCol":true` |
| `freeze` | `1` | Keep the first column fixed when scrolling sideways; only works together with `headerCol` | `"headerCol":true,"freeze":1` |
| `head` | `2` or `3` | Number of header rows. The Markdown header plus the next one or two rows are drawn as header, stick to the top together, and are left out of sorting, totals and fill. Omit for 1 | `"head":2` |
| `style` | string | This table's style: `"default"`, `"zebra"`, `"minimal"`, `"academic"` (three-line table). Omit to follow the settings | `"style":"academic"` |
| `density` | string | Row spacing: `"comfortable"` or `"compact"`. Omit to follow the settings | `"density":"compact"` |
| `fs` | number | Text size of the whole table as a multiplier, 0.5 to 3 (`1` is normal and is dropped). The menu uses 0.75, 0.85, 1, 1.15, 1.3 | `"fs":0.85` |
| `fz` | per cell | Text size multiplier of a cell, 0.5 to 3; multiplied with `fs` | `"fz":{"A1":1.3}` |
| `wide` | `1` | The table is meant to be wider than the page and scroll sideways; "Scale column widths to fit" leaves it alone | `"wide":1` |
| `fold` | `1` | Folded: only the header rows and a "Show N rows" bar are shown until the reader unfolds it. Needs at least one row below the header | `"fold":1` |

### Merged cells

Put the text in the top-left cell of the range and leave the other cells of the range empty. (If covered cells have text, the merged cell shows all of it, one per line, and nothing is lost; but empty is cleaner and reads right without the plugin.) Keep the same number of cells in every row. A merge must not straddle the boundary between the header rows and the body.

```markdown
| Team | Member | Role |
| --- | --- | --- |
| Design | Alice | Lead |
|  | Carol | UI |
| Engineering | Bob | Backend |
<!-- gogoga-table: {"merge":["A2:A3"],"va":["middle"]} -->
```

### Total row

With `calc` set, the last row is the total row. Write it yourself, with a label in the first column (`Total` when every column sums, `Summary` when they mix kinds; the plugin shows small kind labels next to the numbers itself, so write plain numbers) and the computed values in the `calc` columns: the plugin recomputes them only after the table is edited, so wrong numbers would show until then. How values are computed: over the body rows (after the header rows, before the total row); `sum`, `avg`, `max`, `min` use cells that read as numbers (thousands separators, a leading `$ ¥ € £` and a trailing `%` are allowed), keep the largest number of decimals among them, and `avg` shows at least two decimals when it isn't whole; `count` counts non-empty cells.

### Calculated columns

A column with an `fx` formula is calculated row by row; write the results into its cells yourself, because the plugin recalculates only after the table is edited. Formula syntax: column names in braces (`{Price}`, the text of the column's cell in the last header row), numbers, `+ - * /`, parentheses, and the functions `SUM`, `AVG`, `MIN`, `MAX` (any number of arguments; empty inputs are skipped) and `ROUND(x, places)`. Inputs are read like totals (thousands separators, a leading `$ ¥ € £`); `80%` counts as `0.8`. If an input is empty or not a number, or a division by zero happens, the result cell is empty. A referenced column name must be unique and non-empty, a formula can't refer to its own column, and calculated columns may refer to each other as long as there's no loop. Don't put hand-written data in a calculated column's body cells: it is replaced by the calculated results on the next edit (header and total row cells are not calculated).

```
| Item | Price | Qty | Amount |
| --- | --- | --- | --- |
| Apple | 12.5 | 3 | 37.5 |
| Pear | 8 | 2 | 16 |
<!-- gogoga-table: {"fx":[null,null,null,"{Price}*{Qty}"]} -->
```

### Status columns

In a status column each cell holds one status value as plain text, and `opts` maps every value used in the column to a color. Values must match the cell text exactly (after trimming). A value missing from `opts` is shown in gray until the table is next edited, when the plugin assigns it a color. When editing, the user picks from the values listed in `opts`.

## Inside a cell

A cell holds Markdown source on one line.

- Line break inside a cell: `<br>`. Leading and trailing spaces are trimmed.
- A literal pipe must be escaped as `\|`. This includes pipes inside links and embeds: `[[Note\|alias]]`, `![[photo.png\|160]]`.
- Inline Markdown works: `**bold**`, `*italic*`, `~~strike~~`, `==highlight==`, `` `code` ``, `[[Note]]`, `[text](https://…)`, `#tag`, `$x^2$`, `![[image.png]]` (images show at most 320 px wide unless a width is given).
- Colored highlight (Obsidian's own): a color emoji right after the opening `==`: `==🔴urgent==` (🔴 🟠 🟡 🟢 🔵 🟣).
- Text color on part of a cell: `<span style="color:#e03e3e">text</span>`. Highlighter color: `<mark style="background:#ffd43b">text</mark>`. Any hex (3 to 8 digits), color name or `rgb()`/`rgba()` works here. Both may wrap other formatting. Close every tag on the same line; when a colored span spans a `<br>`, close it before the `<br>` and reopen it after.
- Underline: `<u>text</u>`.
- Checkbox: `[ ]` or `[x]` at the very start of the cell, followed by a space or nothing: `[x] Ship it`.

Whole-cell background and text color go in `bg` / `fg`, not in HTML.

## Example: a project tracker

Status column with labels, a total row, a header column, widths and a highlighted row.

```markdown
| Task | Owner | Status | Hours | Notes |
| :--- | :--- | :---: | ---: | :--- |
| Design review | Alice | Done | 6 | Signed off by [[Product]] |
| API draft | Bob | In progress | 12.5 | **Due Friday**<br>see `api.md` |
| Load test | Bob | Blocked | 4 | <span style="color:#e03e3e">Waiting for servers</span> |
| [ ] Launch post | Carol | Todo | 0 |  |
| Total |  |  | 22.5 |  |
<!-- gogoga-table: {"w":[180,100,120,80,260],"headerCol":true,"opts":[null,null,{"Done":"green","In progress":"blue","Blocked":"red","Todo":"gray"}],"calc":[null,null,null,"sum"],"bg":{"A4":"red","B4":"red","D4":"red","E4":"red"}} -->
```

## Example: grouped two-row header

```markdown
| Region | Q1 |  |  | Q2 |  |  |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
|  | Jan | Feb | Mar | Apr | May | Jun |
| North | 120 | 135 | 128 | 140 | 152 | 149 |
| South | 98 | 101 | 110 | 115 | 109 | 121 |
| Total | 218 | 236 | 238 | 255 | 261 | 270 |
<!-- gogoga-table: {"head":2,"merge":["A1:A2","B1:D1","E1:G1"],"va":["middle"],"style":"academic","calc":[null,"sum","sum","sum","sum","sum","sum"],"bg":{"B1":"blue","E1":"green"}} -->
```

## Checklist before handing it over

- A blank line (or heading) above the table; header and delimiter rows have the same number of cells.
- The comment, if any, is one line directly below the last row, with valid JSON and no raw `|`.
- Addresses count the header as row 1; per-column arrays line up with the columns.
- Only the seven color names in `bg`, `fg` and `opts`.
- Merged ranges: text in the top-left cell, the rest empty, no range across the header boundary.
- With `calc`, the last row is the total row and its values are already correct.
- `|` inside cells is escaped as `\|`; line breaks are `<br>`.
