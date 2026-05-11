# Implementation Plan: Privacy-First Diff Checker (`agowt.com/diff/`)

## Goal Description
Build the second utility website: a premium, privacy-first text and code comparison tool. It will highlight the differences between two blocks of text locally in the browser, ensuring sensitive code or documents never leave the user's device.

## Proposed Features
1.  **Dual Input Panels:** Clear, syntax-friendly textareas for "Original Text" and "Modified Text".
2.  **100% Client-Side Diffing:** Utilizing the industry-standard `diff` and `diff2html` libraries via CDN to compute and render the diff entirely in the browser.
3.  **Multiple Views:** Ability to toggle between "Side-by-Side" (split view) and "Line-by-Line" (unified view) comparisons.
4.  **GitHub-Style Rendering:** Beautiful, color-coded line highlights (green for additions, red for deletions) with line numbers, mirroring the familiar GitHub UI.
5.  **Premium Aesthetics:** Consistent with the `compress` tool, it will feature the `agowt.com` signature Glassmorphism UI, dark mode, and vibrant gradients.
6.  **Code Protection:** The core logic (`script.js`) will be obfuscated to `script.min.js` to protect the intellectual property.

## Technical Approach & File Structure
We will create a new directory inside the project: `/agowt.com/diff/`.

### [NEW] `/agowt.com/diff/index.html`
*   Semantic HTML5 structure with SEO meta tags.
*   CDN links for `diff` (jsdiff), `diff2html` (CSS & JS), and Phosphor Icons.
*   UI structure: Header, Input Section (Two textareas), Action Bar (Compare Button & View Toggles), and Results Container.

### [NEW] `/agowt.com/diff/style.css`
*   Vanilla CSS sharing the design language of the Image Optimizer (CSS variables, glassmorphism, dark theme).
*   Custom overrides for the `diff2html` default styles to make the diff output look seamless and premium within our dark mode theme.

### [NEW] `/agowt.com/diff/script.js`
*   Event listeners for the "Compare" button and view toggles.
*   Logic to extract text, generate the diff string, and pass it to `diff2html` for DOM rendering.
