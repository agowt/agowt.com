// Theme State Management
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlEl = document.documentElement;

// Initialize Theme
const savedTheme = localStorage.getItem('agowt-theme') || 'dark';
htmlEl.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('agowt-theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    if (theme === 'dark') {
        themeIcon.classList.replace('ph-moon', 'ph-sun');
    } else {
        themeIcon.classList.replace('ph-sun', 'ph-moon');
    }
}

// DOM Elements
const originalText = document.getElementById('originalText');
const modifiedText = document.getElementById('modifiedText');
const compareBtn = document.getElementById('compareBtn');
const resultsSection = document.getElementById('resultsSection');
const diffOutput = document.getElementById('diffOutput');
const clearBtns = document.querySelectorAll('.clear-btn');

const btnWrap = document.getElementById('btnWrap');
const btnNoWrap = document.getElementById('btnNoWrap');
const btnToggleInputs = document.getElementById('btnToggleInputs');
const btnCodeFont = document.getElementById('btnCodeFont');
const btnDocFont = document.getElementById('btnDocFont');
const inputGrid = document.querySelector('.input-grid');

const exportDropdownContainer = document.getElementById('exportDropdownContainer');
const btnExportMenu = document.getElementById('btnExportMenu');
const exportMenuContent = document.getElementById('exportMenuContent');
const btnExportHTML = document.getElementById('btnExportHTML');
const btnExportPDF = document.getElementById('btnExportPDF');
const btnExportWord = document.getElementById('btnExportWord');
const btnExportPatch = document.getElementById('btnExportPatch');

// State
const currentOutputFormat = 'side-by-side'; // Hardcoded to superior side-by-side view
let isWrapped = true;
let isInputsHidden = false;
let isCodeFont = true;
let currentPatchData = '';

// Event Listeners
compareBtn.addEventListener('click', generateDiff);

clearBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        document.getElementById(targetId).value = '';
    });
});

// Word Wrap Toggle
btnWrap.addEventListener('click', () => {
    isWrapped = true;
    btnWrap.classList.add('active');
    btnNoWrap.classList.remove('active');
    resultsSection.classList.add('wrap-text');
});

btnNoWrap.addEventListener('click', () => {
    isWrapped = false;
    btnNoWrap.classList.add('active');
    btnWrap.classList.remove('active');
    resultsSection.classList.remove('wrap-text');
});

// Hide Inputs Toggle
btnToggleInputs.addEventListener('click', () => {
    isInputsHidden = !isInputsHidden;
    if (isInputsHidden) {
        inputGrid.classList.add('collapsed');
        btnToggleInputs.innerHTML = '<i class="ph ph-arrows-out-line-vertical"></i> <span class="hide-mobile">Show Inputs</span>';
    } else {
        inputGrid.classList.remove('collapsed');
        btnToggleInputs.innerHTML = '<i class="ph ph-arrows-in-line-vertical"></i> <span class="hide-mobile">Hide Inputs</span>';
    }
});

// Font Toggle
btnCodeFont.addEventListener('click', () => {
    isCodeFont = true;
    btnCodeFont.classList.add('active');
    btnDocFont.classList.remove('active');
    resultsSection.classList.remove('font-sans');
});

btnDocFont.addEventListener('click', () => {
    isCodeFont = false;
    btnDocFont.classList.add('active');
    btnCodeFont.classList.remove('active');
    resultsSection.classList.add('font-sans');
});

// Export Menu Toggle
btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenuContent.classList.toggle('show');
});

document.addEventListener('click', () => {
    exportMenuContent.classList.remove('show');
});

// Export Handlers
btnExportPDF.addEventListener('click', () => window.print());

btnExportWord.addEventListener('click', () => {
    if (!currentPatchData) return;
    
    // Use absolute URLs for CSS to avoid async fetch blockers in Safari/iOS and allow Word to download styles
    const absoluteStyleUrl = new URL('style.css', window.location.href).href;
    const cssLinks = `
        <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
        <link rel="stylesheet" type="text/css" href="${absoluteStyleUrl}" />
    `;

    const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Privacy-First Diff Checker</title>" + cssLinks + "</head><body style='padding: 2rem;'>";
    const postHtml = "</body></html>";
    
    const bodyContent = `
        <div class="app-container" style="width: 100%; max-width: none;">
            <div class="results-section ${isWrapped ? 'wrap-text' : ''} ${!isCodeFont ? 'font-sans' : ''}" style="margin: 0; display: block;">
                <div class="diff-panel">
                    ${diffOutput.innerHTML}
                </div>
            </div>
        </div>
    `;

    const htmlContent = preHtml + bodyContent + postHtml;
    // The \ufeff is a BOM (Byte Order Mark) to ensure Word parses UTF-8 correctly
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
    triggerDownload(blob, 'agowt-diff.doc');
});

btnExportPatch.addEventListener('click', () => {
    if (!currentPatchData) return;
    const blob = new Blob([currentPatchData], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, 'agowt-diff.patch');
});

btnExportHTML.addEventListener('click', () => {
    if (!currentPatchData) return;
    
    const absoluteStyleUrl = new URL('style.css', window.location.href).href;
    const cssLinks = `
        <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
        <link rel="stylesheet" type="text/css" href="${absoluteStyleUrl}" />
    `;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Privacy-First Diff Checker (Offline Export)</title>
    ${cssLinks}
</head>
<body style="padding: 2rem;">
    <div class="app-container" style="width: 100%; max-width: none;">
        <div class="results-section ${isWrapped ? 'wrap-text' : ''} ${!isCodeFont ? 'font-sans' : ''}" style="margin: 0; display: block;">
            <div class="diff-panel">
                ${diffOutput.innerHTML}
            </div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, 'agowt-diff.html');
});

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function generateDiff() {
    const text1 = originalText.value;
    const text2 = modifiedText.value;

    // Don't render if both are empty
    if (!text1.trim() && !text2.trim()) {
        resultsSection.classList.add('hidden');
        return;
    }

    resultsSection.classList.remove('hidden');
    if (isWrapped) resultsSection.classList.add('wrap-text');
    if (!isCodeFont) resultsSection.classList.add('font-sans');
    btnToggleInputs.style.display = 'inline-flex';
    diffOutput.innerHTML = '<div style="text-align:center; padding: 2rem;"><div class="spinner"></div></div>';

    // Small timeout to allow UI to show loading state before heavy computation
    setTimeout(() => {
        try {
            // 1. Generate Git Patch using jsdiff
            const patch = Diff.createTwoFilesPatch(
                'Original', 
                'Modified', 
                text1, 
                text2,
                '',
                '',
                { context: 10000 } // Keep context high to show entire file if needed
            );

            // Store patch for export
            currentPatchData = patch;

            // 2. Render HTML using diff2html
            let diffHtml = Diff2Html.html(patch, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: currentOutputFormat,
                renderNothingWhenEmpty: false,
            });

            // Inject the '--- Original +++ Modified' header directly into the hunk line (@@ -1,44 +1,44 @@)
            diffHtml = diffHtml.replace(/(<div class="d2h-code-side-line">)(@@[^<]+)(<\/div>)/g, '$1$2 | --- Original +++ Modified$3');

            diffOutput.innerHTML = diffHtml;
            exportDropdownContainer.style.display = 'inline-block';

        } catch (err) {
            console.error("Diff Generation Error:", err);
            diffOutput.innerHTML = `<div style="color: var(--danger); padding: 2rem; text-align:center;">Failed to generate diff. Text might be too large.</div>`;
        }
    }, 50);
}

// Add a spinner class dynamically
const style = document.createElement('style');
style.innerHTML = `
.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);
