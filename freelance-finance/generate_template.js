const ExcelJS = require('exceljs');
const path = require('path');

async function createTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TØMASS LIMITED';
    workbook.created = new Date();

    // --- 1. Setup Tab ---
    const setupSheet = workbook.addWorksheet('Setup');
    setupSheet.columns = [
        { header: 'Configuration', key: 'config', width: 25 },
        { header: 'Value', key: 'value', width: 30 }
    ];
    setupSheet.getRow(1).font = { bold: true };
    
    setupSheet.addRow(['Business Name', 'My Awesome Studio']);
    setupSheet.addRow(['Tax Year', '2026']);
    setupSheet.addRow(['Base Currency', 'USD']);
    
    // Add some empty rows
    setupSheet.addRow([]);
    setupSheet.addRow(['Expense Categories', '']);
    setupSheet.getRow(6).font = { bold: true };
    
    const categories = [
        'Office & Working From Home',
        'Travel & Mileage',
        'Subscriptions & Professional Fees',
        'Asset Depreciation',
        'Marketing & Advertising',
        'Other Operations'
    ];
    
    categories.forEach(cat => setupSheet.addRow([cat]));

    // --- 2. Income Tracker ---
    const incomeSheet = workbook.addWorksheet('Income Tracker');
    incomeSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Client', key: 'client', width: 25 },
        { header: 'Invoice #', key: 'invoice', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
    ];
    incomeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    incomeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    // Dummy Data
    incomeSheet.addRow([new Date('2026-01-15'), 'Acme Corp', 'INV-001', 1500, 'Paid']);
    incomeSheet.addRow([new Date('2026-02-10'), 'Globex Inc', 'INV-002', 3200, 'Paid']);
    incomeSheet.addRow([new Date('2026-03-05'), 'Initech', 'INV-003', 850, 'Pending']);
    
    // Format Amount column as currency
    incomeSheet.getColumn('D').numFmt = '"$"#,##0.00';

    // Data Validation & Conditional Formatting for Status
    for (let i = 2; i <= 100; i++) {
        incomeSheet.getCell(`E${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Paid,Pending,Cancelled"']
        };
    }
    
    incomeSheet.addConditionalFormatting({
        ref: 'E2:E100',
        rules: [
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'Paid',
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE6F4EA' } }, font: { color: { argb: 'FF137333' } } }
            },
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'Pending',
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF7E0' } }, font: { color: { argb: 'FFB06000' } } }
            }
        ]
    });


    // --- 3. Expense Log ---
    const expenseSheet = workbook.addWorksheet('Expense Log');
    expenseSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Vendor', key: 'vendor', width: 25 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Category', key: 'category', width: 35 },
        { header: 'Receipt Link', key: 'receipt', width: 30 }
    ];
    expenseSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    expenseSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };

    // Dummy Data
    expenseSheet.addRow([new Date('2026-01-16'), 'Adobe', 54.99, 'Subscriptions & Professional Fees', 'link']);
    expenseSheet.addRow([new Date('2026-02-12'), 'WeWork', 450.00, 'Office & Working From Home', 'link']);
    expenseSheet.addRow([new Date('2026-03-01'), 'Google Ads', 120.50, 'Marketing & Advertising', 'link']);
    
    // Format Amount
    expenseSheet.getColumn('C').numFmt = '"$"#,##0.00';

    // Data Validation for Categories (Linking to Setup sheet doesn't always port to Sheets cleanly, so we hardcode the list here for compatibility)
    const catList = `"${categories.join(',')}"`;
    for (let i = 2; i <= 100; i++) {
        expenseSheet.getCell(`D${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [catList]
        };
    }

    // --- 4. Dashboard ---
    const dashSheet = workbook.addWorksheet('Dashboard');
    dashSheet.getColumn('A').width = 25;
    dashSheet.getColumn('B').width = 20;
    
    dashSheet.mergeCells('A1:B1');
    dashSheet.getCell('A1').value = 'Freelancer Financial Dashboard';
    dashSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    dashSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
    dashSheet.getCell('A1').alignment = { horizontal: 'center' };

    dashSheet.addRow([]);

    dashSheet.getCell('A3').value = 'Total Revenue (Paid)';
    dashSheet.getCell('A3').font = { bold: true };
    // SUMIFS('Income Tracker'!D:D, 'Income Tracker'!E:E, "Paid")
    dashSheet.getCell('B3').value = { formula: 'SUMIFS(\'Income Tracker\'!D:D, \'Income Tracker\'!E:E, "Paid")', result: 4700 };
    dashSheet.getCell('B3').numFmt = '"$"#,##0.00';

    dashSheet.getCell('A4').value = 'Total Pending Invoices';
    dashSheet.getCell('A4').font = { bold: true };
    dashSheet.getCell('B4').value = { formula: 'SUMIFS(\'Income Tracker\'!D:D, \'Income Tracker\'!E:E, "Pending")', result: 850 };
    dashSheet.getCell('B4').numFmt = '"$"#,##0.00';

    dashSheet.getCell('A5').value = 'Total Deductible Expenses';
    dashSheet.getCell('A5').font = { bold: true };
    dashSheet.getCell('B5').value = { formula: 'SUM(\'Expense Log\'!C:C)', result: 625.49 };
    dashSheet.getCell('B5').numFmt = '"$"#,##0.00';

    dashSheet.addRow([]);

    dashSheet.getCell('A7').value = 'NET PROFIT';
    dashSheet.getCell('A7').font = { size: 14, bold: true };
    dashSheet.getCell('B7').value = { formula: 'B3 - B5', result: 4074.51 };
    dashSheet.getCell('B7').font = { size: 14, bold: true };
    dashSheet.getCell('B7').numFmt = '"$"#,##0.00';

    // Conditional formatting for Net Profit
    dashSheet.addConditionalFormatting({
        ref: 'B7:B7',
        rules: [
            {
                type: 'cellIs',
                operator: 'greaterThan',
                formulae: ['0'],
                style: { font: { color: { argb: 'FF137333' } } }
            },
            {
                type: 'cellIs',
                operator: 'lessThan',
                formulae: ['0'],
                style: { font: { color: { argb: 'FFC5221F' } } }
            }
        ]
    });

    // Save to file
    const exportPath = path.join(__dirname, 'templates', 'Freelance-Financial-Command-Center.xlsx');
    await workbook.xlsx.writeFile(exportPath);
    console.log('Successfully generated:', exportPath);
}

createTemplate().catch(console.error);
