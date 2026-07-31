/**
 * extract-manifest.js
 * DOM extraction function that runs inside page.evaluate().
 *
 * CRITICAL: ALL helper functions MUST be nested inside extractPageData.
 * page.evaluate() serializes only this function body to the browser.
 */

export function extractPageData(state) {

  // ── AG GRID COLUMN GROUPS ─────────────────────────────────────────────────

  function extractAgGridColumns(agRoot) {
    var groups = [];

    // Procore uses: .ag-header-row-column-group (NO double dash)
    // AG Grid can also use: .ag-header-row--column-group (WITH double dash)
    var groupRows = agRoot.querySelectorAll(
      '.ag-header-row-column-group, .ag-header-row--column-group, .ag-header-row--column-groups'
    );

    // Collect group cells from ALL group rows (Procore uses multiple viewports:
    // frozen left, center scrollable, frozen right — each with its own header rows)
    var allGroupCells = [];
    var allLeafCells = [];

    groupRows.forEach(function(row) {
      var cells = row.querySelectorAll('.ag-header-group-cell');
      cells.forEach(function(c) { allGroupCells.push(c); });
    });

    // Leaf column rows
    var leafRows = agRoot.querySelectorAll(
      '.ag-header-row-column:not(.ag-header-row-column-group), .ag-header-row--column, .ag-header-row--columns'
    );
    leafRows.forEach(function(row) {
      var cells = row.querySelectorAll('.ag-header-cell');
      cells.forEach(function(c) { allLeafCells.push(c); });
    });

    // Deduplicate by text (multiple viewports can repeat the same headers)
    var seenGroups = {};
    var seenLeaves = {};
    var uniqueGroupCells = [];
    var uniqueLeafCells = [];

    allGroupCells.forEach(function(c) {
      var text = (c.querySelector('.ag-header-group-text') || c).textContent.trim();
      var key = text + '_' + (c.getAttribute('aria-colspan') || '');
      if (!seenGroups[key]) {
        seenGroups[key] = true;
        uniqueGroupCells.push(c);
      }
    });

    allLeafCells.forEach(function(c) {
      var text = (c.querySelector('.ag-header-cell-text') || c).textContent.trim();
      var colId = c.getAttribute('col-id') || '';
      var key = text + '_' + colId;
      if (!seenLeaves[key] && text) {
        seenLeaves[key] = true;
        uniqueLeafCells.push(c);
      }
    });

    if (uniqueGroupCells.length > 0) {
      // FIRST: filter out span-height leaf cells (they correspond to span-height group cells
      // and should NOT be consumed by the subsequent group's colspan count)
      var spanHeightTexts = {};
      uniqueGroupCells.forEach(function(gc) {
        if (gc.className.indexOf('ag-header-span-height') >= 0) {
          var t = (gc.querySelector('.ag-header-cell-text, .ag-header-group-text') || gc).textContent.trim();
          if (t) spanHeightTexts[t] = true;
        }
      });

      // Build filtered leaf list: exclude leaves that match span-height columns
      var filteredLeafCells = [];
      uniqueLeafCells.forEach(function(lc) {
        var isSpan = lc.className.indexOf('ag-header-span-height') >= 0 ||
                     lc.className.indexOf('ag-header-span-total') >= 0;
        var txt = (lc.querySelector('.ag-header-cell-text') || lc).textContent.trim();
        if (isSpan || spanHeightTexts[txt]) {
          // This leaf is a span-height column — don't include in group assignment
        } else {
          filteredLeafCells.push(lc);
        }
      });

      var leafIndex = 0;
      uniqueGroupCells.forEach(function(groupCell) {
        var label = (groupCell.querySelector('.ag-header-group-text') || groupCell)
          .textContent.trim();
        var colspan = parseInt(groupCell.getAttribute('aria-colspan') || '1', 10);

        var isNoGroup = groupCell.className.indexOf('ag-header-group-cell-no-group') >= 0;
        var isSpanHeight = groupCell.className.indexOf('ag-header-span-height') >= 0;

        if (isSpanHeight) {
          // Span-height: single column spanning both rows
          var spanText = (groupCell.querySelector('.ag-header-cell-text, .ag-header-group-text') || groupCell)
            .textContent.trim();
          if (spanText) {
            groups.push({ label: '', columns: [spanText], colspan: 1 });
          }
          return; // leaf already excluded from filteredLeafCells
        }

        if (isNoGroup && !label) {
          return;
        }

        var childCols = [];
        for (var i = 0; i < colspan && leafIndex < filteredLeafCells.length; i++, leafIndex++) {
          var cellLabel = (
            filteredLeafCells[leafIndex].querySelector('.ag-header-cell-text') || filteredLeafCells[leafIndex]
          ).textContent.trim();
          if (cellLabel) childCols.push(cellLabel);
        }

        if (label || childCols.length > 0) {
          groups.push({ label: label, columns: childCols, colspan: colspan });
        }
      });

      // Any remaining leaf cells not covered by groups
      while (leafIndex < filteredLeafCells.length) {
        var remainingLabel = (
          filteredLeafCells[leafIndex].querySelector('.ag-header-cell-text') || filteredLeafCells[leafIndex]
        ).textContent.trim();
        if (remainingLabel) {
          groups.push({ label: '', columns: [remainingLabel], colspan: 1 });
        }
        leafIndex++;
      }
    } else {
      // No group headers — flat single-level columns
      var columns = uniqueLeafCells.map(function(cell) {
        return (cell.querySelector('.ag-header-cell-text') || cell).textContent.trim();
      }).filter(Boolean);
      if (columns.length > 0) {
        groups.push({ label: '', columns: columns, colspan: columns.length });
      }
    }

    return groups;
  }

  // ── HTML TABLE COLUMNS ────────────────────────────────────────────────────

  function extractTableColumns(table) {
    var groups = [];
    var rows = Array.from(table.querySelectorAll('thead tr'));
    if (rows.length === 0) return groups;

    if (rows.length >= 2) {
      var groupCells = Array.from(rows[0].querySelectorAll('th'));
      var leafCells = Array.from(rows[1].querySelectorAll('th'));
      var leafIndex = 0;
      groupCells.forEach(function(th) {
        var label = th.textContent.trim();
        var colspan = parseInt(th.getAttribute('colspan') || '1', 10);
        var childCols = [];
        for (var i = 0; i < colspan && leafIndex < leafCells.length; i++, leafIndex++) {
          var colLabel = leafCells[leafIndex].textContent.trim();
          if (colLabel) childCols.push(colLabel);
        }
        groups.push({ label: label, columns: childCols, colspan: colspan });
      });
    } else {
      var cells = Array.from(rows[0].querySelectorAll('th'));
      var columns = cells.map(function(th) { return th.textContent.trim(); }).filter(Boolean);
      if (columns.length > 0) {
        groups.push({ label: '', columns: columns, colspan: columns.length });
      }
    }
    return groups;
  }

  // ── AUTO-CALCULATED ROWS ──────────────────────────────────────────────────

  function extractAutoRows(agRoot) {
    var autoRows = [];
    var rows = agRoot.querySelectorAll('.ag-row');
    rows.forEach(function(row) {
      var hasBolt = row.querySelector('[title*="auto"], [title*="calculated"], [data-icon="zap"], svg path[d*="M13 2L3 14"]');
      var cellText = (row.querySelector('.ag-cell:first-child') || row).textContent.trim();
      if (hasBolt || cellText.indexOf('\u26A1') >= 0) {
        autoRows.push({ label: cellText, autoCalculated: true });
      }
    });
    return autoRows;
  }

  // ── FORM FIELDS (Procore-specific styled components) ──────────────────────

  function findLabelText(input) {
    // 1. aria-label
    if (input.getAttribute('aria-label')) {
      var al = input.getAttribute('aria-label').trim();
      if (al.length < 80) return al;
    }
    // 2. <label for="id">
    if (input.id) {
      var lbl = document.querySelector('label[for="' + input.id + '"]');
      if (lbl) return lbl.textContent.trim().replace(/\s*\*\s*$/, '');
    }
    if (input.name) {
      var lbl2 = document.querySelector('label[for="' + input.name + '"]');
      if (lbl2) return lbl2.textContent.trim().replace(/\s*\*\s*$/, '');
    }
    // 3. aria-labelledby
    var labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      var el = document.getElementById(labelledBy);
      if (el) return el.textContent.trim();
    }
    // 4. Wrapping label
    var wrapping = input.closest('label');
    if (wrapping) return wrapping.textContent.trim();
    // 5. Preceding label-like sibling
    var prev = input.previousElementSibling;
    if (prev && /label|legend|span|div/i.test(prev.tagName)) {
      var t = prev.textContent.trim();
      if (t.length > 0 && t.length < 50) return t;
    }
    // 6. Parent StyledFormField label
    var formField = input.closest('[class*="FormField"], [class*="formField"], [class*="form-field"]');
    if (formField) {
      var fieldLabel = formField.querySelector('[class*="Label"], label');
      if (fieldLabel) {
        var lt = fieldLabel.textContent.trim();
        if (lt.length > 0 && lt.length < 60) return lt;
      }
    }
    return '';
  }

  function extractForms() {
    var sections = [];

    // Strategy 1: Look for Procore-specific StyledSection containers
    var procoreSections = document.querySelectorAll('[class*="StyledSection-"], [class*="section--level"]');
    var topLevelSections = [];

    procoreSections.forEach(function(s) {
      // Only take top-level sections (not nested)
      var parent = s.parentElement;
      var isNested = false;
      while (parent) {
        if (parent.className && parent.className.indexOf && parent.className.indexOf('StyledSection-') >= 0) {
          isNested = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!isNested) topLevelSections.push(s);
    });

    if (topLevelSections.length > 0) {
      topLevelSections.forEach(function(section) {
        var headerEl = section.querySelector('[class*="SectionHeader"]');
        var title = headerEl ? headerEl.textContent.trim() : '';

        // Skip sections that are just AG Grid tables (Line Items table section)
        if (section.querySelector('.ag-root')) {
          // This is a table section, not a form section — still capture its name
          sections.push({ title: title, fields: [], _isTable: true });
          return;
        }

        var fields = extractProcoreFields(section);
        if (fields.length > 0) {
          sections.push({ title: title, fields: fields });
        }
      });
      return sections;
    }

    // Strategy 2: Standard <form> elements
    var forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
      var fields = extractProcoreFields(form);
      if (fields.length > 0) {
        sections.push({ title: '', fields: fields });
      }
    });

    // Strategy 3: Look for any label+input pattern on the page
    if (sections.length === 0) {
      var allLabels = document.querySelectorAll('label[for], [class*="Label"][class*="Styled"]');
      if (allLabels.length > 0) {
        var fields = [];
        var seen = {};
        allLabels.forEach(function(label) {
          var text = label.textContent.trim();
          if (text && text.length < 60 && !seen[text]) {
            seen[text] = true;
            var forAttr = label.getAttribute('for') || '';
            var input = forAttr ? document.getElementById(forAttr) || document.querySelector('[name="' + forAttr + '"]') : null;

            fields.push({
              name: forAttr || text.toLowerCase().replace(/\s+/g, '_'),
              label: text,
              type: input ? (input.type || input.tagName.toLowerCase()) : 'custom',
              required: input ? (input.required || input.getAttribute('aria-required') === 'true') : false,
              placeholder: input ? (input.placeholder || '') : '',
              options: [],
              helpText: '',
            });
          }
        });
        if (fields.length > 0) {
          sections.push({ title: '', fields: fields });
        }
      }
    }

    return sections;
  }

  function extractProcoreFields(container) {
    var fields = [];
    var seen = {};

    // Find ALL labels within the container (Procore uses StyledLabel with htmlFor)
    var labels = container.querySelectorAll(
      'label[for], [class*="StyledLabel-"][class*="sc-172j5qh"]'
    );

    labels.forEach(function(label) {
      var text = label.textContent.trim().replace(/\s*\*\s*$/, '');
      if (!text || text.length > 80 || seen[text]) return;
      // Skip labels that are just values (like "Open", "TBD", "Allowance")
      if (label.className && label.className.indexOf('SelectButtonLabel') >= 0) return;
      if (label.className && label.className.indexOf('PillSelect') >= 0) return;
      if (label.className && label.className.indexOf('RadioButtonLabel') >= 0) return;

      seen[text] = true;
      var forAttr = label.getAttribute('for') || '';

      // Find the form field container — Procore structure:
      //   FormField > FormFieldHeader (contains Label)
      //             > FormFieldMain (contains Input or SelectButton)
      // So we go: label → FormFieldHeader → FormField parent
      var formField = null;
      var headerEl = label.closest('[class*="FormFieldHeader"]');
      if (headerEl && headerEl.parentElement) {
        formField = headerEl.parentElement;
      }
      if (!formField) {
        formField = label.closest('[class*="FormField"], [class*="formField"]');
      }
      if (!formField) {
        // Fallback: go up 2-3 levels from the label
        var p = label.parentElement;
        if (p) {
          formField = p.parentElement || p;
        }
      }

      // Find the corresponding input
      var input = null;
      if (forAttr) {
        input = document.getElementById(forAttr) || document.querySelector('[name="' + forAttr + '"]');
      }
      // Also check within the formField container
      if (!input && formField) {
        input = formField.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select');
      }

      var currentValue = '';
      var options = [];
      var fieldType = 'text';

      // Detect field type — check for Procore styled components FIRST
      if (formField) {
        // Procore styled dropdown (most common)
        var selectBtn = formField.querySelector('[class*="SelectButton"], [class*="PillSelect"]');
        if (selectBtn) {
          fieldType = 'select';
          var btnLabel = selectBtn.querySelector('[class*="SelectButtonLabel"], [class*="PillSelectLabel"]');
          if (btnLabel) currentValue = btnLabel.textContent.trim();
        }

        // Radio group
        var radios = formField.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          fieldType = 'radio';
          var radioLabels = formField.querySelectorAll('[class*="RadioButtonLabel"]');
          options = Array.from(radioLabels)
            .map(function(l) { return l.textContent.trim(); })
            .filter(function(t) { return t && t.length < 20; });
        }

        // Checkbox
        var checkbox = formField.querySelector('input[type="checkbox"]:not(.ag-checkbox-input)');
        if (checkbox && fieldType === 'text') fieldType = 'checkbox';

        // File upload
        var fileInput = formField.querySelector('input[type="file"], [class*="Dropzone"]');
        if (fileInput) fieldType = 'file';
      }

      // Standard HTML input fallback
      if (input && fieldType === 'text') {
        if (input.tagName === 'TEXTAREA') fieldType = 'textarea';
        else if (input.tagName === 'SELECT') {
          fieldType = 'select';
          options = Array.from(input.querySelectorAll('option'))
            .map(function(o) { return o.textContent.trim(); })
            .filter(function(o) { return o && o !== 'Select...' && o !== '--'; });
        }
        else if (input.type === 'number') fieldType = 'number';
        else if (input.type === 'date') fieldType = 'date';
        else if (input.type === 'email') fieldType = 'email';
        else fieldType = input.type || 'text';
      }

      // Rich text editor detection (TinyMCE, etc.)
      if (formField) {
        var richText = formField.querySelector('[class*="tox-tinymce"], [class*="rich-text"], [contenteditable]');
        if (richText) fieldType = 'richtext';
      }

      var required = false;
      if (input) {
        required = input.required || input.getAttribute('aria-required') === 'true';
      }
      // Check for required asterisk in the label
      var requiredMark = label.querySelector('[class*="required"], .required');
      if (requiredMark) required = true;
      if (label.textContent.trim().endsWith('*')) required = true;

      fields.push({
        name: forAttr || text.toLowerCase().replace(/\s+/g, '_'),
        label: text,
        type: fieldType,
        required: required,
        placeholder: input ? (input.placeholder || '') : '',
        options: options,
        currentValue: currentValue,
        helpText: '',
      });
    });

    // Also catch standalone text labels that precede radio buttons
    // (like "Expecting Revenue" which uses a plain styled text, not a <label for="...">)
    var allRadios = container.querySelectorAll('input[type="radio"]');
    var radioNames = {};
    allRadios.forEach(function(r) {
      if (r.name && !radioNames[r.name]) radioNames[r.name] = true;
    });
    Object.keys(radioNames).forEach(function(radioName) {
      // Find the container for this radio group
      var firstRadio = container.querySelector('input[type="radio"][name="' + radioName + '"]');
      if (!firstRadio) return;
      var radioContainer = firstRadio.closest('[class*="FormField"], [class*="formField"]');
      if (!radioContainer) radioContainer = firstRadio.parentElement.parentElement;
      if (!radioContainer) return;

      // Find the label text — look for a styled text element before the radio buttons
      var allTexts = radioContainer.querySelectorAll('[class*="Typography"], [class*="Label"]');
      var groupLabel = '';
      allTexts.forEach(function(t) {
        var txt = t.textContent.trim();
        // Skip "Yes", "No" and other option labels
        if (txt.length > 2 && txt.length < 50 && !/^(Yes|No|True|False)$/i.test(txt)) {
          if (!groupLabel) groupLabel = txt;
        }
      });

      if (groupLabel && !seen[groupLabel]) {
        seen[groupLabel] = true;
        var opts = Array.from(radioContainer.querySelectorAll('[class*="RadioButtonLabel"]'))
          .map(function(l) { return l.textContent.trim(); })
          .filter(function(t) { return t && t.length < 20; });
        fields.push({
          name: radioName || groupLabel.toLowerCase().replace(/\s+/g, '_'),
          label: groupLabel,
          type: 'radio',
          required: false,
          placeholder: '',
          options: opts,
          currentValue: '',
          helpText: '',
        });
      }
    });

    return fields;
  }

  // ── TOOLBAR ACTIONS ───────────────────────────────────────────────────────

  function extractToolbarActions() {
    var actions = [];
    var seen = {};

    // Look for the primary toolbar area (not inside AG Grid)
    var toolbar = document.querySelector(
      '[class*="toolbar"]:not(.ag-header-row):not(.ag-root), ' +
      '[class*="Toolbar"]:not(.ag-header-row), ' +
      '[class*="action-bar"], [class*="ActionBar"]'
    );
    if (!toolbar) {
      toolbar = document.querySelector('[class*="PageHeader"], header, [role="toolbar"]');
    }
    if (!toolbar) toolbar = document.body;

    // Find buttons that are NOT inside AG Grid headers
    var buttons = toolbar.querySelectorAll(
      'button:not(.ag-header-cell *):not([aria-hidden="true"]), ' +
      'a[role="button"]:not(.ag-header-cell *)'
    );

    buttons.forEach(function(el) {
      var label = el.textContent.trim() || el.getAttribute('aria-label') || '';
      if (!label || label.length > 60 || seen[label]) return;
      // Skip pagination, grid controls
      if (/^(First Page|Previous Page|Next Page|Last Page|Expand group|Collapse group|Open first|Drag here|Select a column|Configure|Provide Feedback)$/i.test(label)) return;
      if (/^(×|close|cancel)$/i.test(label)) return;

      seen[label] = true;
      var isDropdown = el.getAttribute('aria-haspopup') === 'true' ||
        el.getAttribute('aria-expanded') !== null;
      var isPrimary = el.className && (
        el.className.indexOf('primary') >= 0 ||
        el.className.indexOf('Primary') >= 0 ||
        el.className.indexOf('cta') >= 0
      );
      actions.push({
        label: label,
        type: isDropdown ? 'dropdown' : 'button',
        variant: isPrimary ? 'primary' : 'default',
      });
    });

    return actions.slice(0, 15);
  }

  // ── FILTERS ───────────────────────────────────────────────────────────────

  function extractFilters() {
    var filters = [];
    // Look for filter sidebar h4 headings (Procore uses h4 for filter groups)
    var filterHeaders = document.querySelectorAll('[class*="filter"] h4, [class*="Filter"] h4');
    filterHeaders.forEach(function(h) {
      var text = h.textContent.trim();
      if (text && text.length < 50) {
        filters.push({ label: text, type: 'filter-group', options: [] });
      }
    });
    return filters;
  }

  // ── ROW ACTIONS ───────────────────────────────────────────────────────────

  function extractRowActions() {
    var actions = [];
    var seen = {};
    var menuItems = document.querySelectorAll('[role="menuitem"], [class*="dropdown-item"]');
    menuItems.forEach(function(item) {
      var label = item.textContent.trim();
      if (label && !seen[label] && label.length < 50) {
        seen[label] = true;
        actions.push({ label: label });
      }
    });
    return actions;
  }

  // ── TABS ──────────────────────────────────────────────────────────────────

  function extractTabs() {
    var tabs = [];

    // Strategy 1: role="tab" elements
    var tabEls = document.querySelectorAll('[role="tab"]');
    tabEls.forEach(function(t) {
      var text = t.textContent.trim();
      if (text && text.length < 60 && tabs.indexOf(text) < 0) tabs.push(text);
    });

    // Strategy 2: Procore sub-navigation tabs (class contains "Tab" at component level)
    // These are the "Line Items", "No Line Items", "RFQs", etc. tabs
    var tabLinks = document.querySelectorAll(
      '[class*="TabItem"] a, [class*="TabItem"] button, ' +
      '[class*="tab-item"] a, [class*="tab-item"] button, ' +
      '[class*="SubNav"] a, [class*="subnav"] a'
    );
    tabLinks.forEach(function(t) {
      var text = t.textContent.trim();
      if (text && text.length < 60 && tabs.indexOf(text) < 0) tabs.push(text);
    });

    // Strategy 3: Detail page section tabs (Overview, Commitments, etc.)
    var sectionLinks = document.querySelectorAll(
      'nav[class*="detail"] a, nav[class*="Detail"] a, ' +
      '[class*="DetailNav"] a, [class*="detail-nav"] a'
    );
    sectionLinks.forEach(function(t) {
      var text = t.textContent.trim();
      if (text && text.length < 60 && tabs.indexOf(text) < 0) tabs.push(text);
    });

    return tabs;
  }

  // ── HEADER/DETAIL FIELDS ──────────────────────────────────────────────────

  function extractHeaderFields() {
    var fields = [];
    var kvContainers = document.querySelectorAll(
      '[class*="detail-header"], [class*="DetailHeader"], ' +
      '[class*="show-header"], [class*="summary-header"], ' +
      '[class*="GeneralInfo"], [class*="general-info"]'
    );
    kvContainers.forEach(function(container) {
      var labels = container.querySelectorAll('[class*="label"], [class*="Label"], dt, th');
      labels.forEach(function(labelEl) {
        var valueEl = labelEl.nextElementSibling;
        if (!valueEl) {
          // Try parent/sibling pattern
          var parent = labelEl.parentElement;
          valueEl = parent ? parent.querySelector('[class*="value"], [class*="Value"], dd, td') : null;
        }
        if (labelEl && valueEl) {
          var l = labelEl.textContent.trim();
          var v = valueEl.textContent.trim();
          if (l && l.length < 50) {
            fields.push({ label: l, value: v });
          }
        }
      });
    });
    return fields;
  }

  // ═══ MAIN EXTRACTION ══════════════════════════════════════════════════════

  var result = {
    id: state.id,
    description: state.description,
    url: window.location.href,
    columnGroups: [],
    columns: [],
    toolbarActions: [],
    filters: [],
    rowActions: [],
    autoRows: [],
    formSections: [],
    tabs: [],
    headerFields: [],
    _capture_note: '',
  };

  // AG Grid (primary)
  var agRoot = document.querySelector('.ag-root, .ag-root-wrapper');
  if (agRoot) {
    result.columnGroups = extractAgGridColumns(agRoot);
    result.columns = [];
    result.columnGroups.forEach(function(g) {
      g.columns.forEach(function(c) {
        result.columns.push({ label: c, columnGroup: g.label || null });
      });
    });
    result.autoRows = extractAutoRows(agRoot);
  } else {
    var table = document.querySelector('table');
    if (table) {
      result.columnGroups = extractTableColumns(table);
      result.columns = [];
      result.columnGroups.forEach(function(g) {
        g.columns.forEach(function(c) {
          result.columns.push({ label: c, columnGroup: g.label || null });
        });
      });
    }
  }

  result.toolbarActions = extractToolbarActions();
  result.filters = extractFilters();
  result.rowActions = extractRowActions();
  result.formSections = extractForms();
  result.tabs = extractTabs();
  result.headerFields = extractHeaderFields();

  return result;
}
