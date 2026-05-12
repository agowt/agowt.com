# Diff Enhancements & Investigation (Round 2)

## User Review Required
Please review the proposed solutions for the two new issues you found. No code changes have been made yet. Let me know if you approve this plan!

## 1. Line Numbers Overlapping Text
**Investigation**:
By overriding `.d2h-code-side-line` with `padding: 0 0.5rem !important;`, I removed the right padding (which successfully killed the extra empty column). However, I inadvertently also removed the *left* padding! 
Because `diff2html` positions the line numbers absolutely on the left side of the column, the text needs a left padding (specifically `4.5em`) so it doesn't render right on top of those line numbers.

**Proposed Fix**:
- I will update `style.css` to restore the `4.5em` left padding, while keeping the right padding small (`0.5rem`). This will prevent the text overlap while still ensuring no extra empty column appears on the right.

## 2. Export to Word (.doc) Not Doing Anything
**Investigation**:
The "Export to Word" (and likely the "Export as HTML") buttons are failing silently. This happens because the javascript runs an asynchronous `await fetch()` to download the CSS files before generating the file. Modern browsers (especially Safari/iOS) strictly block file downloads if they don't happen *immediately* after a user click. Because the script pauses to download the CSS, the browser thinks the script is trying to force a download without your permission and blocks it.

**Proposed Fix**:
- I will rewrite the export logic in `script.js` to be completely synchronous. Instead of pausing to download the CSS files, the exported Word document (and HTML document) will simply use `<link>` tags pointing to absolute URLs for the CSS.
- This will execute instantly upon clicking the button, bypassing the browser's download blocker entirely.

---

### Implementation Steps
1. **CSS**: Update `.d2h-code-side-line` in `style.css` to `padding-left: 4.5em !important; padding-right: 0.5rem !important;`.
2. **JS**: Refactor `btnExportWord` and `btnExportHTML` in `script.js` to remove `await fetch` and use synchronous absolute `<link>` references.
