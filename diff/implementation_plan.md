# Diff Enhancements & Investigation

This document outlines the investigation into the mobile rendering issues, PDF export usability, Word document export, and the perceived "extra empty columns" in the diff table, along with the proposed solutions.

## User Review Required
Please review the proposed solutions below. No code changes have been made yet. Let me know if you approve this plan or if you have any adjustments!

## 1. Mobile Rendering Issue (1 Letter Per Line)
**Investigation**: 
Currently, the side-by-side table is forcing the text to fit within the screen width. Because we apply a rule (`word-break: break-all;`) to prevent long code strings from breaking the layout, the browser shrinks the columns on a mobile screen so much that it forces the text to wrap after every single letter.

**Proposed Fix**:
- Implement horizontal scrolling on mobile. 
- We will set a `min-width` (e.g., `700px`) on the diff table. On smaller screens, the text will no longer squish into 1 letter per line; instead, it will render legibly and the user can simply swipe left/right to view the full side-by-side comparison.

## 2. PDF Export Usability
**Investigation**:
The "Export to PDF" button currently just triggers the standard browser `window.print()`. Because there are no print-specific styles, the browser tries to print the entire webpage (including the black masthead, the input boxes, and buttons), which results in the diff table being squished or cut off, rendering the PDF useless.

**Proposed Fix**:
- Add a dedicated `@media print` CSS block.
- When exporting to PDF, this CSS will automatically hide the header, input boxes, and action buttons. 
- It will expand the diff table to use 100% of the page width and apply an appropriate scale so the side-by-side view fits neatly onto an A4 PDF page without getting cut off.

## 3. Export to Word (.doc)
**Investigation**:
Exporting directly to MS Word without a backend server is perfectly achievable by packaging the HTML diff table and our custom CSS into a `.doc` file format (using the `application/msword` MIME type). 

**Proposed Fix**:
- Add an "Export to Word" button to the export dropdown.
- Write a javascript function that grabs the generated diff HTML, wraps it in the necessary Microsoft Office HTML tags, and downloads it as `agowt-diff.doc`. This file can be opened directly in Microsoft Word, and the text will be fully editable.

## 4. "Extra Empty Columns" on the Right Side
**Investigation**:
Thank you for the clarification and the blue highlights! I dug into the core CSS of the `diff2html` library we are using, and I found the exact culprit. 

The library automatically applies a massive default padding of `4.5em` (about 72px) to the left and right of the text within the code columns, along with a `width: calc(100% - 9em)`. Because our custom CSS forces the text to wrap, the text wraps early to respect this huge right padding. This massive `4.5em` right padding is exactly the "extra empty column" you highlighted.

**Proposed Fix**:
- We will override this default library behavior in our `style.css` by setting the padding on `.d2h-code-side-line` to a much more reasonable value (e.g., `0.5rem`). 
- This will allow the text to flow all the way to the edge of the panel, completely removing that thick empty column on the right of the Original and Modified sections.

---

### Implementation Steps
1. **HTML**: Add the `btnExportWord` to the dropdown menu.
2. **CSS**: Add `@media (max-width: 768px)` rules for the `.d2h-file-diff` minimum width and horizontal scrolling.
3. **CSS**: Add `@media print` rules to hide UI elements and format the table for A4 PDFs.
4. **JS**: Implement the HTML-to-Word export logic.

Let me know if you approve this plan!
