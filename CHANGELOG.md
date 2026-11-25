# Changelog

All notable changes to gogoga Table are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). 中文版见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [Unreleased]

## [0.28.0] - 2026-11-25

### Added
- Diagnostics (desktop only, Settings → "Diagnostics"): if a note suddenly becomes empty, loses a large part or looks garbled, copies from before and after plus recent read/write events are saved on this computer; if it doesn't look like your own edit, a notice offers to restore it as a new note. Day to day only events are kept in memory, never note content; everything stays in Obsidian's app data folder outside the vault, never uploaded and untouched by git or cloud sync. Table write-backs are noted too (how many changes, not the content). "Detailed diagnostics" and "Export diagnostics" help send a problem to the developer (reports of notes being garbled or emptied).
- What's new after updating: after the plugin updates, a notice in the bottom right says which version it is now; click "What's new" to see what changed. If you skipped a few versions it shows once, listing all of them. Turn it off in settings, or run "Show what's new" from the command palette any time.

## [0.27.1] - 2026-11-24

### Fixed
- With the Minimal theme and "Table style over theme" turned off, merging cells down a column made some rows of the next column indented further, so the column didn't line up (feedback from the user group). Minimal removes the left padding of each row's first cell, and in the rows under a merged cell the first cell is the second column. Cell padding is no longer affected by the theme.
- After selecting cells, clicking outside the table or pressing Esc left the small fill handle at the bottom right of the old selection; it now goes away with the selection.
- On phones and tablets, dragging the table's handles and resize bar can no longer be taken over by Obsidian's swipe gesture that opens the sidebar.

## [0.27.0] - 2026-11-24

### Added
- "Edit a cell with a single click" setting (off by default, reported on Bilibili): clicking a cell with the mouse starts editing it, no double-click needed. Links, checkboxes and images, dragging, and Shift- or ⌘-clicking to select cells work as before.
- On phones and tablets, press and hold a cell, then drag without lifting your finger to select a range of cells in any direction. Releasing opens the menu with Merge cells at the top (suggested in the user group: the corner dot was hard to hit). Releasing without dragging still opens the cell menu. Dragging to the left or right edge of the table, or the top or bottom of the screen, scrolls the table or note and keeps extending the selection. The system text selection no longer pops up while dragging. The small corner dot is no longer shown for touch; it's still there with a mouse or pencil (dragging it fills cells).

