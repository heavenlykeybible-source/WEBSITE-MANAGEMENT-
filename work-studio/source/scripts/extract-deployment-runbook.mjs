#!/usr/bin/env node

/**
 * Extract and reconcile DEPLOYMENT-RUNBOOK-MODULE-1.zip
 * 
 * This script:
 * 1. Extracts the ZIP into a temporary directory
 * 2. Validates directory structure against expected architecture
 * 3. Reports what will be integrated
 * 4. Identifies any file conflicts
 * 
 * Usage: node scripts/extract-deployment-runbook.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ZIP_FILE = 'DEPLOYMENT-RUNBOOK-MODULE-1.zip';
const TEMP_DIR = '.zip-extract-temp';
const REPO_ROOT = process.cwd();

console.log('🔍 Deployment Runbook Extraction & Reconciliation\n');
console.log(`Repository root: ${REPO_ROOT}`);
console.log(`ZIP file: ${ZIP_FILE}\n`);

// Step 1: Verify ZIP exists
if (!existsSync(ZIP_FILE)) {
  console.error(`❌ ERROR: ${ZIP_FILE} not found in repository root`);
  process.exit(1);
}

console.log(`✅ ZIP file found (${ZIP_FILE})\n`);

// Step 2: Extract ZIP
console.log('📦 Extracting ZIP file...');
try {
  execSync(`unzip -q -o "${ZIP_FILE}" -d "${TEMP_DIR}"`, { stdio: 'inherit' });
  console.log(`✅ Extracted to ${TEMP_DIR}\n`);
} catch (e) {
  console.error(`❌ Failed to extract ZIP: ${e.message}`);
  process.exit(1);
}

// Step 3: List extracted contents
console.log('📋 Extracted contents:\n');
try {
  const listOutput = execSync(`find "${TEMP_DIR}" -type f | sort`, { encoding: 'utf8' });
  console.log(listOutput);
} catch (e) {
  console.error(`Warning: Could not list contents: ${e.message}`);
}

// Step 4: Identify structure
console.log('\n🏗️  Directory Structure Analysis:\n');

const categories = {
  'Configuration': [],
  'Documentation': [],
  'Migrations': [],
  'Source Code': [],
  'Frontend': [],
  'Media Engine': [],
  'GitHub Workflows': [],
  'Tests': [],
  'Scripts': [],
  'Other': []
};

try {
  const allFiles = execSync(`find "${TEMP_DIR}" -type f`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  
  allFiles.forEach(file => {
    const relative = file.replace(`${TEMP_DIR}/`, '');
    
    if (relative.endsWith('.env.example') || relative.endsWith('.toml') || relative.endsWith('.json')) {
      categories['Configuration'].push(relative);
    } else if (relative.match(/^docs\//)) {
      categories['Documentation'].push(relative);
    } else if (relative.match(/^migrations\//)) {
      categories['Migrations'].push(relative);
    } else if (relative.match(/^src\//) && !relative.match(/media-engine/)) {
      categories['Source Code'].push(relative);
    } else if (relative.match(/^(public|frontend|frontend-prototypes|heavenly-key-website)/)) {
      categories['Frontend'].push(relative);
    } else if (relative.match(/^media-engine\//)) {
      categories['Media Engine'].push(relative);
    } else if (relative.match(/^\.github\//)) {
      categories['GitHub Workflows'].push(relative);
    } else if (relative.match(/^(test|spec)\//)) {
      categories['Tests'].push(relative);
    } else if (relative.match(/^scripts\//)) {
      categories['Scripts'].push(relative);
    } else {
      categories['Other'].push(relative);
    }
  });
} catch (e) {
  console.error(`Warning: Could not analyze structure: ${e.message}`);
}

// Print categorized results
let totalFiles = 0;
for (const [category, files] of Object.entries(categories)) {
  if (files.length > 0) {
    console.log(`${category}:`);
    files.forEach(f => console.log(`  - ${f}`));
    totalFiles += files.length;
    console.log('');
  }
}

console.log(`\n📊 Summary: ${totalFiles} files to integrate`);

// Step 5: Conflict detection
console.log('\n⚠️  Conflict Detection:\n');

const conflicts = [];
const existingDirs = ['.github', 'docs', 'migrations', 'src', 'media-engine', 'scripts', 'tests'];

for (const dir of existingDirs) {
  if (existsSync(dir) && categories.hasOwnProperty(dir.replace(/^\./, '').replace('-', ' ').replace(/^\w/, c => c.toUpperCase()))) {
    conflicts.push({
      dir,
      type: 'Directory overlap - may contain updates or new files',
      action: 'Verify each file before overwriting'
    });
  }
}

if (conflicts.length > 0) {
  conflicts.forEach(c => {
    console.log(`⚠️  ${c.dir}`);
    console.log(`   Issue: ${c.type}`);
    console.log(`   Action: ${c.action}\n`);
  });
} else {
  console.log('✅ No obvious conflicts detected\n');
}

// Step 6: Readiness check
console.log('✅ Extraction complete. Ready for integration.\n');
console.log('Next steps:');
console.log('1. Review extracted files in .zip-extract-temp/');
console.log('2. Run: node scripts/integration-plan.mjs');
console.log('3. Review proposed changes');
console.log('4. Run: npm run deploy:staging (after validation)\n');
