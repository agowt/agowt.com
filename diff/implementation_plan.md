# Diff Layout & Export Fixes (Round 3)

## User Review Required
I have investigated the layout and export button issues. Please review my findings and proposed solutions below.

## 1. Export Button Not Responding
**Investigation**: The reason the "Export to Word" button is completely dead is that the `index.html` file is still linking to `script.min.js?v=1.5`, whereas I have been writing all the new logic into the unminified `script.js` file! The browser has been running old code this entire time.
**Proposed Fix**: I will copy our updated logic into `script.min.js` and bump the version in `index.html` so your browser finally loads the new features. 

## 2. Mobile Line Number Float
**Investigation**: On mobile (where the table forces a horizontal scroll), the right-side line numbers float outside the green box. This happens because the `diff2html` library forces `position: absolute` on the line numbers, making them break out of the table cell layout when scrolling is introduced.
**Proposed Fix**: I will force the line numbers to be standard table cells (`position: static; display: table-cell;`). This will completely lock them inside the "Comparison" table on both mobile and desktop. 

## 3. Slimming Down Columns
**Investigation**: Since the line numbers will now be standard table cells, we can safely reduce their width to recover space. Furthermore, the massive "empty column" to the right of the text is caused by the text wrapping prematurely. 
**Proposed Fix**:
- I will shrink the line number column width from `4em` to `3em`.
- I will enforce `box-sizing: border-box` and `width: 100%` on the text columns so they stretch fully to the edges, eliminating that premature text wrap and killing the empty column completely.

## 4. Subtle "--- Original +++ Modified" Text
**Investigation**: This is a great idea to replicate the Git patch aesthetic. 
**Proposed Fix**: I will inject a subtle, monospace, muted text block (`--- Original<br>+++ Modified`) directly above the diff table results whenever a comparison is generated.

---

### Implementation Steps
1. Update `style.css` to fix the absolute positioning of the line numbers and make columns stretch fully.
2. Update `script.js` to inject the `--- Original +++ Modified` header text.
3. Synchronize `script.js` to `script.min.js` so the website actually runs the code.
4. Update `index.html` to bump the CSS/JS cache versions.
