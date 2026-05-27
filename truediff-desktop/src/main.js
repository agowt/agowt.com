// TrueDiff Pro Desktop - Core Application Logic
const isTauri = typeof window.__TAURI__ !== 'undefined';
let invoke = null;
let getCurrentWindow = null;

if (isTauri) {
    invoke = window.__TAURI__.core.invoke;
    getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
}

// Supabase API config
const SUPABASE_API_URL = 'https://dqfkkbylygkmkrslqlux.supabase.co';
const ACTIVATE_ENDPOINT = `${SUPABASE_API_URL}/functions/v1/activate-license`;

// Device tracking
let deviceUuid = localStorage.getItem('truediff-device-uuid');
if (!deviceUuid) {
    deviceUuid = crypto.randomUUID();
    localStorage.setItem('truediff-device-uuid', deviceUuid);
}

// License State Management
let isActivated = false;
let trialStartDate = null;
const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// DOM Elements
const licenseModal = document.getElementById('licenseModal');
const activationInputView = document.getElementById('activationInputView');
const activationSuccessView = document.getElementById('activationSuccessView');
const licenseEmailInput = document.getElementById('licenseEmail');
const licenseKeyInput = document.getElementById('licenseKey');
const licenseErrorMsg = document.getElementById('licenseErrorMsg');
const activateBtnIcon = document.getElementById('activateBtnIcon');
const activateBtnText = document.getElementById('activateBtnText');

const trialStatusBar = document.getElementById('trialStatusBar');
const trialDaysRemaining = document.getElementById('trialDaysRemaining');
const modalTrialStatus = document.getElementById('modalTrialStatus');
const modalTrialExpired = document.getElementById('modalTrialExpired');
const modalStatusText = document.getElementById('modalStatusText');

const btnStartTrial = document.getElementById('btnStartTrial');
const btnBuyLicense = document.getElementById('btnBuyLicense');
const btnActivateLicense = document.getElementById('btnActivateLicense');
const btnCancelActivation = document.getElementById('btnCancelActivation');
const btnActivateFromTrial = document.getElementById('btnActivateFromTrial');
const btnStartUsingApp = document.getElementById('btnStartUsingApp');

// Core Diff Checker Elements
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlEl = document.documentElement;

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
const btnShowLines = document.getElementById('btnShowLines');
const btnHideLines = document.getElementById('btnHideLines');
const inputGrid = document.querySelector('.input-grid');

const originalFileInput = document.getElementById('originalFileInput');
const modifiedFileInput = document.getElementById('modifiedFileInput');

const exportDropdownContainer = document.getElementById('exportDropdownContainer');
const btnExportMenu = document.getElementById('btnExportMenu');
const exportMenuContent = document.getElementById('exportMenuContent');
const btnExportHTML = document.getElementById('btnExportHTML');
const btnExportPDF = document.getElementById('btnExportPDF');
const btnExportWord = document.getElementById('btnExportWord');
const btnExportPatch = document.getElementById('btnExportPatch');

// Core UI State
const currentOutputFormat = 'side-by-side';
let isWrapped = true;
let isInputsHidden = false;
let isCodeFont = true;
let currentPatchData = '';

// ==========================================================
// 1. Frameless Window Titlebar Management
// ==========================================================
function initTitlebar() {
    if (!isTauri) return;
    
    const appWindow = getCurrentWindow();
    
    document.getElementById('titlebar-minimize').addEventListener('click', () => {
        appWindow.minimize();
    });
    
    document.getElementById('titlebar-maximize').addEventListener('click', () => {
        appWindow.isMaximized().then(max => {
            if (max) {
                appWindow.unmaximize();
            } else {
                appWindow.maximize();
            }
        });
    });
    
    document.getElementById('titlebar-close').addEventListener('click', () => {
        appWindow.close();
    });
}

// Helper to open links externally in system default browser
function openExternalLink(url) {
    if (isTauri && invoke) {
        invoke('open_browser', { url }).catch(e => console.error(e));
    } else {
        window.open(url, '_blank');
    }
}

// ==========================================================
// 2. Licensing & Local 7-Day Trial Systems
// ==========================================================
async function checkLicenseState() {
    // 1. Check if compiled as direct App Store version via Rust backend
    if (isTauri && invoke) {
        try {
            const isStore = await invoke('is_app_store_version');
            if (isStore) {
                isActivated = true;
                localStorage.setItem('truediff-pro-activated', 'true');
                updateUIForActivationState();
                return;
            }
        } catch (e) {
            console.error("Error invoking is_app_store_version:", e);
        }
    }

    // 2. Load activation and trial settings from local storage
    isActivated = localStorage.getItem('truediff-pro-activated') === 'true';
    const trialStartRaw = localStorage.getItem('truediff-pro-trial-start');
    trialStartDate = trialStartRaw ? parseFloat(trialStartRaw) : null;

    updateUIForActivationState();
}

