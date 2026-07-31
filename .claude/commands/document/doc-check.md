You are about to create documentation. Before proceeding, you MUST:

1. **Read the documentation standards:**
   - Read `documentation/DOCUMENTATION-STANDARDS.md`
   - Read `documentation/DOCUMENTATION-QUICK-REFERENCE.md`

2. **Run the validation script:**
   - Execute: `node scripts/docs/validate-doc-structure.js`
   - This will check for existing violations

3. **Determine the correct location** for your documentation:
   - Use the "Where Do I Put This Doc?" table in DOCUMENTATION-QUICK-REFERENCE.md
   - Choose the appropriate subdirectory under `documentation/docs/[category]/`
   - **NEVER** place documentation files directly in `/documentation` root unless they are:
     - Meta-documentation (standards, index, guides)
     - Explicitly listed in ALLOWED_ROOT_FILES

4. **Choose the appropriate agent:**
   - Use the "Which Agent Should I Use?" table
   - Available agents: docs-architect, api-documenter, reference-builder, tutorial-engineer, mermaid-expert

5. **Before creating the documentation**, confirm:
   - [ ] You know exactly where the file will be created
   - [ ] You have chosen the correct agent
   - [ ] You have read the template for this documentation type
   - [ ] You understand this is NOT going in `/documentation` root (unless it's meta-documentation)

**CRITICAL RULE:**
Files like completion reports, summaries, cleanup reports, and plans go in:
- `documentation/docs/development/completion-reports/` (for completion work)
- `documentation/docs/plans/[category]/` (for implementation plans)

They do NOT go in `/documentation` root.

Now proceed with creating your documentation in the CORRECT location.
