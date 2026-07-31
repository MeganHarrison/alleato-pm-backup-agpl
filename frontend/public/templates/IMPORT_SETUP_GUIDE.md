# Noblesville Commitments Import - Setup Guide

Your JobPlanner export is ready to import into Alleato. Here's how to get started:

## Files You Have

### 1. **commitments-import-template.xlsx** (8.9 KB)
   - The official Alleato import format
   - Use this as your final import file
   - Sheets: Instructions, Commitments, SOV Items, Reference Data

### 2. **jobplanner-to-alleato-converter.xlsx** (27 KB) ⭐ START HERE
   - Converts your JobPlanner data automatically
   - Transforms dates, removes currency symbols, matches company IDs
   - Sheets:
     - **Instructions**: How to use the converter
     - **Company Lookup**: Map vendor names to Alleato company UUIDs
     - **JobPlanner Data**: Paste your export here
     - **Transformation**: Auto-converts your data (formulas)
     - **Alleato Import Ready**: Copy-paste into commitments template

### 3. **jobplanner-to-alleato-mapping.md**
   - Detailed field-by-field mapping guide
   - Data transformation examples
   - Troubleshooting tips

### 4. **COMMITMENTS_IMPORT_README.md**
   - Complete Alleato import documentation
   - Field definitions and validation rules

## Quick Start: 3-Step Process

### Step 1: Open the Converter (5 minutes)
```
Open: jobplanner-to-alleato-converter.xlsx
```

Go to the **"Company Lookup"** sheet and create your mapping:

| Vendor Name | Company UUID |
|-------------|--------------|
| C&S Heating & Cooling Inc. | (UUID from Alleato) |
| Casework Concepts LLC | (UUID from Alleato) |
| Central Indiana Hardware, CO, Inc | (UUID from Alleato) |
| [etc. for all vendors] | |

**How to get Company UUIDs:**
1. Open Alleato → Directory → Companies
2. Click each vendor from your JobPlanner list
3. Copy the UUID from the URL or company details
4. Paste into the Company Lookup sheet

### Step 2: Paste Your Data (2 minutes)
```
Sheet: "JobPlanner Data"
```

1. Open your JobPlanner CSV export
2. Select all data (rows 1-end, columns A-X)
3. Copy it
4. Click the "JobPlanner Data" sheet tab
5. Click cell A1
6. Paste the data

The **Transformation** sheet will automatically convert everything.

### Step 3: Copy to Import Template (2 minutes)
```
Sheet: "Alleato Import Ready"
```

1. Select all data in this sheet (starting from row 3)
2. Copy it
3. Open `commitments-import-template.xlsx`
4. Click the "Commitments" sheet
5. Click cell A3 (first data row)
6. Paste the data
7. Save the file
8. Upload via Alleato's import feature

## What Gets Transformed Automatically

✓ **Numbers** - Copied directly: `SC-5092-0005` → `SC-5092-0005`  
✓ **Type** - Converted to lowercase: `Subcontract` → `subcontract`  
✓ **Title** - Uses JobPlanner title, or category if title is blank  
✓ **Status** - Converted to lowercase: `Approved` → `approved`  
✓ **Amount** - Removes $ and commas: `$325,730.00` → `325730.00`  
✓ **Retainage** - Copied directly: `10` → `10`  
✓ **Dates** - Converts format: `01/16/2026 02:38 PM` → `2026-01-16`  
✓ **Company ID** - VLOOKUP from your mapping table  
✓ **Description** - Copied from JobPlanner  
✓ **Inclusions** - Copied from JobPlanner  
✓ **Exclusions** - Copied from JobPlanner  

## Noblesville Project Status

**Project:** 25125 (Noblesville)  
**Commitments in your export:** 18 subcontracts  
**Total amount:** ~$1.4M  

Expected commitments after import:
- SC-5092-0001: Ceiling Demo ($10,000)
- SC-5092-0002: Framing, Drywall, Ceilings ($356,501)
- SC-5092-0003: Plumbing ($132,342)
- SC-5092-0004: Flooring ($77,300)
- SC-5092-0005: HVAC ($325,730)
- SC-5092-0006: Fire Suppression ($29,845)
- SC-5092-0007: Security & Fire Alarm ($52,812)
- SC-5092-0008: Roofing ($25,120)
- SC-5092-0009: Electrical ($283,275)
- SC-5092-0010: Glass/Storefront ($64,725)
- SC-5092-0011: Doors, Frames & Hardware ($36,600)
- SC-5092-0012: Casework ($42,606)
- SC-5092-0013: Painting ($38,071)
- SC-5092-0014: Bathroom Accessories ($19,384)
- SC-5092-0015: CMU ($36,250)
- SC-5092-0016: RTU Reinforcement ($42,750)
- SC-5092-0017: Bathroom Accessories ($19,384)
- SC-5092-0018: Final Clean ($4,460)

## Important Notes

⚠️ **Company IDs MUST exist in Alleato**
- If a vendor name doesn't match exactly, the lookup will show `[NOT FOUND]`
- Create missing companies in Alleato Directory first
- Then add them to the Company Lookup table

⚠️ **All dates must be valid**
- JobPlanner dates that are invalid will show as blank
- Check the "Alleato Import Ready" sheet for any blanks
- Fix in the JobPlanner Data sheet if needed

⚠️ **Verify before uploading**
- Open "Alleato Import Ready" sheet
- Scroll through and spot-check a few rows
- Look for any `[NOT FOUND]` in Company ID column
- Make sure all important dates are filled

## Common Issues

| Issue | Fix |
|-------|-----|
| "Company ID shows [NOT FOUND]" | Check exact spelling in Company Lookup sheet. Company must exist in Alleato. |
| "Date columns are blank" | JobPlanner date format may not be recognized. Manually enter YYYY-MM-DD format. |
| "Amount shows as text" | Remove any extra $ or formatting from JobPlanner source. |
| "Too many rows" | The template supports up to 100 commitments. For more, you'll need multiple batches. |

## After Import

Once imported into Alleato:

1. ✓ Verify all 18 commitments appear in the Commitments page
2. ✓ Spot-check a few records to confirm amounts and dates match
3. ✓ Add any missing Schedule of Values (SOV) line items
   - Use the `jobplanner-to-alleato-converter.xlsx` "SOV Items" sheet if needed
   - Or add them manually in Alleato's UI
4. ✓ Assign team members if needed
5. ✓ Mark as approved if ready

## Need Help?

**If a field doesn't look right:**
1. Check the mapping guide: `jobplanner-to-alleato-mapping.md`
2. Review the transformation formulas in the "Transformation" sheet
3. Verify your Company Lookup table is complete
4. Manually edit the "Alleato Import Ready" sheet if needed

**If import fails:**
1. Check the error message for which field caused the issue
2. Review the validation rules in `COMMITMENTS_IMPORT_README.md`
3. Correct the data in "Alleato Import Ready" sheet
4. Re-upload

## Files Location

All templates are in:
```
/frontend/public/templates/
```

Download from your project or access via the web app once the import feature is deployed.

---

**Ready to start?** → Open `jobplanner-to-alleato-converter.xlsx` and follow Step 1 above.
