/**
 * Organize screenshots for Figma import
 * 
 * This script prepares screenshots for efficient Figma import by:
 * 1. Creating a structured folder hierarchy
 * 2. Generating a CSV manifest for bulk import plugins
 * 3. Creating an image board preview
 */

const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = './procore-app-screenshots';
const ORGANIZED_DIR = './figma-ready';

// Procore module categories for Figma organization
const FIGMA_STRUCTURE = {
  '01-Portfolio': ['portfolio', 'company-directory', 'company-admin'],
  '02-Project-Home': ['project-home', 'project-overview'],
  '03-Core-Tools': ['daily-log', 'directory', 'documents', 'drawings', 'emails', 'meetings', 'photos', 'schedule', 'specifications', 'tasks'],
  '04-Quality-Safety': ['inspections', 'incidents', 'observations', 'action-plans', 'punch-list'],
  '05-Design-Coordination': ['rfi', 'submittals', 'coordination-issues', 'models'],
  '06-Financials': ['budget', 'budget-forecasting', 'change-events', 'change-orders', 'commitments', 'direct-costs', 'invoicing', 'prime-contract'],
  '07-Bidding': ['bidding', 'estimating'],
  '08-Components': [], // Will be populated with component screenshots
  '09-Modals': [], // Will be populated with modal screenshots
};

function organizeForFigma() {
  // Create output directory
  if (!fs.existsSync(ORGANIZED_DIR)) {
    fs.mkdirSync(ORGANIZED_DIR, { recursive: true });
  }

  // Create Figma-friendly folder structure
  Object.keys(FIGMA_STRUCTURE).forEach(folder => {
    const folderPath = path.join(ORGANIZED_DIR, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });

  // Read all screenshots
  const viewportDir = path.join(SCREENSHOT_DIR, 'viewport');
  const componentsDir = path.join(SCREENSHOT_DIR, 'components');
  const modalsDir = path.join(SCREENSHOT_DIR, 'modals');

  const manifest = [];

  // Organize viewport screenshots
  if (fs.existsSync(viewportDir)) {
    const files = fs.readdirSync(viewportDir).filter(f => f.endsWith('.png'));
    
    files.forEach(file => {
      const baseName = file.replace('.png', '').replace('company-', '').replace('project-', '');
      
      // Find appropriate category
      let targetFolder = '99-Uncategorized';
      for (const [folder, modules] of Object.entries(FIGMA_STRUCTURE)) {
        if (modules.some(m => baseName.includes(m))) {
          targetFolder = folder;
          break;
        }
      }
      
      // Create target folder if needed
      const targetPath = path.join(ORGANIZED_DIR, targetFolder);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      
      // Copy file
      const sourcePath = path.join(viewportDir, file);
      const destPath = path.join(targetPath, file);
      fs.copyFileSync(sourcePath, destPath);
      
      manifest.push({
        file: destPath,
        category: targetFolder,
        name: baseName,
        type: 'viewport',
      });
    });
  }

  // Organize component screenshots
  if (fs.existsSync(componentsDir)) {
    const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.png'));
    const targetPath = path.join(ORGANIZED_DIR, '08-Components');
    
    files.forEach(file => {
      fs.copyFileSync(
        path.join(componentsDir, file),
        path.join(targetPath, file)
      );
      manifest.push({
        file: path.join(targetPath, file),
        category: '08-Components',
        name: file.replace('.png', ''),
        type: 'component',
      });
    });
  }

  // Organize modal screenshots
  if (fs.existsSync(modalsDir)) {
    const files = fs.readdirSync(modalsDir).filter(f => f.endsWith('.png'));
    const targetPath = path.join(ORGANIZED_DIR, '09-Modals');
    
    files.forEach(file => {
      fs.copyFileSync(
        path.join(modalsDir, file),
        path.join(targetPath, file)
      );
      manifest.push({
        file: path.join(targetPath, file),
        category: '09-Modals',
        name: file.replace('.png', ''),
        type: 'modal',
      });
    });
  }

  // Generate CSV for Figma bulk import plugins
  const csvContent = [
    'filename,category,name,type',
    ...manifest.map(item => `${item.file},${item.category},${item.name},${item.type}`)
  ].join('\n');
  
  fs.writeFileSync(path.join(ORGANIZED_DIR, 'import-manifest.csv'), csvContent);

  // Generate JSON manifest
  fs.writeFileSync(
    path.join(ORGANIZED_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Generate summary
  const summary = {
    totalScreenshots: manifest.length,
    byCategory: {},
    byType: {},
    generatedAt: new Date().toISOString(),
  };

  manifest.forEach(item => {
    summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
    summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
  });

  fs.writeFileSync(
    path.join(ORGANIZED_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n✅ Screenshots organized for Figma import!');
  console.log('\nSummary:');
  console.log(`  Total screenshots: ${manifest.length}`);
  console.log('\n  By category:');
  Object.entries(summary.byCategory).forEach(([cat, count]) => {
    console.log(`    ${cat}: ${count}`);
  });
  console.log(`\n  Output directory: ${ORGANIZED_DIR}`);
  console.log('\nNext steps:');
  console.log('  1. Open Figma');
  console.log('  2. Create a new file or frame for each category');
  console.log('  3. Drag and drop the folders into Figma');
  console.log('  4. Or use a plugin like "Insert Big Image" for large screenshots');
}

organizeForFigma();