function updateUIForActivationState() {
    if (isActivated) {
        // App Activated - Unlock everything, hide all restriction panels
        licenseModal.classList.add('hidden');
        trialStatusBar.classList.add('hidden');
        document.body.classList.remove('lock-viewport');
        return;
    }

    // App NOT Activated - Evaluate Trial State
    document.body.classList.add('lock-viewport');

    if (trialStartDate === null) {
        // Trial hasn't started yet - Lock screen completely
        licenseModal.classList.remove('hidden');
        activationInputView.classList.remove('hidden');
        activationSuccessView.classList.add('hidden');
        
        btnStartTrial.classList.remove('hidden');
        btnCancelActivation.classList.add('hidden');
        modalTrialStatus.classList.add('hidden');
        modalTrialExpired.classList.add('hidden');
        modalStatusText.classList.remove('hidden');
    } else {
        // Trial has started - check if active or expired
        const elapsed = Date.now() - trialStartDate;
        const isActive = elapsed < trialDuration;

        if (isActive) {
            // Trial active - App is fully functional, but display trial status headers
            licenseModal.classList.add('hidden'); // Modal is hidden by default in trial
            trialStatusBar.classList.remove('hidden');
            
            const remaining = Math.max(1, Math.ceil((trialDuration - elapsed) / (24 * 60 * 60 * 1000)));
            trialDaysRemaining.textContent = remaining;
            
            // If they open the activation modal manually:
            btnStartTrial.classList.add('hidden');
            btnCancelActivation.classList.remove('hidden');
            modalTrialStatus.classList.remove('hidden');
            modalTrialExpired.classList.add('hidden');
            modalStatusText.classList.add('hidden');
        } else {
            // Trial expired - Lock screen permanently until activated
            licenseModal.classList.remove('hidden');
            activationInputView.classList.remove('hidden');
            activationSuccessView.classList.add('hidden');
            trialStatusBar.classList.add('hidden');
            
            btnStartTrial.classList.add('hidden');
            btnCancelActivation.classList.add('hidden');
            modalTrialStatus.classList.add('hidden');
            modalTrialExpired.classList.remove('hidden');
            modalStatusText.classList.add('hidden');
        }
    }
}

// Start Trial Action
btnStartTrial.addEventListener('click', () => {
    trialStartDate = Date.now();
    localStorage.setItem('truediff-pro-trial-start', trialStartDate.toString());
    updateUIForActivationState();
});

// Cancel Activation Overlay (Only when trial is active)
btnCancelActivation.addEventListener('click', () => {
    if (trialStartDate !== null && (Date.now() - trialStartDate) < trialDuration) {
        licenseModal.classList.add('hidden');
    }
});

// Trigger Activation modal manually from the active trial bar
btnActivateFromTrial.addEventListener('click', () => {
    licenseModal.classList.remove('hidden');
    btnStartTrial.classList.add('hidden');
    btnCancelActivation.classList.remove('hidden');
    modalTrialStatus.classList.remove('hidden');
    modalTrialExpired.classList.add('hidden');
    modalStatusText.classList.add('hidden');
    licenseErrorMsg.classList.add('hidden');
});

// Buy License key trigger
btnBuyLicense.addEventListener('click', () => {
    openExternalLink('https://buy.stripe.com/14AbJ1aBA2FV5Cnc0s5gc00');
});

// Activate License Key via Supabase API
btnActivateLicense.addEventListener('click', async () => {
    const email = licenseEmailInput.value.trim();
    const licenseKey = licenseKeyInput.value.trim();

    if (!email || !licenseKey) {
        showError('Please fill in both Email and License Key.');
        return;
    }

    // Set loading UI states
    licenseErrorMsg.classList.add('hidden');
    btnActivateLicense.disabled = true;
    activateBtnIcon.className = 'ph ph-spinner spinner-icon';
    activateBtnIcon.style.animation = 'spin 1s linear infinite';
    activateBtnText.textContent = 'Verifying License...';

    try {
        const response = await fetch(ACTIVATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                licenseKey: licenseKey,
                deviceUuid: deviceUuid,
                deviceName: isTauri ? 'Mac Desktop App' : 'Web Browser Client'
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Activation Successful!
            isActivated = true;
            localStorage.setItem('truediff-pro-activated', 'true');
            activationInputView.classList.add('hidden');
            activationSuccessView.classList.remove('hidden');
        } else {
            showError(data.error || 'Invalid license key or email. Please verify your purchase and try again.');
        }
    } catch (error) {
        console.error('License validation failed:', error);
        showError('Verification request failed. Please check your internet connection and try again.');
    } finally {
        btnActivateLicense.disabled = false;
        activateBtnIcon.className = 'ph ph-lock-open';
        activateBtnIcon.style.animation = 'none';
        activateBtnText.textContent = 'Activate License';
    }
});

