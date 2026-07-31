# JobPlanner to Alleato Commitments - Import Mapping Guide

This guide shows how to map your JobPlanner commitment export to Alleato's import format.

## JobPlanner Export Structure

Your JobPlanner CSV has these columns:

| Col | JobPlanner Field | Alleato Field | Notes |
|-----|------------------|---------------|-------|
| 1 | Number | Number | ✓ Direct mapping |
| 2 | Type | Type | ✓ Direct mapping (Subcontract / Purchase Order) |
| 3 | Contracted Company | Company ID | ⚠️ Need to look up UUID |
| 4 | Title | Title | ✓ Direct mapping |
| 5 | Cost Code (unnamed) | Budget Code (SOV) | → Goes to SOV Items sheet |
| 6 | Category (unnamed) | Description | Optional - use for categorization |
| 7 | Amount | Original Amount | ✓ Remove $ and commas |
| 8 | Retainage | Retention Percentage | ✓ Direct mapping (already %) |
| 9 | Contract Date | Contract Date | ✓ Convert to YYYY-MM-DD |
| 10 | Status | Status | ✓ Direct mapping |
| 11 | Created | (timestamp only) | Use for reference |
| 12 | Description | Description | ✓ Direct mapping |
| 13 | Delivery | Est. Completion Date | For POs - convert to YYYY-MM-DD |
| 14 | Start | Start Date | ✓ Convert to YYYY-MM-DD |
| 15 | Inclusions | Inclusions | ✓ Direct mapping |
| 16 | Exclusions | Exclusions | ✓ Direct mapping |
| 17 | Est. Complete | Est. Completion Date | ✓ Convert to YYYY-MM-DD |
| 18 | Act. Complete | Actual Completion Date | ✓ Convert to YYYY-MM-DD |
| 19 | Signed Date | Signed Date | ✓ Convert to YYYY-MM-DD |
| 20 | Execution Date | Contract Date | (if Contract Date is empty, use this) |
| 21 | Issued On | Issued On Date | ✓ Convert to YYYY-MM-DD |
| 22 | Returned On | (not used in Alleato) | - |
| 23 | Payment Terms | (not used in Alleato) | - |
| 24 | Shipping Info | (not used in Alleato) | - |

## Step-by-Step Mapping Process

### Step 1: Prepare Company ID Lookup Table

Before importing, you need to map vendor names to Company IDs:

1. Go to **Directory** → **Companies** in Alleato
2. Find each vendor from your JobPlanner export
3. Copy their UUID from the company detail page
4. Create a lookup table:

```
C&S Heating & Cooling Inc. → 550e8400-e29b-41d4-a716-446655440000
Casework Concepts LLC → 550e8400-e29b-41d4-a716-446655440001
Central Indiana Hardware, CO, Inc → 550e8400-e29b-41d4-a716-446655440002
[etc.]
```

### Step 2: Clean Up Amount Fields

JobPlanner Format: `$325,730.00`
Alleato Format: `325730.00`

- Remove `$` symbol
- Remove commas
- Keep decimals

**Example transformations:**
- `$325,730.00` → `325730.00`
- `$42,606.00` → `42606.00`
- `$283,275.00` → `283275.00`

### Step 3: Convert Dates

JobPlanner Format: `01/16/2026 02:38 PM` or similar
Alleato Format: `2026-01-16` (YYYY-MM-DD, date only)

**Process:**
1. Extract just the date part: `01/16/2026`
2. Reformat to: `2026-01-16`
3. Ignore the time portion

### Step 4: Map Status Values

JobPlanner Status → Alleato Status:
- `Approved` → `approved`
- Check JobPlanner for other status values and map accordingly

Valid Alleato statuses: `draft`, `sent`, `pending`, `approved`, `executed`, `closed`, `void`

### Step 5: Handle Optional Columns

**Title:**
- JobPlanner row 4 may be blank
- If blank, use the Category (column 6) as the title
- Example: SC-5092-0005 has no title, so use "HVAC Air Distribution"

