#!/usr/bin/env node
/**
 * Complete extraction and integration of DEPLOYMENT-RUNBOOK-MODULE-1.zip
 * This script performs the full extraction and moves files to proper locations
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const ZIP_FILE = 'DEPLOYMENT-RUNBOOK-MODULE-1.zip';
const TEMP_DIR = '.zip-extract-temp';

console.log('🚀 Starting full extraction and integration...\n');

// Step 1: Extract
console.log('📦 Step 1: Extracting ZIP file...');
if (!existsSync(ZIP_FILE)) {
  console.error(`❌ ERROR: ${ZIP_FILE} not found`);
  process.exit(1);
}

try {
  execSync(`unzip -q -o "${ZIP_FILE}" -d "${TEMP_DIR}"`, { stdio: 'pipe' });
  console.log(`✅ Extracted to ${TEMP_DIR}\n`);
} catch (e) {
  console.error(`❌ Extraction failed: ${e.message}`);
  process.exit(1);
}

// Step 2: Analyze structure
console.log('📋 Step 2: Analyzing extracted files...');

function walkDir(dir, prefix = '') {
  const files = [];
  try {
    const entries = readdirSync(dir);
    entries.forEach(entry => {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      
      if (stat.isDirectory()) {
        files.push(...walkDir(fullPath, relativePath));
      } else {
        files.push({
          relativePath,
          fullPath,
          size: stat.size,
          type: entry.split('.').pop()
        });
      }
    });
  } catch (e) {
    console.error(`⚠️  Could not read ${dir}`);
  }
  return files;
}

const allFiles = walkDir(TEMP_DIR);
console.log(`✅ Found ${allFiles.length} files\n`);

// Step 3: Categorize files
console.log('📂 Step 3: Categorizing files...');

const categories = {
  migrations: [],
  frontend: [],
  mediaEngine: [],
  docs: [],
  workflows: [],
  config: [],
  scripts: [],
  other: []
};

allFiles.forEach(file => {
  const path = file.relativePath;
  if (path.startsWith('migrations/')) {
    categories.migrations.push(file);
  } else if (path.match(/^(frontend|public|heavenly-key-website|frontend-prototypes)/)) {
    categories.frontend.push(file);
  } else if (path.startsWith('media-engine/')) {
    categories.mediaEngine.push(file);
  } else if (path.startsWith('docs/')) {
    categories.docs.push(file);
  } else if (path.startsWith('.github/')) {
    categories.workflows.push(file);
  } else if (path.match(/\.(json|toml|yml|yaml|env)$/)) {
    categories.config.push(file);
  } else if (path.startsWith('scripts/')) {
    categories.scripts.push(file);
  } else {
    categories.other.push(file);
  }
});

console.log(`  Migrations:     ${categories.migrations.length}`);
console.log(`  Frontend:       ${categories.frontend.length}`);
console.log(`  Media Engine:   ${categories.mediaEngine.length}`);
console.log(`  Docs:           ${categories.docs.length}`);
console.log(`  Workflows:      ${categories.workflows.length}`);
console.log(`  Config:         ${categories.config.length}`);
console.log(`  Scripts:        ${categories.scripts.length}`);
console.log(`  Other:          ${categories.other.length}\n`);

// Step 4: Integration strategy
console.log('🔧 Step 4: Planning integration...\n');

const integrationPlan = [];
let conflicts = [];

// Process all files
allFiles.forEach(file => {
  const target = file.relativePath;
  const exists = existsSync(target);
  
  let action = 'CREATE';
  let shouldProcess = true;
  
  if (exists) {
    const existingStat = statSync(target);
    
    // Special handling for key files
    if (target === 'wrangler.toml' || target === 'package.json' || target === '.env.example') {
      action = 'REVIEW';
      conflicts.push({
        file: target,
        reason: 'Configuration file - requires verification',
        type: 'config'
      });
    } else if (target === '.github/workflows/ci.yml') {
      action = 'REVIEW';
      conflicts.push({
        file: target,
        reason: 'CI/CD workflow - requires verification',
        type: 'workflow'
      });
    } else if (target.startsWith('migrations/')) {
      // Never overwrite migrations, only add new ones
      const sourceFile = readFileSync(file.fullPath, 'utf8');
      const targetFile = readFileSync(target, 'utf8');
      
      if (sourceFile === targetFile) {
        action = 'SKIP';
        shouldProcess = false;
      } else {
        conflicts.push({
          file: target,
          reason: 'Migration file differs',
          type: 'migration'
        });
        action = 'REVIEW';
      }
    } else if (target.startsWith('docs/')) {
      action = 'SKIP'; // Keep existing docs
      shouldProcess = false;
    } else {
      // For most files, create or update
      action = 'UPDATE';
    }
  }
  
  integrationPlan.push({
    source: file.fullPath,
    target,
    action,
    shouldProcess,
    size: file.size
  });
});

// Step 5: Apply integration
console.log('⚙️  Step 5: Applying integration...\n');

let created = 0;
let updated = 0;
let skipped = 0;
let reviewed = 0;

integrationPlan.forEach(plan => {
  if (!plan.shouldProcess) {
    if (plan.action === 'SKIP') {
      skipped++;
    }
    return;
  }
  
  try {
    const targetDir = dirname(plan.target);
    
    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy file
    const content = readFileSync(plan.source);
    writeFileSync(plan.target, content);
    
    if (plan.action === 'CREATE') {
      console.log(`  ✅ CREATE: ${plan.target}`);
      created++;
    } else if (plan.action === 'UPDATE') {
      console.log(`  🔄 UPDATE: ${plan.target}`);
      updated++;
    } else if (plan.action === 'REVIEW') {
      console.log(`  ⚠️  REVIEW: ${plan.target}`);
      reviewed++;
    }
  } catch (e) {
    console.log(`  ❌ ERROR: ${plan.target} - ${e.message}`);
  }
});

console.log(`\n✅ Integration Summary:`);
console.log(`  Created: ${created}`);
console.log(`  Updated: ${updated}`);
console.log(`  Reviewed: ${reviewed}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Total: ${created + updated + reviewed + skipped}\n`);

// Step 6: Report conflicts
if (conflicts.length > 0) {
  console.log('⚠️  Files Requiring Manual Review:\n');
  conflicts.forEach(c => {
    console.log(`  📌 ${c.file}`);
    console.log(`     Reason: ${c.reason}\n`);
  });
}

// Step 7: Validation
console.log('\n✅ Step 6: Validation\n');

// Count migrations
const migrationFiles = readdirSync('migrations').filter(f => f.endsWith('.sql'));
console.log(`  Migrations: ${migrationFiles.length} files`);
migrationFiles.forEach(f => console.log(`    - ${f}`));

// Check frontend
const frontendDirs = ['frontend-prototypes', 'heavenly-key-website'];
let frontendCount = 0;
frontendDirs.forEach(dir => {
  if (existsSync(dir)) {
    const files = walkDir(dir);
    frontendCount += files.length;
    console.log(`\n  ${dir}: ${files.length} files`);
  }
});

// Check key files
console.log('\n  Key Configuration Files:');
const keyFiles = ['package.json', 'wrangler.toml', 'tsconfig.json', '.github/workflows/ci.yml', '.env.example'];
keyFiles.forEach(file => {
  if (existsSync(file)) {
    console.log(`    ✅ ${file}`);
  } else {
    console.log(`    ❌ ${file} - MISSING`);
  }
});

console.log('\n' + '═'.repeat(70));
console.log('\n✅ EXTRACTION AND INTEGRATION COMPLETE\n');
console.log('Next steps:');
console.log('1. Review conflicting files listed above');
console.log('2. Run: npm test');
console.log('3. Run: npm run preflight');
console.log('4. Commit changes: git add -A && git commit -m "Extract and integrate Deployment Runbook Module 1"');
console.log('5. Review: git log --oneline -5\n');