btnStartUsingApp.addEventListener('click', () => {
    checkLicenseState();
});

function showError(msg) {
    licenseErrorMsg.textContent = msg;
    licenseErrorMsg.classList.remove('hidden');
}

// ==========================================================
// 3. Drag and Drop Local Document Parsers
// ==========================================================
function initDragAndDrop() {
    const originalGroup = document.getElementById('originalGroup');
    const modifiedGroup = document.getElementById('modifiedGroup');
    
    setupDropZone(originalGroup, 'originalDragOverlay', originalText);
    setupDropZone(modifiedGroup, 'modifiedDragOverlay', modifiedText);
}

function setupDropZone(groupElement, overlayId, targetTextarea) {
    const overlay = document.getElementById(overlayId);

    groupElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.add('active');
    });

    groupElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('active');
    });

    groupElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('active');

        const file = e.dataTransfer.files[0];
        if (!file) return;

        await parseAndLoadFile(file, targetTextarea);
    });
}

// File system parses
async function parseAndLoadFile(file, targetTextarea) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    try {
        let text = '';
        if (ext === 'txt') {
            text = await file.text();
        } else if (ext === 'docx') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            text = result.value;
        } else if (ext === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                text += pageText + '\n';
            }
        } else {
            alert('Unsupported file type. Please load a .txt, .docx, or .pdf document.');
            return;
        }
        
        targetTextarea.value = text;
        
        // Auto trigger comparison if both inputs contain content
        if (originalText.value.trim() && modifiedText.value.trim()) {
            generateDiff();
        }
        
    } catch (error) {
        console.error('Error reading dropped file:', error);
        alert('Failed to read and extract text from the file.');
    }
}

// Handle file selector uploads
originalFileInput.addEventListener('change', (e) => parseAndLoadFile(e.target.files[0], originalText));
modifiedFileInput.addEventListener('change', (e) => parseAndLoadFile(e.target.files[0], modifiedText));

// ==========================================================
// 4. Core Diff checker & Theme logic
// ==========================================================
function initTheme() {
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
}

function updateThemeIcon(theme) {
    if (theme === 'dark') {
        themeIcon.className = 'ph ph-sun';
        if (diffOutput) diffOutput.classList.add('d2h-dark-color-scheme');
    } else {
        themeIcon.className = 'ph ph-moon';
        if (diffOutput) diffOutput.classList.remove('d2h-dark-color-scheme');
    }
}

// Clear buttons
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
        btnToggleInputs.innerHTML = '<i class="ph ph-arrows-out-line-vertical"></i> Show Inputs';
    } else {
        inputGrid.classList.remove('collapsed');
        btnToggleInputs.innerHTML = '<i class="ph ph-arrows-in-line-vertical"></i> Hide Inputs';
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

// Line Numbers Toggle
btnShowLines.addEventListener('click', () => {
    btnShowLines.classList.add('active');
    btnHideLines.classList.remove('active');
    resultsSection.classList.remove('hide-line-numbers');
});

btnHideLines.addEventListener('click', () => {
    btnHideLines.classList.add('active');
    btnShowLines.classList.remove('active');
    resultsSection.classList.add('hide-line-numbers');
});

// Export Dropdown
btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenuContent.classList.toggle('show');
});

document.addEventListener('click', () => {
    exportMenuContent.classList.remove('show');
});

// Native Print PDF with double-safe printing-active class
btnExportPDF.addEventListener('click', () => {
    document.body.classList.add('printing-active');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove('printing-active');
        }, 500);
    }, 50);
});

// Sync printing-active state via beforeprint and afterprint window events as fallback
window.addEventListener('beforeprint', () => {
    document.body.classList.add('printing-active');
});
window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-active');
});

