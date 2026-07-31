import fs from "fs";
import path from "path";

/**
 * Cleanup script to remove useless capture folders
 *
 * This script removes folders that:
 * 1. Are expanded views (_expanded_N pattern)
 * 2. Don't have a dom.html file
 * 3. Only contain a screenshot and metadata
 *
 * Run with: node scripts/cleanup-useless-folders.js
 */

const CRAWL_DIR = "./procore-support-crawl";
const PAGES_DIR = path.join(CRAWL_DIR, "pages");
const DRY_RUN = false; // Set to true to see what would be deleted without actually deleting

function analyzeFolder(folderPath) {
  const files = fs.readdirSync(folderPath);

  return {
    hasScreenshot: files.includes("screenshot.png"),
    hasMetadata: files.includes("metadata.json"),
    hasDom: files.includes("dom.html"),
    fileCount: files.length,
    files
  };
}

function isUselessExpandedFolder(folderName, folderPath) {
  // Check if it's an expanded view folder
  if (!folderName.includes("_expanded_")) {
    return false;
  }

  const analysis = analyzeFolder(folderPath);

  // It's useless if it has no DOM file
  // (screenshot + metadata only = useless)
  return !analysis.hasDom;
}

function cleanupUselessFolders() {
  console.log(`🔍 Scanning: ${PAGES_DIR}\n`);

  if (!fs.existsSync(PAGES_DIR)) {
    console.error(`❌ Directory not found: ${PAGES_DIR}`);
    return;
  }

  const allFolders = fs.readdirSync(PAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let uselessCount = 0;
  let totalSize = 0;
  const uselessFolders = [];

  console.log(`📊 Found ${allFolders.length} total folders\n`);

  for (const folderName of allFolders) {
    const folderPath = path.join(PAGES_DIR, folderName);

    if (isUselessExpandedFolder(folderName, folderPath)) {
      const analysis = analyzeFolder(folderPath);

      // Calculate folder size
      let folderSize = 0;
      analysis.files.forEach(file => {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        folderSize += stats.size;
      });

      uselessFolders.push({
        name: folderName,
        path: folderPath,
        size: folderSize,
        files: analysis.files
      });

      uselessCount++;
      totalSize += folderSize;
    }
  }

  // Display summary
  console.log(`\n📋 Summary:`);
  console.log(`   Total folders: ${allFolders.length}`);
  console.log(`   Useless folders: ${uselessCount}`);
  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  if (uselessCount === 0) {
    console.log("✅ No useless folders found!");
    return;
  }

  // Display first 10 examples
  console.log(`🗑️  Examples of folders to be deleted:\n`);
  uselessFolders.slice(0, 10).forEach((folder, idx) => {
    console.log(`   ${idx + 1}. ${folder.name}`);
    console.log(`      Files: ${folder.files.join(", ")}`);
    console.log(`      Size: ${(folder.size / 1024).toFixed(2)} KB\n`);
  });

  if (uselessCount > 10) {
    console.log(`   ... and ${uselessCount - 10} more\n`);
  }

  // Perform deletion
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN MODE - No files were deleted`);
    console.log(`   Set DRY_RUN = false to actually delete these folders`);
  } else {
    console.log(`\n🗑️  Deleting ${uselessCount} folders...\n`);

    let deletedCount = 0;
    for (const folder of uselessFolders) {
      try {
        fs.rmSync(folder.path, { recursive: true, force: true });
        deletedCount++;
        if (deletedCount % 10 === 0) {
          console.log(`   Deleted ${deletedCount}/${uselessCount} folders...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to delete ${folder.name}: ${error.message}`);
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} folders`);
    console.log(`   Freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
}

// Run cleanup
try {
  cleanupUselessFolders();
} catch (error) {
  console.error("❌ Error during cleanup:", error);
  process.exit(1);
}
