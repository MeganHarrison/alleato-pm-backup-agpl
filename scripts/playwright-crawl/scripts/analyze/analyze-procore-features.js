#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Analyzes Procore DOM captures to extract features, fields, and patterns
 */
class ProcoreFeatureAnalyzer {
  constructor(outputDir = '../outputs') {
    this.outputDir = path.join(__dirname, outputDir);
    this.domDir = path.join(this.outputDir, 'dom');
    this.features = {
      modules: {},
      forms: {},
      tables: {},
      fields: {},
      validations: {},
      workflows: {},
      permissions: {}
    };
  }

  async analyze() {
    console.log('🔍 Starting Procore Feature Analysis...\n');

    // Get all DOM files
    const domFiles = await this.getDomFiles();
    console.log(`Found ${domFiles.length} DOM files to analyze\n`);

    // Analyze each file
    for (const file of domFiles) {
      await this.analyzeFile(file);
    }

    // Generate reports
    await this.generateReports();
    
    console.log('\n✅ Analysis complete!');
  }

  async getDomFiles() {
    const files = [];
    
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name.endsWith('.html')) {
          files.push(fullPath);
        }
      }
    }
    
    await walk(this.domDir);
    return files;
  }

  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const dom = new JSDOM(content, {
        // Suppress CSS parsing errors
        virtualConsole: new (new JSDOM()).window._virtualConsole.constructor()
      });
      const document = dom.window.document;
      const fileName = path.basename(filePath, '.html');
      
      console.log(`Analyzing: ${fileName}`);

      // Extract module name
      const moduleName = this.extractModuleName(fileName, document);
      
      if (!this.features.modules[moduleName]) {
        this.features.modules[moduleName] = {
          pages: [],
          forms: [],
          tables: [],
          fields: new Set(),
          actions: new Set()
        };
      }
      
      const module = this.features.modules[moduleName];
      module.pages.push(fileName);

      // Extract forms
      const forms = this.extractForms(document);
      if (forms.length > 0) {
        module.forms.push(...forms);
        this.features.forms[fileName] = forms;
      }

      // Extract tables
      const tables = this.extractTables(document);
      if (tables.length > 0) {
        module.tables.push(...tables);
        this.features.tables[fileName] = tables;
      }

      // Extract fields from forms and tables
      const fields = this.extractFields(document);
      fields.forEach(field => {
        module.fields.add(field.name);
        if (!this.features.fields[field.name]) {
          this.features.fields[field.name] = [];
        }
        this.features.fields[field.name].push({
          module: moduleName,
          page: fileName,
          ...field
        });
      });

      // Extract actions
      const actions = this.extractActions(document);
      actions.forEach(action => module.actions.add(action));

      // Extract validation patterns
      const validations = this.extractValidations(document);
      if (validations.length > 0) {
        this.features.validations[fileName] = validations;
      }

      // Extract workflow indicators
      const workflows = this.extractWorkflows(document);
      if (workflows.length > 0) {
        this.features.workflows[fileName] = workflows;
      }
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error.message);
    }
  }

  extractModuleName(fileName, document) {
    // Try to extract from filename
    if (fileName.includes('budget')) return 'budget';
    if (fileName.includes('commitment')) return 'commitments';
    if (fileName.includes('prime_contract')) return 'prime_contracts';
    if (fileName.includes('change')) return 'change_management';
    if (fileName.includes('invoice')) return 'billing';
    if (fileName.includes('cost')) return 'cost_tracking';
    
    // Try to extract from title
    const title = document.querySelector('title')?.textContent?.toLowerCase() || '';
    if (title.includes('budget')) return 'budget';
    if (title.includes('commitment')) return 'commitments';
    if (title.includes('prime contract')) return 'prime_contracts';
    if (title.includes('change')) return 'change_management';
    if (title.includes('invoice')) return 'billing';
    if (title.includes('cost')) return 'cost_tracking';
    
    return 'other';
  }

  extractForms(document) {
    const forms = [];
    const formElements = document.querySelectorAll('form');
    
    formElements.forEach((form, index) => {
      const formData = {
        id: form.id || `form-${index}`,
        action: form.action,
        method: form.method,
        fields: []
      };

      // Extract all form fields
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const field = {
          name: input.name,
          type: input.type || input.tagName.toLowerCase(),
          id: input.id,
          required: input.required || input.hasAttribute('required'),
          placeholder: input.placeholder,
          label: this.findLabel(input, document),
          validations: []
        };

        // Check for validation attributes
        if (input.pattern) field.validations.push(`pattern: ${input.pattern}`);
        if (input.minLength) field.validations.push(`minLength: ${input.minLength}`);
        if (input.maxLength) field.validations.push(`maxLength: ${input.maxLength}`);
        if (input.min) field.validations.push(`min: ${input.min}`);
        if (input.max) field.validations.push(`max: ${input.max}`);

        // Extract select options
        if (input.tagName === 'SELECT') {
          field.options = Array.from(input.querySelectorAll('option')).map(opt => ({
            value: opt.value,
            text: opt.textContent.trim()
          }));
        }

        formData.fields.push(field);
      });

      forms.push(formData);
    });

    return forms;
  }

  extractTables(document) {
    const tables = [];
    const tableElements = document.querySelectorAll('table');
    
    tableElements.forEach((table, index) => {
      const tableData = {
        id: table.id || `table-${index}`,
        headers: [],
        columns: []
      };

      // Extract headers
      const headers = table.querySelectorAll('th');
      headers.forEach(header => {
        const headerText = header.textContent.trim();
        if (headerText) {
          tableData.headers.push(headerText);
          tableData.columns.push({
            name: headerText,
            sortable: header.querySelector('[class*="sort"]') !== null,
            filterable: header.querySelector('[class*="filter"]') !== null
          });
        }
      });

      if (tableData.headers.length > 0) {
        tables.push(tableData);
      }
    });

    return tables;
  }

  extractFields(document) {
    const fields = [];
    
    // Extract from all inputs (not just in forms)
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.name && !input.name.includes('token')) {
        fields.push({
          name: input.name,
          type: input.type || input.tagName.toLowerCase(),
          required: input.required || input.hasAttribute('required'),
          label: this.findLabel(input, document)
        });
      }
    });

    // Extract from table headers (potential fields)
    const headers = document.querySelectorAll('th');
    headers.forEach(header => {
      const text = header.textContent.trim();
      if (text && !text.includes('Actions')) {
        fields.push({
          name: this.normalizeFieldName(text),
          type: 'table_column',
          label: text
        });
      }
    });

    return fields;
  }

  extractActions(document) {
    const actions = new Set();
    
    // Extract from buttons
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a[class*="btn"], a[class*="button"]');
    buttons.forEach(button => {
      const text = button.textContent?.trim() || button.value;
      if (text && text.length > 1 && text.length < 50) {
        actions.add(text);
      }
    });

    // Extract from dropdown items
    const dropdownItems = document.querySelectorAll('[class*="dropdown"] a, [class*="menu"] a');
    dropdownItems.forEach(item => {
      const text = item.textContent?.trim();
      if (text && text.length > 1 && text.length < 50) {
        actions.add(text);
      }
    });

    return Array.from(actions);
  }

  extractValidations(document) {
    const validations = [];
    
    // Look for validation messages
    const validationElements = document.querySelectorAll('[class*="error"], [class*="validation"], [class*="invalid"]');
    validationElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text) {
        validations.push({
          type: 'error_message',
          text: text
        });
      }
    });

    // Look for required field indicators
    const requiredIndicators = document.querySelectorAll('.required, [class*="required"], :required');
    requiredIndicators.forEach(element => {
      const field = element.name || element.id || this.findLabel(element, document);
      if (field) {
        validations.push({
          type: 'required_field',
          field: field
        });
      }
    });

    return validations;
  }

  extractWorkflows(document) {
    const workflows = [];
    
    // Look for status indicators
    const statusElements = document.querySelectorAll('[class*="status"], [class*="state"], [class*="badge"]');
    statusElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length < 30) {
        workflows.push({
          type: 'status',
          value: text
        });
      }
    });

    // Look for workflow actions
    const workflowActions = ['Approve', 'Reject', 'Submit', 'Review', 'Send', 'Lock', 'Unlock'];
    const buttons = document.querySelectorAll('button, a[class*="btn"]');
    buttons.forEach(button => {
      const text = button.textContent?.trim();
      if (text && workflowActions.some(action => text.includes(action))) {
        workflows.push({
          type: 'workflow_action',
          action: text
        });
      }
    });

    return workflows;
  }

  findLabel(input, document) {
    // Try to find associated label by searching all labels
    if (input.id) {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.getAttribute('for') === input.id) {
          return label.textContent.trim();
        }
      }
    }
    
    // Check if input is inside a label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      // Get text content but exclude the input's own text
      const labelClone = parentLabel.cloneNode(true);
      const inputClone = labelClone.querySelector('input, select, textarea');
      if (inputClone) inputClone.remove();
      return labelClone.textContent.trim();
    }
    
    // Check for nearby text
    const prev = input.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') return prev.textContent.trim();
    
    // Check for text node siblings
    let node = input.previousSibling;
    while (node) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        return node.textContent.trim();
      }
      node = node.previousSibling;
    }
    
    return input.placeholder || input.name || '';
  }

  normalizeFieldName(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async generateReports() {
    // Generate module summary
    const moduleSummary = this.generateModuleSummary();
    await fs.writeFile(
      path.join(this.outputDir, 'analysis', 'module-summary.json'),
      JSON.stringify(moduleSummary, null, 2)
    );

    // Generate field inventory
    const fieldInventory = this.generateFieldInventory();
    await fs.writeFile(
      path.join(this.outputDir, 'analysis', 'field-inventory.json'),
      JSON.stringify(fieldInventory, null, 2)
    );

    // Generate CRUD operations report
    const crudOps = this.generateCrudReport();
    await fs.writeFile(
      path.join(this.outputDir, 'analysis', 'crud-operations.json'),
      JSON.stringify(crudOps, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    await fs.writeFile(
      path.join(this.outputDir, 'analysis', 'feature-analysis.md'),
      markdownReport
    );
  }

  generateModuleSummary() {
    const summary = {};
    
    Object.entries(this.features.modules).forEach(([name, module]) => {
      summary[name] = {
        pageCount: module.pages.length,
        pages: module.pages,
        formCount: module.forms.length,
        tableCount: module.tables.length,
        uniqueFields: Array.from(module.fields).sort(),
        actions: Array.from(module.actions).sort()
      };
    });

    return summary;
  }

  generateFieldInventory() {
    const inventory = {};
    
    Object.entries(this.features.fields).forEach(([fieldName, occurrences]) => {
      inventory[fieldName] = {
        occurrences: occurrences.length,
        modules: [...new Set(occurrences.map(o => o.module))],
        types: [...new Set(occurrences.map(o => o.type))],
        required: occurrences.some(o => o.required),
        examples: occurrences.slice(0, 3)
      };
    });

    return inventory;
  }

  generateCrudReport() {
    const crudOps = {};
    
    Object.entries(this.features.modules).forEach(([name, module]) => {
      const actions = Array.from(module.actions);
      crudOps[name] = {
        create: actions.filter(a => a.toLowerCase().includes('create') || a.toLowerCase().includes('new') || a.toLowerCase().includes('add')),
        read: actions.filter(a => a.toLowerCase().includes('view') || a.toLowerCase().includes('show') || a.toLowerCase().includes('list')),
        update: actions.filter(a => a.toLowerCase().includes('edit') || a.toLowerCase().includes('update') || a.toLowerCase().includes('modify')),
        delete: actions.filter(a => a.toLowerCase().includes('delete') || a.toLowerCase().includes('remove') || a.toLowerCase().includes('archive'))
      };
    });

    return crudOps;
  }

  generateMarkdownReport() {
    let report = '# Procore Feature Analysis Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Module Overview
    report += '## Module Overview\n\n';
    Object.entries(this.features.modules).forEach(([name, module]) => {
      report += `### ${name}\n`;
      report += `- Pages: ${module.pages.length}\n`;
      report += `- Forms: ${module.forms.length}\n`;
      report += `- Tables: ${module.tables.length}\n`;
      report += `- Unique Fields: ${module.fields.size}\n`;
      report += `- Actions: ${module.actions.size}\n\n`;
    });

    // Field Summary
    report += '## Field Summary\n\n';
    report += '| Field Name | Occurrences | Modules | Types | Required |\n';
    report += '|------------|-------------|---------|-------|----------|\n';
    
    Object.entries(this.generateFieldInventory())
      .sort((a, b) => b[1].occurrences - a[1].occurrences)
      .slice(0, 20)
      .forEach(([field, data]) => {
        report += `| ${field} | ${data.occurrences} | ${data.modules.join(', ')} | ${data.types.join(', ')} | ${data.required ? 'Yes' : 'No'} |\n`;
      });

    // CRUD Operations
    report += '\n## CRUD Operations by Module\n\n';
    Object.entries(this.generateCrudReport()).forEach(([module, ops]) => {
      report += `### ${module}\n`;
      report += `- **Create**: ${ops.create.join(', ') || 'None'}\n`;
      report += `- **Read**: ${ops.read.join(', ') || 'None'}\n`;
      report += `- **Update**: ${ops.update.join(', ') || 'None'}\n`;
      report += `- **Delete**: ${ops.delete.join(', ') || 'None'}\n\n`;
    });

    return report;
  }
}

// Run the analyzer
const analyzer = new ProcoreFeatureAnalyzer();
analyzer.analyze().catch(console.error);