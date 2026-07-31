# Noblesville Commitments Import - Action Plan

## Conversion Verification Complete ✓

Your JobPlanner export has been analyzed and converted to Alleato format. Here's the status:

### Import Status

| Metric | Result |
|--------|--------|
| **Total Commitments** | 18 ✓ |
| **Ready to Import** | 13/18 ✓ |
| **Blocked** | 5/18 ✗ |
| **Total Contract Value** | $1,589,771.34 |

### What's Blocking the Import

**4 vendors NOT found in Alleato directory:**

1. **Bul-Tec Roofing** — SC-5092-0008 ($25,120)
2. **Central Indiana Hardware, CO, Inc** — SC-5092-0011, SC-5092-0017 ($55,984)
3. **EURO Plastering** — SC-5092-0014 ($12,000)
4. **Steel Services, Inc** — SC-5092-0016 ($42,750)

**Total blocked amount: $135,854**

---

## 3-Step Action Plan

### STEP 1: Create Missing Companies (5 minutes)

Go to **Alleato → Directory → Companies → Add New**

Create entries for:

```
1. Bul-Tec Roofing
2. Central Indiana Hardware, CO, Inc
3. EURO Plastering
4. Steel Services, Inc
```

**After creating each, copy the UUID** (it appears in the URL bar or company detail page)

### STEP 2: Update Company Lookup Table (2 minutes)

Open: `jobplanner-to-alleato-converter.xlsx`

Go to: **Company Lookup** sheet

Paste the new Company UUIDs next to each vendor name:

| Vendor Name | Company UUID |
|------------|--------------|
| Bul-Tec Roofing | [UUID from Step 1] |
| Central Indiana Hardware, CO, Inc | [UUID from Step 1] |
| EURO Plastering | [UUID from Step 1] |
| Steel Services, Inc | [UUID from Step 1] |

**The 13 other vendors already have UUIDs (provided in the converter).**

### STEP 3: Generate Final Import File (3 minutes)

#### Option A: Use the Preview (FASTEST - Recommended)

1. Download: `noblesville-import-ready.xlsx`
   - This file has all your data pre-transformed
   - Ready to copy directly into Alleato template
   - Just needs company UUIDs updated for the 4 missing vendors

2. Once you have the 4 new Company UUIDs:
   - Find rows with missing IDs (highlighted in red)
   - Manually enter the new UUIDs
   - Save the file

3. Copy rows 3 onwards (all commitment data)

4. Paste into: `commitments-import-template.xlsx` → **Commitments** sheet

#### Option B: Use the Converter (More control)

1. Open: `jobplanner-to-alleato-converter.xlsx`

2. **Company Lookup** sheet:
   - Paste your JobPlanner CSV vendor names (already listed)
   - Update the UUID column with entries from Alleato Directory

3. **JobPlanner Data** sheet:
   - Paste your entire JobPlanner CSV export

4. **Alleato Import Ready** sheet:
   - Auto-transforms your data
   - Copy this sheet's data (rows 3+)

5. Paste into: `commitments-import-template.xlsx` → **Commitments** sheet

---

## Files You Have

| File | Purpose | Size |
|------|---------|------|
| **noblesville-import-ready.xlsx** | 🌟 Pre-transformed data (use this!) | Ready to go |
| **jobplanner-to-alleato-converter.xlsx** | Full converter template (for future imports) | Reusable |
| **commitments-import-template.xlsx** | Official Alleato import format | Target format |
| **jobplanner-to-alleato-mapping.md** | Field reference guide | Documentation |

---

## What Gets Imported

### Ready Now (13 commitments, $1.45M):

```
✓ SC-5092-0005: HVAC Air Distribution (C&S Heating & Cooling Inc.) — $325,730
✓ SC-5092-0012: Casework (Casework Concepts LLC) — $42,606
✓ SC-5092-0002: Framing, Drywall, Ceilings (Superior Contractors Inc.) — $356,501
✓ SC-5092-0009: Electrical (Deem, LLC) — $283,275
✓ SC-5092-0003: Plumbing (Justin Dorsey Plumbing) — $132,342
✓ SC-5092-0018: Final Clean (KLEENIT GROUP INC.) — $4,460
✓ SC-5092-0013: Painting (Inline Painting LLC) — $38,071
✓ SC-5092-0001: Ceiling Demo (Integrity Concrete Cutters) — $10,000
✓ SC-5092-0007: Security & Fire Alarm (Central Security & Communications) — $52,812
✓ SC-5092-0006: Fire Suppression (Vulcan Fire Protection Services, Inc.) — $29,845
✓ SC-5092-0015: CMU (Division 4 Masonry) — $36,250
✓ SC-5092-0004: Flooring (Market Ready Interiors Inc) — $77,300
✓ SC-5092-0010: Glass/Storefront (Apex Glass LLC) — $64,725
```

### Blocked Until Companies Created (5 commitments, $135K):

```
✗ SC-5092-0008: Roofing (Bul-Tec Roofing) — $25,120
✗ SC-5092-0017: Bathroom Accessories (Central Indiana Hardware, CO, Inc) — $19,384
✗ SC-5092-0011: Doors, Frames & Hardware (Central Indiana Hardware, CO, Inc) — $36,600
✗ SC-5092-0014: EIFS (EURO Plastering) — $12,000
✗ SC-5092-0016: RTU Reinforcement (Steel Services, Inc) — $42,750
```

---

## Data Transformations Applied

✓ **Amounts:** `$325,730.00` → `325730.00` ($ and commas removed)  
✓ **Status:** `Approved` → `approved` (lowercase)  
✓ **Type:** `Subcontract` → `subcontract` (lowercase)  
✓ **Titles:** Auto-fills from JobPlanner title or category  
✓ **Company IDs:** Maps vendor names to Alleato UUIDs  
✓ **Retainage:** Removes % symbol, keeps number  
✓ **All other fields:** Copied directly  

---

## Upload Instructions

Once you have the import file ready:

1. Go to **Commitments** page in Alleato
2. Click **⋯** (more actions) → **Import**
3. Select your file (either `noblesville-import-ready.xlsx` or final template)
4. Review the import summary
5. Confirm to import

---

## After Import

Once imported:

1. **Verify:** Open a few commitments to check amounts and dates
2. **Assign:** Assign team members if needed
3. **Add SOV Items:** If you have Schedule of Values line items, add them via:
   - Commitment detail → SOV tab → Add Items
   - Or use bulk import via SOV Items sheet

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Company ID not found on import" | Recheck the 4 missing vendors are created and UUIDs are entered correctly |
| "Invalid date format" | Dates should already be formatted; check the preview file |
| "Amount shows as text" | Amounts should be numbers; verify no extra formatting in preview file |
| "Import fails validation" | Download the preview file and verify all [NOT FOUND] entries are fixed |

---

## Timeline

- **Step 1 (Create Companies):** 5 minutes
- **Step 2 (Update UUIDs):** 2 minutes  
- **Step 3 (Generate Import):** 3 minutes
- **Step 4 (Upload):** 2 minutes

**Total: ~12 minutes to complete**

---

## Questions?

Refer to the documentation files:
- `COMMITMENTS_IMPORT_README.md` — Complete field reference
- `jobplanner-to-alleato-mapping.md` — Detailed mapping guide
- `noblesville-import-ready.xlsx` → Summary sheet — Overview of what's importing

---

**Ready to start?** → Create the 4 missing companies, then follow Step 2 & 3 above.