**Dates:**
- If "Contract Date" (col 9) is blank, use "Execution Date" (col 20)
- If "Est. Complete" (col 17) is blank, use "Delivery" (col 13)

**Retainage:**
- Column 8 appears to already be a percentage (e.g., "10" for 10%)
- Keep as-is

### Step 6: Create the Alleato Import File

Using the template `commitments-import-template.xlsx`:

**Commitments Sheet:**

| Number | Type | Title | Status | Company ID | Original Amount | Accounting Method | Description | Retention Percentage | Start Date | Est. Completion Date | Contract Date | Signed Date | Actual Completion Date | Issued On Date | Inclusions | Exclusions |
|--------|------|-------|--------|-----------|-----------------|-------------------|-------------|----------------------|------------|--------------------|--------------|-----------|-----------------------|---------------|-----------|----------|
| SC-5092-0005 | subcontract | HVAC Air Distribution | approved | 550e8400-... | 325730.00 | amount | | 10 | | | | | | | Includes all labor... | |
| SC-5092-0012 | subcontract | Casework | approved | 550e8400-... | 42606.00 | amount | | 10 | | | | | | | Includes providing... | |

## Data Quality Checks

Before importing, verify:

✓ All Numbers are unique  
✓ All Types are: `subcontract` or `purchase_order` (lowercase)  
✓ All Company IDs are valid UUIDs that exist in Alleato  
✓ All Amounts are positive numbers without currency symbols  
✓ All Dates are in YYYY-MM-DD format  
✓ All Status values are valid  
✓ All Retention Percentages are 0-100  

## Example Transformation

**JobPlanner Row:**
```
SC-5092-0008 | Subcontract | Bul-Tec Roofing | Roofing | 075300 | EPDM Roofing | $25,120.00 | 10 | 01/21/2026 03:15 PM | Approved | ...
```

**Alleato Import Row:**
```
Number: SC-5092-0008
Type: subcontract
Title: Roofing
Contracted Company (lookup): Bul-Tec Roofing → [UUID]
Status: approved
Original Amount: 25120.00
Retention Percentage: 10
Contract Date: 2026-01-21
Inclusions: [from JobPlanner column 15]
Exclusions: [from JobPlanner column 16]
[... other fields ...]
```

## Automation Tips

If you're processing many commitments:

1. **Use Excel formulas** to transform columns:
   - `=SUBSTITUTE(SUBSTITUTE(A1,"$",""),",","")` - Remove $ and commas
   - `=DATE(YEAR(A1),MONTH(A1),DAY(A1))` - Extract date
   - `=TEXT(A1,"YYYY-MM-DD")` - Format date correctly

2. **Use Find & Replace** to clean up:
   - Find: `$` | Replace: (empty)
   - Find: `,` | Replace: (empty)

3. **Create a VLOOKUP table** for Company IDs:
   - Left column: Vendor names from JobPlanner
   - Right column: Company UUIDs from Alleato
   - Use in mapping sheet: `=VLOOKUP(C2,CompanyLookup,2,FALSE)`

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Company not found" | Vendor name doesn't exist in Alleato. Check spelling and create company if needed. |
| "Invalid date format" | Use YYYY-MM-DD format. Check Excel date formatting. |
| "Amount with $ or commas" | Remove currency symbols and thousand separators. |
| "Status not recognized" | Use lowercase status values only. |
| "Retention > 100%" | Check the JobPlanner value - may need adjustment. |

## Next Steps

1. ✓ Review your JobPlanner export
2. ✓ Create Company ID lookup table
3. ✓ Download the Alleato import template
4. ✓ Map your data using this guide
5. ✓ Verify all data is clean
6. ✓ Upload via the Commitments Import feature
7. ✓ Review the import summary for errors

## Need Help?

If a commitment row fails to import:
- Check the error message for which field caused the issue
- Verify that field against the validation rules in this guide
- Correct the data and re-upload

For complex transformations, consider using a spreadsheet tool like LibreOffice Calc or Excel with formulas to automate the mapping.
