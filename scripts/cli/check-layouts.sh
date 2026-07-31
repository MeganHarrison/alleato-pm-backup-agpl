#!/bin/bash

# Check which layouts are used in all pages

echo "=== LAYOUT AUDIT ==="
echo ""

echo "Pages using TableLayout:"
grep -r "TableLayout" frontend/src/app --include="page.tsx" | cut -d: -f1 | sort | uniq | wc -l

echo "Pages using FormLayout:"
grep -r "FormLayout" frontend/src/app --include="page.tsx" | cut -d: -f1 | sort | uniq | wc -l

echo "Pages using DashboardLayout:"
grep -r "DashboardLayout" frontend/src/app --include="page.tsx" | cut -d: -f1 | sort | uniq | wc -l

echo "Pages using ExecutiveLayout:"
grep -r "ExecutiveLayout" frontend/src/app --include="page.tsx" | cut -d: -f1 | sort | uniq | wc -l

echo "Pages using AppShell:"
grep -r "AppShell" frontend/src/app --include="page.tsx" | cut -d: -f1 | sort | uniq | wc -l

echo ""
echo "=== PAGES WITH NO LAYOUT ==="
echo ""

# Check pages that don't import any layout
for file in $(find frontend/src/app -name "page.tsx" -type f); do
    if ! grep -q "Layout\|AppShell" "$file" 2>/dev/null; then
        echo "$file"
    fi
done | head -20

echo ""
echo "=== FORM PAGES AUDIT ==="
echo ""

# Check all form pages
for file in frontend/src/app/\(forms\)/*/page.tsx; do
    if [ -f "$file" ]; then
        layout=$(grep -o "FormLayout\|TableLayout\|AppShell\|DashboardLayout" "$file" | head -1)
        echo "$(basename $(dirname $file)): ${layout:-NO LAYOUT}"
    fi
done

echo ""
echo "=== TABLE PAGES AUDIT (sample) ==="
echo ""

# Check table pages
for file in frontend/src/app/\(tables\)/*/page.tsx; do
    if [ -f "$file" ]; then
        layout=$(grep -o "FormLayout\|TableLayout\|AppShell\|DashboardLayout" "$file" | head -1)
        echo "$(basename $(dirname $file)): ${layout:-NO LAYOUT}"
    fi
done

echo ""
echo "=== PROJECT TOOL PAGES (sample) ==="
echo ""

# Check some project pages
for dir in budget change-events change-orders commitments contracts direct-costs; do
    file="frontend/src/app/[projectId]/$dir/page.tsx"
    if [ -f "$file" ]; then
        layout=$(grep -o "FormLayout\|TableLayout\|AppShell\|DashboardLayout" "$file" | head -1)
        echo "$dir: ${layout:-NO LAYOUT}"
    fi
done
