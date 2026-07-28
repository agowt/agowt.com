# Dashboard Logic & Technical Specification

This document outlines the core Google Sheets logic, formulas, and conditional formatting rules required to build the automated features of the Freelancer’s Financial Command Center.

## 1. Data Structure Overview
The template relies on Named Ranges to keep formulas clean, readable, and robust against structural changes.

**Named Ranges to Define:**
- `Income_Date` = 'Income Tracker'!A:A
- `Income_Amount` = 'Income Tracker'!D:D
- `Income_Status` = 'Income Tracker'!E:E
- `Expense_Date` = 'Expense Log'!A:A
- `Expense_Amount` = 'Expense Log'!C:C
- `Expense_Category` = 'Expense Log'!D:D
- `Setup_Tax_Year` = 'Setup'!B2

## 2. Dashboard Automated Summaries

### Total Revenue (Paid Only)
Calculates the sum of all income where the status is marked as "Paid".
```excel
=SUMIFS(Income_Amount, Income_Status, "Paid")
```

### Total Pending Invoices
Calculates the sum of all income where the status is marked as "Pending".
```excel
=SUMIFS(Income_Amount, Income_Status, "Pending")
```

### Total Deductible Expenses
Calculates the total of all logged expenses.
```excel
=SUM(Expense_Amount)
```

### Net Profit
Subtracts total expenses from total paid revenue.
```excel
=SUMIFS(Income_Amount, Income_Status, "Paid") - SUM(Expense_Amount)
```

## 3. Advanced Insights (Using QUERY)

### Revenue by Client
Aggregates total revenue grouped by the Client name.
```excel
=QUERY('Income Tracker'!A:E, "SELECT B, SUM(D) WHERE E = 'Paid' GROUP BY B LABEL SUM(D) 'Total Paid'", 1)
```

### Expenses by Category
Provides a breakdown of spending by IRS/HMRC category.
```excel
=QUERY('Expense Log'!A:E, "SELECT D, SUM(C) WHERE C IS NOT NULL GROUP BY D LABEL SUM(C) 'Total Spent'", 1)
```

### Monthly Income & Expense Trend
Groups financial activity by Month for chart visualization.
```excel
=QUERY('Income Tracker'!A:E, "SELECT MONTH(A), SUM(D) WHERE A IS NOT NULL GROUP BY MONTH(A) LABEL MONTH(A) 'Month', SUM(D) 'Revenue'", 1)
```

## 4. Conditional Formatting Rules

To make the system feel "premium" and highly legible, apply the following conditional formatting rules:

### Income Tracker: Invoice Status
- **Range:** `E2:E`
- **Rule 1 (Paid):** Format cells if text is exactly "Paid". 
  - *Style:* Background Green (`#E6F4EA`), Text Dark Green (`#137333`).
- **Rule 2 (Pending):** Format cells if text is exactly "Pending". 
  - *Style:* Background Yellow (`#FEF7E0`), Text Dark Yellow/Brown (`#B06000`).
- **Rule 3 (Overdue):** Custom formula to flag unpaid invoices past 30 days.
  - *Formula:* `=AND(E2="Pending", A2<(TODAY()-30))`
  - *Style:* Background Red (`#FCE8E6`), Text Dark Red (`#C5221F`).

### Dashboard: Net Profit Indicator
- **Range:** Net Profit Cell (e.g., `B5`)
- **Rule (Positive):** Format cells if greater than or equal to 0.
  - *Style:* Text Green (`#137333`), Bold.
- **Rule (Negative):** Format cells if less than 0.
  - *Style:* Text Red (`#C5221F`), Bold.

## 5. Data Validation (Dropdowns)
- **Expense Log Categories:** Link the dropdowns in the 'Expense Log' to the categories defined in the 'Setup' tab to ensure consistent data entry.
- **Income Tracker Status:** Hardcode dropdown options for `Paid`, `Pending`, and `Cancelled`.