### Fixed
- On Obsidian installed with an older installer (common on Windows, with an engine like Electron 25), the column-resize hit area and the crosshair highlight were shifted left, more so for columns further right (#22). These engines report column positions incorrectly, so positions are now taken from the cells in that case.

## [0.26.0] - 2026-11-24

### Added
- A "Change master password" item in settings, same as the command of that name (users couldn't find it). It's unavailable until something has been encrypted.

### Changed
- If the keychain entry you picked doesn't hold the master password, the password prompt now says it wasn't used. Before, it was skipped silently, so users thought the keychain password was the master password and got "Wrong password" when typing it.
- The password prompt is now titled "Enter master password" instead of "Unlock encrypted content". It also appears when encrypting a column, and the old title made it look like decrypting.
- Clearer description for "Master password from the keychain": the keychain only remembers your master password and doesn't set or change it, so the saved entry must match the password you set when you first encrypted something.

### Fixed
- Clicking a list task (`- [ ]`) inside a multi-line cell only ticked it on screen without changing the note, so it went back to unchecked the next time you edited the cell or reopened the note (reported in the user group). Clicking now updates that task in the note and can be undone. Cells that start with `[ ]` work as before.
- Pressing Shift+Enter at the start or end of colored text showed a stray `</span>` in the editor (reported in the mind map user group; cells behaved the same). The line break now goes outside the color, without leaving an empty color tag behind.

## [0.25.0] - 2026-11-23

### Added
- "Hide the blank line above tables" setting (off by default, suggested on Bilibili): Markdown needs a blank line before a table, which leaves a gap in Live Preview. On: that line is hidden so the table sits right under the text above, and it shows again when the cursor is on it. Display only — the blank line stays in your notes.
- "Convert selected text to table" understands more ways of splitting columns (requested on Xiaohongshu): two or more spaces or full-width spaces (aligned text copied from AI chats or web pages), single spaces when every line has the same number of columns, and text that looks like a Markdown table with pipes. Before, only tabs and commas worked.
- If the plugin's styles.css didn't load (left out of a manual install, or not synced yet), a notice now says where to check or to reinstall. Before, tables just showed a row of buttons underneath and very tall rows (reported on Bilibili).

## [0.24.1] - 2026-11-22

### Fixed
- With themes or CSS snippets that center all table cells, "Align left" had no effect and "Align center" looked like it did nothing (reported on Bilibili). Alignment is now applied inside the cell, so the theme can no longer override it, including while editing.

## [0.24.0] - 2026-11-22

### Added
- Merge cells on phones and tablets (requested on Xiaohongshu): long-press a cell and a dot appears at its bottom-right corner; drag the dot to select a block, and the menu that opens on release has "Merge cells" at the top. On desktop the dot still fills down.
- On phones and tablets, long-pressing a cell that has text while editing it goes to the system (cursor, text selection, paste), so the table menu couldn't be reached. The table toolbar above the keyboard now has a Table menu button (⋯) that closes the keyboard and opens the menu for that cell.

### Fixed
- On phones, the table toolbar above the keyboard (Done, Undo, Bold, links, previous / next cell and so on) never showed: on iPhone it sat behind the keyboard, without a keyboard the bottom navigation bar covered it, and Obsidian's own editing toolbar sat on top of it. It now sits right above the keyboard, and Obsidian's toolbar is hidden while you edit a cell.
- On phones, long-pressing a cell while the keyboard was up (cursor in a cell or in the note around the table) opened the table menu behind the keyboard. The keyboard now closes first.

## [0.23.4] - 2026-11-21

### Fixed
- On phones and tablets, a wide table no longer makes the whole page slide sideways: the add-column button now sits inside the page margin instead of poking past it.
- On iPhone and iPad, table menus (long-pressing a cell, the table corner button) showed up but couldn't be tapped: taps went through to the cell or note behind them, so only items that happened to sit outside the table sometimes worked (reported on Xiaohongshu). Menus, the format bar, suggestions and the date picker now respond to taps on phones and tablets.
- On iPhone and iPad, the column-width handle sat at the table's left edge, so dragging it opened Obsidian's left sidebar and resizing columns was hard (reported on Xiaohongshu). The handle now sits on the right edge of the selected column, and dragging it no longer pulls out the sidebar.
- On phones and tablets, long-pressing an empty cell while editing it showed only the system's Paste / Select / Select All menu instead of the table menu (reported on Xiaohongshu). An empty cell now opens the table menu; cells with text still get the system long-press for placing the cursor and selecting text.

## [0.23.3] - 2026-11-20

### Fixed
- With "Show formatting while editing a cell" on, text in centered and right-aligned cells shifted left while editing, so alignment looked broken (reported on Bilibili): Obsidian reserves room for the editor's scrollbar, which left 15px empty on the right of the cell editor. The editor now fills the cell, so text sits in the same place while editing as when viewing.

## [0.23.2] - 2026-11-20

### Fixed
- When a formatter (such as Linter's blank lines around tables) put a blank line between a table and the comment below it, merged cells, colors and column widths were all lost (reported on Bilibili): the comment was only read when it sat right under the table. It is now read with blank lines in between too, and they stay as they are when you edit the table, so the plugin and the formatter don't keep rewriting each other.
- Exporting with plugins such as Advanced PDF Export and Beautiful PDF lost merged cells and cell colors (reported on Bilibili). They render the note somewhere hidden and print that, and the plugin used to leave tables there alone. Those tables now get their merges and colors filled in; they stay plain tables without buttons, so they show correctly with those plugins' own styles.

## [0.23.1] - 2026-11-20

### Fixed
- On phones, tapping a row or column handle opened the menu and brought up the keyboard, which covered the menu; a long menu also went up behind the status bar. Tapping a handle no longer focuses the cell input (an open keyboard closes), and the menu stays inside the visible area below the status bar, scrolls when it's taller than the screen, and moves when the keyboard opens or closes.
- A colored span that contains a line break (`<span style="color:…">a<br>b</span>`) showed its HTML tags while you edited the cell. Colors and highlights that span lines are now hidden and shown in color while editing, like single-line ones.
- With some themes, text in a cell got bigger or smaller as soon as you started editing it: the theme's font size for the editor applied to the cell editor too. The cell editor now always uses the cell's own font size, font and line height.

## [0.23.0] - 2026-11-20

### Added
- Encrypted columns: choose Encrypted under Column type in the column menu, and the column stores text encrypted with a master password, for things like passwords and account numbers. The first time, you set a master password (typed twice, with an optional hint); after that, enter it once per Obsidian session to view and edit encrypted columns in every table. Cells show ••••••; hover to show a cell with the eye button or copy it with the copy button (cleared from the clipboard after 30 seconds), and Mod+C on a single encrypted cell copies it too. While editing, the cell shows the plain text and is encrypted when you press Enter; content pasted into an encrypted column is encrypted before it's saved. Notes only ever contain the encrypted text.
  - The encrypted text uses the same format as Meld Encrypt 3.x inline encryption (`%%🔐γ … 🔐%%`), so either plugin can decrypt it with the same password. Without this plugin, Obsidian's own tables hide it as a comment.
  - "Lock encrypted columns after" setting: lock after 5 minutes, 15 minutes or 1 hour of inactivity, or never. "Lock encrypted content" in the command palette or the column menu locks right away.
  - "Master password from the keychain" setting (Obsidian 1.13.2 and later): pick the keychain entry that holds your master password so you don't have to type it. Pick the same entry in Meld Encrypt to share one master password.
  - The master password is kept in memory only. Settings store a short text encrypted with it to check the password, not the password itself. If you forget the master password, the content can't be recovered.
  - Encrypted columns can't be sorted or totaled. Changing one to another type asks first, then saves its content back to the note decrypted.
- Encrypt single cells: select one or more cells in a regular column and choose Encrypt from the right-click menu to encrypt just those cells. Right-click an encrypted cell and choose Remove encryption (after a confirmation) to save it as plain text again. Status and multi-select cells can't be encrypted on their own.
- "Change master password" command: re-encrypts everything in the vault that uses the old master password with a new one, including encrypted table cells and Meld Encrypt inline text that uses the same password. It tells you how many notes and items it will change first. Text encrypted with other passwords and whole-note .mdenc files aren't changed. If any item can't be re-encrypted, nothing is changed.
- Meld Encrypt's older `🔐β` format can be decrypted too; cells you edit are saved in the newer `🔐γ` format.
- With gogoga Mind Map installed as well, encrypted cells in mind map node tables can be unlocked, viewed and edited too, using the same master password, and they lock together.

### Fixed
- Pressing Mod+Z (or Mod+Shift+Z) in a table in Live Preview jumped the view and the editor cursor to the top of the note (reported by a user). Undoing a change in the table now keeps the view where it is, with the cursor next to the table; undoing a change outside the table still jumps there as before.

## [0.22.1] - 2026-11-19

### Fixed
- In the note editor of gogoga Mind Map, selecting text in a table cell didn't show the format bar unless "Format bar when selecting text in a cell" was on (reported by a user: highlighting worked in the note's text but not in its tables). There it now always shows, like the format bar for the rest of the note. Elsewhere the setting works as before.

## [0.22.0] - 2026-11-19

### Added
- "Center tables" setting (off by default, requested by a user): tables narrower than the page sit in the middle of it, in Reading view and Live Preview. Tables wider than the page keep their left edge lined up with the text and scroll sideways as before, and tables that fill the page width are unchanged. CSS snippets that center tables with `margin: auto` on `table` didn't work with this plugin, because each table sits in a frame as wide as the table, on the left; this setting centers the frame.

## [0.21.0] - 2026-11-19

### Added
- The "Insert table" grid responds to the keyboard (requested by a user): Enter inserts the highlighted size (3 × 3 when you haven't moved the mouse), the arrow keys change the number of rows and columns, and Esc closes it.

### Fixed
- Clicking a + button on the table's edge to add a row or column while you were still typing in a cell lost what you had just typed (reported by a user). The cell is now saved first, then the row or column is added.

## [0.20.0] - 2026-11-19

### Changed
- The eraser button on the cell format bar now clears all formatting (bold, italic, strikethrough, underline, highlight, text color and highlighter color), not just colors. Selecting part of a formatted run clears only that part.

### Fixed
- Dragging to select text in a cell that included the `**` around bold text could make the text flicker and cut the selection short. The markers now stay as they were while you drag, and update when you let go.

## [0.19.3] - 2026-11-19

### Fixed
- When a cell was taller than the window (lots of text), the format bar for selected text could end up off screen, so it looked like it never appeared: it was placed above or below the whole cell, and both ends were out of view. It now sits next to the selected text, within the visible part of the cell.

## [0.19.2] - 2026-11-18

### Changed
- On Obsidian 1.13 and later, this plugin's settings show up in the search box of Obsidian's settings (for example, searching "three-line" finds the Style setting). The settings page looks the same as before, and earlier Obsidian versions keep the old page.
- Small code updates suggested by the Obsidian plugin review: the interface language comes from Obsidian's language API, and input method detection no longer relies on the deprecated `keyCode`. Nothing works differently.

### Fixed
- Copy image on a web image in a cell could fail for images from sites that don't allow cross-origin access. It now downloads the image through Obsidian, so any image shown in the cell can be copied.

## [0.19.1] - 2026-11-18

### Changed
- Styles no longer use the CSS `:has()` selector, which the Obsidian plugin review flags for performance: the wrapper Obsidian puts around tables in Reading view now gets a class from the plugin instead. Nothing looks or works differently.

## [0.19.0] - 2026-11-18

### Added
- Date columns understand more ways of typing a date: `1/5`, `11-17`, `1月5日`, `2026年1月5日`, `20260105`, `today`, `tomorrow`, `yesterday` (and 今天, 明天, 昨天) become the column's date style when you press Enter. Dates without a year use the current year. In a column set to daily note links, typed dates also become `[[2026-01-05]]`, so you no longer have to pick them from the calendar. Only cells you typed in are changed, so a "today" saved earlier is never silently turned into a date later. Turn this off with "Recognize dates typed in date columns" in settings (on by default); when off, only dates like `2026-1-5` are tidied, as before.
- Cells in a date column that aren't a date (such as `TBD` or a day that doesn't exist like `2026-02-30`) are kept as typed but get a faint wavy underline, with a tooltip saying they aren't treated as a date. This is display only; the file isn't changed.

### Changed
- Sorting a date column orders by the actual day, including `2026年1月5日` and daily note links. Cells that aren't dates come after the dates and empty cells come last, in both ascending and descending order, instead of being mixed in with the dates.

### Fixed
- Date columns: with "Show formatting while editing a cell" turned on, picking a day in the calendar seemed to do nothing. The date was written, but the cell immediately went back into editing with an empty box, and the next action cleared the date. The Today and Clear buttons had the same problem.

## [0.18.0] - 2026-11-17

### Added
- Column types (suggested by HARUKA春花 on Xiaohongshu, plus formatted results for calculated columns): the column menu's **Column type: …** opens a submenu with Text, Status (single select), Multi-select tags, Date, Number and Progress bar. Cells still hold plain readable text, so the note reads fine without the plugin; the type is saved as `"ty"` in the table's comment.
  - **Date**: editing a date cell shows a calendar; click a day to fill the cell, or use Today and Clear, or just type and the calendar follows. Write dates as `2026-11-17`, `2026/11/17` or a daily note link `[[2026-11-17]]` (using your Daily notes date format). Cells that are only a date are padded and switched to the column's style.
  - **Number**: thousands separator, percent, currency (¥ $ € £) and decimals; values are written in that format when you commit, so `1200` becomes `¥1,200.00`. Extra decimals you type are kept rather than rounded away. In a percent column, typing `12` gives `12%`. Calculated columns can use a number format too, and the total row follows the column's format.
  - **Progress bar**: cells like `60%`, `3/5` or `0.6` are drawn as a bar followed by the original text, green when full.
  - **Multi-select tags**: comma-separated values become colored tags, colored automatically like status columns and recolorable from the right-click menu. While editing, tags not yet used in the cell are listed; press ↓ to pick one and Enter to add it, or just press Enter to finish editing.

## [0.17.5] - 2026-11-17

### Changed
- Arrow keys while editing a cell (suggested on Bilibili): once the cursor is at the edge of the cell (start, end, first line or last line, counting wrapped lines), pressing the arrow key again saves the cell and moves to the next one, as in Obsidian's own tables. After typing into a cell, → or ↓ moves on straight away. In the middle of the text the arrows still move the cursor, and Shift+arrow still selects text.
- Narrow columns (suggested on Bilibili): a column you've dragged can now be as narrow as 40px; before, every column stayed at least 80px wide even though a smaller width was saved. Columns you haven't resized still start at 80px.

## [0.17.4] - 2026-11-17

### Fixed
- With the Minimal theme, **Settings → Tables fill the page width** had no effect; only the per-table **Fill page width** worked (#19). Minimal gives every table in the editor and Reading view `width: auto` with a more specific rule, which overrode the plugin's. The setting now wins over the theme. A table with this setting now reaches as far right as **Fill page width** does (before, it stopped 26px short of the text's right edge in every theme).

## [0.17.3] - 2026-11-16

### Fixed
- In Live Preview, when a theme, CSS snippet or older Obsidian made blocks in the editor scroll sideways, an extra, useless horizontal scrollbar showed under tables (reported in GitHub PR #18). The wrapper around the table no longer scrolls, matching Reading view: a wide table scrolls only inside itself.

## [0.17.2] - 2026-11-16

### Changed
- Long, wide tables (suggested on Bilibili): when a table's own horizontal scrollbar is below the visible area, a horizontal scrollbar floats at the bottom of the view and scrolls the table with it, so you don't have to scroll to the end of the table first. It goes away once the table's bottom edge is in view.

### Fixed
- Middle-click autoscroll (click the middle button, then move the mouse to scroll in any direction) was blocked over tables; it works again, as with Obsidian's own tables.

## [0.17.1] - 2026-11-16

### Changed
- Total row (suggested on Bilibili): when every column sums, it's still called "Total"; when columns mix average, max or count, the first cell is renamed "Summary" and each number gets a small label (Sum, Max, Count…). The label is display only: the cell still holds just the number, so it copies into Excel as a number. Hovering a total cell tells you how it's worked out. A name you typed yourself is left alone.

## [0.17.0] - 2026-11-16

### Added
- Calculated columns (asked for on Bilibili and Xiaohongshu): column menu → **Make calculated column…** and write a formula that uses other columns' names in braces, such as `{Price} * {Qty}` or `SUM({Jan},{Feb},{Mar})`. Every row is calculated, and the results are written into the cells, so the note still reads as a plain Markdown table everywhere. Type `{` to pick a column name, or click one of the names below the box. The first row is previewed as you type, and a broken formula is explained and can't be saved. Formulas support `+ − × ÷`, parentheses, `SUM`, `AVG`, `MIN`, `MAX` and `ROUND`, and decimals can be set to Auto or 0–3. Calculated cells can't be typed into; paste and fill skip them. Renaming a header updates the formulas, and a formula whose column was deleted marks the column's **ƒx** in red and leaves the column empty. Hovering a calculated cell shows a small **ƒx** in its corner; click **ƒx** in the header to edit the formula. **Stop calculating this column** keeps the last results as ordinary text. Saved as `"fx"` (and `"fxd"` for decimals) in the table's comment.

### Fixed
- The + above the table (add a row below the header) and the + on its left couldn't be clicked: there's a small gap between them and the table, and moving the mouse across it counted as leaving the table, so the button stopped taking clicks before the pointer reached it. It now waits 0.4 seconds after the pointer leaves the table.
- The header row can be deleted (#17): tables pasted in from elsewhere often have an empty first row. Right-click a header cell → **Delete header row (the next row becomes the header)**; it's greyed out when only one body row is left. In a multi-row header, deleting the first row makes the header one row shorter.
- With glass-style themes such as OnePage, the right-click menu, table menu, format bar and link suggestions were see-through and the table text showed behind them. They now sit on a solid layer, blurred like Obsidian's own menus; opaque themes look the same as before.

## [0.16.0] - 2026-11-15

### Added
- Fold a table (suggested on Bilibili): "Fold table (header only)" in the table's corner menu shows just the header plus a "▸ Show N rows" bar, saved as `"fold":1` in the comment so it stays folded when you reopen the note. Click the bar to unfold (the fold is removed); in Reading view the click only unfolds it there, without changing the file. While folded, the keyboard can't move into hidden rows, there are no row handles, add-row buttons or fill handle, and a search that jumps to a hidden row unfolds the table on the spot.

### Changed
- "Header rows" in the table's corner menu is now one row of 1 / 2 / 3 buttons, so the menu is shorter and fits short windows without scrolling.

## [0.15.2] - 2026-11-15

### Fixed
- After right-clicking a link or image in a cell, clicking another cell didn't close the menu; you had to click outside the table (#9). Clicking anywhere in the table now closes it, and the cell you clicked is selected as usual.

## [0.15.1] - 2026-11-15

### Fixed
- Search matches inside tables were hard to see (#15): they were marked with a pale yellow background, the same color as ==highlights==, so text that was already highlighted or sat in a colored cell looked unmarked. The match now gets an accent-colored outline drawn over the text, cell color and highlights, the same way Obsidian marks the current match in the rest of the note. Works for Find in file, global search and Omnisearch.
- Closing Find in file (Esc or ×) left the match marked in the table; the mark now goes away with it.

## [0.15.0] - 2026-11-14

### Added
- Setting "Cell side padding" (#14): how far text sits from a cell's left and right borders — 4, 6, 8 or 10; the default 10 is unchanged, and Compact tables use at most 8.

### Fixed
- Tables in Canvas cards with rich cell editing on: clicking inside the cell you were editing saved and left it, so you couldn't move the cursor and had to retype the cell. Canvas builds the card's editor in the main window and then moves it into the card, and the cell editor kept acting as if it were still in the main window; it now follows the document it's actually in.

## [0.14.0] - 2026-11-14

### Added
- Add buttons on all four sides: hovering a table now also shows a + on the left (adds a column at the start) and on top (adds a row below the header — Markdown tables need the header as the first row), like the ones on the right and bottom. These two sit outside the table and only take clicks once the pointer is inside the table, so clicking the line above doesn't add a row. Not shown on phones.

### Fixed
- Pressing Space on a selected cell replaced everything in it with a space, the same as typing. Space now starts editing with the content kept and the cursor at the end; on a checkbox cell it still ticks the box.

## [0.13.3] - 2026-11-14

### Changed
- With "Scale column widths to fit" on, dragging a column so the table becomes wider than the page used to shrink it straight back to the page width when you let go. Now the table keeps the width you dragged it to and scrolls sideways: the table remembers this (`"wide":1` in its comment) and is no longer scaled, even when the page gets narrower. Drag it back within the page width, or use "Fit to page width", and it scales to fit again. Other tables still shrink to fit when a sidebar opens.

## [0.13.2] - 2026-11-14

### Changed
- Pressing Esc while editing a cell now saves and leaves the cell, like Obsidian's own tables (#15). It used to cancel the edit and throw away what you had just typed; use ⌘Z / Ctrl+Z to undo.

### Fixed
- On iPhone and iPad (#15): tables that don't scroll sideways showed only their header, with the body missing. iOS's browser engine stretched the backdrop behind the header over the whole table and covered the body; that backdrop is no longer drawn on iOS (the header cells are opaque themselves).
- Searching for text inside a table in Live Preview (pressing Enter in Find in file, or clicking a result in global search) jumped there but didn't show which occurrence (#15). The occurrence is now marked in its cell and scrolled into view, and the mark goes away when the search moves outside the table or you click elsewhere.

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

[Unreleased]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.28.0...HEAD
[0.28.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.27.1...0.28.0
[0.27.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.27.0...0.27.1
[0.27.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.26.0...0.27.0
[0.26.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.25.0...0.26.0
[0.25.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.24.1...0.25.0
[0.24.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.24.0...0.24.1
[0.24.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.23.4...0.24.0
[0.23.4]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.23.3...0.23.4
[0.23.3]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.23.2...0.23.3
[0.23.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.23.1...0.23.2
[0.23.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.23.0...0.23.1
[0.23.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.22.1...0.23.0
[0.22.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.22.0...0.22.1
[0.22.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.21.0...0.22.0
[0.21.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.20.0...0.21.0
[0.20.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.19.3...0.20.0
[0.19.3]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.19.2...0.19.3
[0.19.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.19.1...0.19.2
[0.19.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.19.0...0.19.1
[0.19.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.18.0...0.19.0
[0.18.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.5...0.18.0
[0.17.5]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.4...0.17.5
[0.17.4]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.3...0.17.4
[0.17.3]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.2...0.17.3
[0.17.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.1...0.17.2
[0.17.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.17.0...0.17.1
[0.17.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.16.0...0.17.0
[0.16.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.15.2...0.16.0
[0.15.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.15.1...0.15.2
[0.15.1]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.15.0...0.15.1
[0.15.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.14.0...0.15.0
[0.14.0]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.13.3...0.14.0
[0.13.3]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.13.2...0.13.3
[0.13.2]: https://github.com/JackWeiGogoga/gogoga-table/compare/0.13.1...0.13.2
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