// Export as HTML
btnExportHTML.addEventListener('click', () => {
    if (!currentPatchData) return;
    
    // Read style.css text directly so we can bundle it 100% inline for offline exports
    const inlineStyles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            } catch (e) {
                return ''; // Ignore CORS issues if any (all local so should be fine)
            }
        }).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <title>Privacy-First Diff Checker (Offline Export)</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
    <style>
        ${inlineStyles}
        body { padding: 2rem; overflow: auto; height: auto; }
        .app-container { margin-top: 0; padding: 0; }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="results-section ${isWrapped ? 'wrap-text' : ''} ${!isCodeFont ? 'font-sans' : ''}">
            <div class="diff-panel">
                ${diffOutput.innerHTML}
            </div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, 'truediff-export.html');
});

// Export as Word Doc
btnExportWord.addEventListener('click', () => {
    if (!currentPatchData) return;
    
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset='utf-8'>
        <title>TrueDiff Pro Export</title>
        <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
        <style>
            body { font-family: sans-serif; padding: 2rem; }
            .d2h-files-diff { border: 1px solid #ccc; width: 100%; }
        </style>
    </head>
    <body>
        <h2>TrueDiff Pro — Document Comparison Output</h2>
        <div class="results-section ${isWrapped ? 'wrap-text' : ''}">
            <div class="diff-panel">
                ${diffOutput.innerHTML}
            </div>
        </div>
    </body>
    </html>`;
    
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
    triggerDownload(blob, 'truediff-export.doc');
});

// Export Patch
btnExportPatch.addEventListener('click', () => {
    if (!currentPatchData) return;
    const blob = new Blob([currentPatchData], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, 'truediff-patch.diff');
});

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Core Diff Generator Engine
function generateDiff() {
    const text1 = originalText.value;
    const text2 = modifiedText.value;

    if (!text1.trim() && !text2.trim()) {
        resultsSection.classList.add('hidden');
        return;
    }

    resultsSection.classList.remove('hidden');
    if (isWrapped) resultsSection.classList.add('wrap-text');
    if (!isCodeFont) resultsSection.classList.add('font-sans');
    btnToggleInputs.style.display = 'inline-flex';
    diffOutput.innerHTML = `
        <div class="spinner-container">
            <div class="spinner"></div>
            <span>Calculating differences...</span>
        </div>
    `;

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
                { context: 10000 }
            );

            currentPatchData = patch;

            // 2. Render HTML using diff2html
            let diffHtml = Diff2Html.html(patch, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: currentOutputFormat,
                renderNothingWhenEmpty: false,
            });

            // Inject the clean comparison header
            diffHtml = diffHtml.replace(/(<div class="d2h-code-side-line">)(@@[^<]+)(<\/div>)/g, '$1$2 | --- Original +++ Modified$3');

            diffOutput.innerHTML = diffHtml;
            
            if (currentOutputFormat === 'side-by-side') {
                mergeDiffTables();
            }

            exportDropdownContainer.style.display = 'inline-block';

        } catch (err) {
            console.error("Diff Generation Error:", err);
            diffOutput.innerHTML = `<div style="color: var(--accent-red); padding: 2rem; text-align:center;">Failed to compute diff. Input text might be excessively large.</div>`;
        }
    }, 50);
}

// Side by Side Row Height Sync Merger (Design Change 2 + 4 Fusion)
function mergeDiffTables() {
    const wrappers = document.querySelectorAll('.d2h-files-diff');
    wrappers.forEach(wrapper => {
        const sideDiffs = wrapper.querySelectorAll('.d2h-file-side-diff');
        if (sideDiffs.length !== 2) return;

        const leftTableBody = sideDiffs[0].querySelector('tbody');
        const rightTableBody = sideDiffs[1].querySelector('tbody');
        if (!leftTableBody || !rightTableBody) return;

        const leftRows = Array.from(leftTableBody.querySelectorAll('tr'));
        const rightRows = Array.from(rightTableBody.querySelectorAll('tr'));
        const rowCount = Math.max(leftRows.length, rightRows.length);

        for (let i = 0; i < rowCount; i++) {
            const leftRow = leftRows[i];
            const rightRow = rightRows[i];
            if (leftRow && rightRow) {
                while (rightRow.firstChild) {
                    leftRow.appendChild(rightRow.firstChild);
                }
            }
        }
        
        sideDiffs[0].style.width = '100%';
        sideDiffs[0].style.overflowX = 'auto';
        sideDiffs[1].remove();
    });
}

// Compare button trigger
compareBtn.addEventListener('click', generateDiff);

// Initializer
window.addEventListener('DOMContentLoaded', () => {
    initTitlebar();
    initTheme();
    initDragAndDrop();
    checkLicenseState();
});
