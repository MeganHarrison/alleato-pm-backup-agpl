#!/usr/bin/env node
/**
 * Complete Task with Verification
 * Generates manifest from changes and runs verification
 */

import { ManifestGenerator } from './verification/manifest-generator';
import { VerificationOrchestrator } from './verification/verification-orchestrator';
import * as path from 'path';
import * as fs from 'fs';

async function completeTask(description: string) {
  console.log('🚀 Completing task with verification...\n');
  
  // Step 1: Generate manifest from current changes
  console.log('📋 Generating task manifest...');
  const generator = new ManifestGenerator();
  const manifest = await generator.generateFromGitChanges(description);
  
  console.log(`✓ Task type detected: ${manifest.task_type}`);
  console.log(`✓ Files modified: ${manifest.files_modified.length}`);
  console.log(`✓ Verification needed:`, Object.entries(manifest.verification_needed)
    .filter(([_, needed]) => needed)
    .map(([type]) => type)
    .join(', '));
  
  // Save manifest
  const manifestPath = await generator.saveManifest(manifest);
  console.log(`✓ Manifest saved to: ${manifestPath}\n`);
  
  // Step 2: Check if dev server is running (for visual tests)
  if (manifest.verification_needed.visual) {
    try {
      const response = await fetch('http://localhost:3000');
      if (!response.ok) throw new Error('Dev server not responding');
    } catch {
      console.warn('⚠️  Visual verification requires dev server running on port 3000');
      console.warn('   Please run `npm run dev` in another terminal and try again.\n');
      process.exit(1);
    }
  }
  
  // Step 3: Run verification
  console.log('🔍 Running verification...\n');
  const orchestrator = new VerificationOrchestrator();
  const report = await orchestrator.verifyFromManifest(manifestPath);
  
  // Save report
  const reportPath = orchestrator.saveReport(report);
  
  // Step 4: Display results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TASK COMPLETION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Task: ${description}`);
  console.log(`Type: ${manifest.task_type}`);
  console.log(`Files: ${manifest.files_modified.length} modified`);
  console.log(`Checks: ${report.results.summary.totalChecks} total`);
  console.log(`Result: ${report.recommendation === 'approve' ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(60));
  
  if (report.results.failures.length > 0) {
    console.log('\n❌ VERIFICATION FAILURES:\n');
    for (const failure of report.results.failures) {
      console.log(`${failure.severity.toUpperCase()}: ${failure.check}`);
      console.log(`  Reason: ${failure.reason}`);
      console.log(`  Fix: ${failure.suggestion}\n`);
    }
  }
  
  // Step 5: Create task completion record
  const completionRecord = {
    task: {
      id: manifest.task_id,
      description,
      type: manifest.task_type,
      completed_at: new Date().toISOString()
    },
    manifest: manifest,
    verification: {
      status: report.recommendation,
      summary: report.results.summary,
      report_path: reportPath
    }
  };
  
  const recordPath = path.join('.claude/tasks', `${manifest.task_id}.json`);
  const recordDir = path.dirname(recordPath);
  if (!fs.existsSync(recordDir)) {
    fs.mkdirSync(recordDir, { recursive: true });
  }
  fs.writeFileSync(recordPath, JSON.stringify(completionRecord, null, 2));
  
  // Step 6: Exit with appropriate code
  if (report.recommendation === 'approve') {
    console.log('\n✅ Task completed successfully!');
    console.log(`📄 Full report: ${reportPath}`);
    console.log(`📋 Task record: ${recordPath}`);
    process.exit(0);
  } else if (report.recommendation === 'manual-review') {
    console.log('\n⚠️  Task completed with warnings - manual review recommended');
    console.log(`📄 Full report: ${reportPath}`);
    process.exit(0);
  } else {
    console.log('\n❌ Task cannot be marked complete - fix required!');
    console.log(`📄 Full report: ${reportPath}`);
    console.log('\nNext steps:');
    console.log('1. Fix the identified issues');
    console.log('2. Run this command again');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const description = process.argv.slice(2).join(' ');
  
  if (!description) {
    console.error('Usage: complete-task "Description of what you did"');
    console.error('Example: complete-task "Updated dashboard layout to use full width"');
    process.exit(1);
  }
  
  completeTask(description).catch(error => {
    console.error('Error completing task:', error);
    process.exit(1);
  });
}

export { completeTask };