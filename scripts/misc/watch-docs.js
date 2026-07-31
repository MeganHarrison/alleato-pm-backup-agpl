#!/usr/bin/env node

/**
 * Auto-commit and push docs folder changes
 *
 * This script watches the docs/ folder for changes and automatically:
 * 1. Stages the changes
 * 2. Commits them with a descriptive message
 * 3. Pushes to GitHub
 * 4. Triggers Vercel redeployment
 *
 * Usage: node scripts/watch-docs.js
 * Or add to package.json: "watch:docs": "node scripts/watch-docs.js"
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DOCS_PATH = path.join(__dirname, '..', 'docs');
const DEBOUNCE_MS = 5000; // Wait 5 seconds after last change before committing

let changeTimer = null;
let pendingChanges = new Set();

console.log('🔍 Watching docs folder for changes...');
console.log(`📁 Path: ${DOCS_PATH}`);
console.log('');

// Check if docs folder exists
if (!fs.existsSync(DOCS_PATH)) {
  console.error('❌ Error: docs/ folder not found!');
  console.log('Creating docs/ folder...');
  fs.mkdirSync(DOCS_PATH, { recursive: true });
}

function gitCommand(command) {
  try {
    const output = execSync(command, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8'
    });
    return output.trim();
  } catch (error) {
    console.error(`❌ Git command failed: ${command}`);
    console.error(error.message);
    return null;
  }
}

function commitAndPush() {
  console.log('\n📝 Processing changes...');
  console.log(`   Files changed: ${pendingChanges.size}`);

  // Stage all changes in docs folder
  const addResult = gitCommand('git add docs/');

  // Check if there are actually changes to commit
  const status = gitCommand('git diff --staged --quiet');
  if (status === '') {
    console.log('ℹ️  No changes to commit (files might be identical)');
    pendingChanges.clear();
    return;
  }

  // Get list of changed files for commit message
  const changedFiles = gitCommand('git diff --staged --name-only');
  const fileList = changedFiles ? changedFiles.split('\n').map(f => `  - ${f}`).join('\n') : '';

  // Create commit message
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const commitMessage = `docs: auto-update documentation

Updated ${pendingChanges.size} file(s) at ${timestamp}

Files changed:
${fileList}

[skip ci]`;

  // Commit
  console.log('💾 Committing changes...');
  gitCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

  // Push
  console.log('🚀 Pushing to GitHub...');
  const pushResult = gitCommand('git push');

  if (pushResult !== null) {
    console.log('✅ Successfully pushed to GitHub!');
    console.log('🌐 Vercel will automatically redeploy');
  }

  pendingChanges.clear();
  console.log('\n🔍 Watching for more changes...\n');
}

function scheduleCommit(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  pendingChanges.add(relativePath);

  // Clear existing timer
  if (changeTimer) {
    clearTimeout(changeTimer);
  }

  // Schedule commit after debounce period
  changeTimer = setTimeout(() => {
    commitAndPush();
    changeTimer = null;
  }, DEBOUNCE_MS);

  console.log(`📄 Change detected: ${relativePath}`);
  console.log(`   Waiting ${DEBOUNCE_MS/1000}s for more changes...`);
}

// Watch the docs folder
const watcher = chokidar.watch(DOCS_PATH, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
});

// Handle file events
watcher
  .on('add', filePath => scheduleCommit(filePath))
  .on('change', filePath => scheduleCommit(filePath))
  .on('unlink', filePath => scheduleCommit(filePath))
  .on('error', error => console.error(`❌ Watcher error: ${error}`));

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping docs watcher...');
  if (changeTimer) {
    console.log('⏳ Committing pending changes...');
    clearTimeout(changeTimer);
    commitAndPush();
  }
  watcher.close();
  process.exit(0);
});

console.log('✅ Docs watcher started successfully!');
console.log('Press Ctrl+C to stop\n');
