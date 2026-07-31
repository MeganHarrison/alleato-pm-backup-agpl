# Commitments Import Template

This template allows you to bulk import commitments (subcontracts and purchase orders) into Alleato PM.

## Files Included

- **commitments-import-template.xlsx** - Multi-sheet Excel workbook with instructions, templates, and reference data

## Template Structure

### Sheet 1: Instructions
- Overview of the import process
- Field definitions and requirements
- Step-by-step instructions
- Data format guidelines

### Sheet 2: Commitments
Contains all available commitment fields:

#### Required Fields (*)
- **Number** - Unique commitment identifier (e.g., SC-001, PO-2024-001)
- **Type** - Must be `subcontract` or `purchase_order`
- **Title** - Name/title of the commitment
- **Status** - One of: draft, sent, pending, approved, executed, closed, void
- **Company ID** - UUID of the vendor/contractor (must exist in your project)
- **Original Amount** - Initial contract amount (number only, no currency symbol)
- **Accounting Method** - Must be `amount`, `unit`, or `percent`

#### Optional Fields
- **Description** - Detailed description of the scope
- **Retention Percentage** - Default retainage percentage (0-100)
- **Start Date** - When work begins (YYYY-MM-DD)
- **Est. Completion Date** - Estimated completion (YYYY-MM-DD)
- **Contract Date** - When contract was executed (YYYY-MM-DD)
- **Signed Date** - When contract was signed (YYYY-MM-DD)
- **Actual Completion Date** - When work was completed (YYYY-MM-DD)
- **Issued On Date** - (YYYY-MM-DD)
- **Vendor Invoice Number** - Reference number from vendor
- **Assignee ID** - UUID of team member to assign (optional)
- **Is Private** - Set to `true` to restrict visibility
- **Inclusions** - Scope items included in commitment
- **Exclusions** - Scope items excluded from commitment
- **Non-Admin SOV Visible** - Set to `true` to allow non-admins to view SOV items
- **Executed** - Set to `true` if commitment is executed

### Sheet 3: SOV Items
For adding Schedule of Values line items:

#### Required Fields (*)
- **Commitment Number** - Must match a commitment in the Commitments sheet
- **Line Number** - Sequential number (1, 2, 3, etc.)
- **Description** - Item/line description
- **Amount** - Amount for this line item

#### Optional Fields
- **Budget Code** - Cost code identifier
- **Unit of Measure** - UOM for unit-based accounting (ft, hr, etc.)
- **Quantity** - Quantity for unit-based calculations
- **Unit Cost** - Price per unit
- **Billed to Date** - Amount already invoiced

### Sheet 4: Reference Data
Valid values for dropdowns:
- Status options
- Accounting methods
- Commitment types
- Boolean values

## Data Format Guidelines

### Dates
- Format: `YYYY-MM-DD`
- Examples: `2024-06-15`, `2024-12-31`
- Leave blank if not applicable

### Currency Amounts
- Numbers only, no currency symbols
- Examples: `150000`, `45000.50`
- Decimals allowed for cents

### UUIDs (Company ID, Assignee ID)
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Must be valid UUIDs of existing records
- Company IDs must match vendors/contractors in your project directory

### Text Fields (Inclusions, Exclusions)
- Use line breaks or bullet points to separate items
- Example for inclusions:
  ```
  Conduit installation
  Panel installation
  Wire pulling
  ```

### Boolean Fields
- Use `true` or `false` (lowercase)
- Do not use: yes/no, 1/0, TRUE/FALSE

## Getting Company IDs

To find Company IDs for existing vendors:

1. Go to **Directory** → **Companies**
2. Click on the vendor/contractor company
3. Copy the UUID from the URL or company details
4. Paste into the "Company ID" column

## Example Row

```
SC-001 | subcontract | Electrical Subcontract | executed | 550e8400-e29b-41d4-a716-446655440000 | 150000 | amount | Complete electrical work | 10 | 2024-06-01 | 2024-09-15 | 2024-06-01 | 2024-06-02 | 2024-09-15 | | V-12345 | | false | Conduit, Panel | Testing | true | true
```

## How to Use

1. **Download** the template from Alleato
2. **Fill in** the Commitments sheet with your commitment data
3. **Add SOV items** in the SOV Items sheet (optional)
4. **Validate** all required fields are completed
5. **Check** dates are in correct format (YYYY-MM-DD)
6. **Verify** status, type, and accounting method values match Reference Data sheet
7. **Upload** using the Import button in Commitments
8. **Review** the import summary for any errors

## Validation Rules

✓ All required fields (*) must be filled
✓ Numbers must be positive
✓ Dates must be in YYYY-MM-DD format
✓ Company IDs must be valid UUIDs of existing companies
✓ Status must be one of the valid values
✓ Type must be subcontract or purchase_order
✓ Accounting Method must be amount, unit, or percent
✓ Retention Percentage must be 0-100
✓ Boolean fields must be true or false

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid Company ID" | Company doesn't exist | Verify the UUID in Directory → Companies |
| "Invalid status value" | Wrong status entered | Use: draft, sent, pending, approved, executed, closed, or void |
| "Invalid date format" | Date not YYYY-MM-DD | Change to format: 2024-06-15 |
| "Missing required field" | Required field left blank | Check all fields marked with * are filled |
| "Amount must be positive" | Negative or zero amount | Use positive numbers only |
| "Commitment not found" | SOV item references non-existent commitment | Ensure Commitment Number exists in Commitments sheet |

## Tips for Large Imports

- Start with a small batch (5-10 commitments) to verify the process works
- Review the import results carefully before proceeding with full dataset
- Keep a backup of your original file
- Consider importing in phases if you have many commitments with SOV items
- Use the actual company names as a column to cross-reference UUIDs more easily

## Support

If you encounter issues during import:
1. Check the Reference Data sheet for valid values
2. Verify all required fields are completed
3. Review the error message for specific field issues
4. Check that all dates follow YYYY-MM-DD format
5. Ensure Company IDs are valid UUIDs of existing companies in your project
