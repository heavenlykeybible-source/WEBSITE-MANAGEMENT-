#!/usr/bin/env node

/**
 * Integration Plan for DEPLOYMENT-RUNBOOK-MODULE-1.zip
 * 
 * This script:
 * 1. Analyzes extracted files
 * 2. Detects conflicts with existing repository files
 * 3. Plans reconciliation strategy
 * 4. Prepares files for commit
 * 
 * Usage: node scripts/integration-plan.mjs [--apply]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const TEMP_DIR = '.zip-extract-temp';
const REPO_ROOT = process.cwd();
const APPLY_MODE = process.argv.includes('--apply');

console.log('🔄 Integration Plan for DEPLOYMENT-RUNBOOK-MODULE-1\n');
console.log(`Mode: ${APPLY_MODE ? 'APPLY (will move files)' : 'PLAN ONLY (dry-run)'}\n`);

// Verify extraction exists
if (!existsSync(TEMP_DIR)) {
  console.error(`❌ ERROR: ${TEMP_DIR} not found. Run extraction first:`);
  console.error('   node scripts/extract-deployment-runbook.mjs\n');
  process.exit(1);
}

// File categorization and reconciliation rules
const reconciliationRules = {
  '.env.example': {
    target: '.env.example',
    strategy: 'merge',
    conflict: 'reference_only',
    action: 'Compare and update if newer'
  },
  '.gitignore': {
    target: '.gitignore',
    strategy: 'merge',
    conflict: 'combine_entries',
    action: 'Merge all entries, remove duplicates'
  },
  '.github/workflows/ci.yml': {
    target: '.github/workflows/ci.yml',
    strategy: 'replace',
    conflict: 'check_first',
    action: 'Review before replacing - critical workflow'
  },
  'docs/MEDIA-ENGINE-MIGRATION.md': {
    target: 'docs/MEDIA-ENGINE-MIGRATION.md',
    strategy: 'preserve',
    conflict: 'check_only',
    action: 'Add if missing, do not overwrite'
  },
  'migrations/': {
    target: 'migrations/',
    strategy: 'preserve_sequence',
    conflict: 'verify_count',
    action: 'Add all migrations, verify sequence'
  },
  'frontend-prototypes/': {
    target: 'frontend-prototypes/',
    strategy: 'add_new',
    conflict: 'allow_new',
    action: 'Add all frontend prototype files'
  },
  'heavenly-key-website/': {
    target: 'heavenly-key-website/',
    strategy: 'add_new',
    conflict: 'allow_new',
    action: 'Add all website files'
  }
};

console.log('📋 File Analysis & Reconciliation Plan\n');
console.log('═'.repeat(70) + '\n');

// Collect all extracted files
function getAllFiles(dir, prefix = '') {
  const files = [];
  try {
    const entries = readdirSync(dir);
    entries.forEach(entry => {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else {
        files.push({
          path: relativePath,
          fullPath,
          size: stat.size,
          isDirectory: false
        });
      }
    });
  } catch (e) {
    console.error(`Warning: Could not read ${dir}: ${e.message}`);
  }
  return files;
}

const extractedFiles = getAllFiles(TEMP_DIR);
const integrationPlan = [];

console.log(`Found ${extractedFiles.length} files to integrate:\n`);

// Categorize and plan each file
extractedFiles.forEach(file => {
  const sourceRelative = file.path;
  const targetPath = sourceRelative;
  const exists = existsSync(targetPath);
  
  let action = 'CREATE';
  let status = '✅';
  let conflict = false;
  
  if (exists) {
    // Check what kind of conflict
    const existingStat = statSync(targetPath);
    if (existingStat.isDirectory()) {
      // Directory exists - will be merged
      action = 'MERGE';
      status = '🔄';
    } else {
      // File exists - requires reconciliation
      action = 'REVIEW';
      status = '⚠️';
      conflict = true;
      
      // Check file sizes to detect changes
      const existingSize = existingStat.size;
      const extractedSize = file.size;
      if (Math.abs(existingSize - extractedSize) > 100) {
        console.log(`  ${status} ${targetPath}`);
        console.log(`     Status: FILE EXISTS (existing: ${existingSize}B, extracted: ${extractedSize}B)`);
        console.log(`     Action: Review differences before overwriting\n`);
      }
    }
  } else {
    console.log(`  ${status} ${targetPath}`);
    console.log(`     Status: NEW FILE\n`);
  }
  
  integrationPlan.push({
    source: sourceRelative,
    target: targetPath,
    fullPath: file.fullPath,
    action,
    conflict,
    exists
  });
});

console.log('\n' + '═'.repeat(70) + '\n');

// Summary
const creates = integrationPlan.filter(p => p.action === 'CREATE' && !p.exists).length;
const reviews = integrationPlan.filter(p => p.action === 'REVIEW' || p.conflict).length;
const merges = integrationPlan.filter(p => p.action === 'MERGE').length;

console.log('📊 Integration Summary:\n');
console.log(`  New files to create:     ${creates}`);
console.log(`  Files requiring review:  ${reviews}`);
console.log(`  Directories to merge:    ${merges}`);
console.log(`  Total files:             ${integrationPlan.length}\n`);

// Critical files to review
console.log('⚠️  Critical Files Requiring Review:\n');
const criticalFiles = [
  '.github/workflows/ci.yml',
  'wrangler.toml',
  'package.json',
  'migrations/0026_live_broadcast_single_session.sql'
];

criticalFiles.forEach(file => {
  const found = integrationPlan.find(p => p.target === file);
  if (found) {
    console.log(`  ${found.exists ? '⚠️' : '✅'} ${file}`);
    if (found.exists && found.conflict) {
      console.log(`     → File exists and will be updated`);
    }
  }
});

console.log('\n' + '═'.repeat(70) + '\n');

// Migration validation
console.log('🗄️  Migration Validation:\n');
const migrationFiles = extractedFiles.filter(f => f.path.startsWith('migrations/'));
console.log(`  Extracted migrations: ${migrationFiles.length}`);
if (migrationFiles.length > 0) {
  console.log(`  Files:`);
  migrationFiles.forEach(f => {
    console.log(`    - ${f.path}`);
  });
}

const existingMigrations = existsSync('migrations') 
  ? readdirSync('migrations').filter(f => f.endsWith('.sql')).length 
  : 0;
console.log(`\n  Existing migrations:   ${existingMigrations}`);
console.log(`  Total after merge:     ${existingMigrations + migrationFiles.length}`);

if (existingMigrations + migrationFiles.length !== 28) {
  console.log(`\n  ⚠️  Expected 28 migrations per AUDIT-STATUS.md`);
  console.log(`      Current count: ${existingMigrations + migrationFiles.length}`);
  console.log(`      Discrepancy: ${28 - (existingMigrations + migrationFiles.length)}`);
}

console.log('\n' + '═'.repeat(70) + '\n');

// Frontend validation
console.log('🎨 Frontend Files:\n');
const frontendFiles = extractedFiles.filter(f => 
  f.path.includes('frontend') || 
  f.path.includes('heavenly-key-website') ||
  f.path.includes('public')
);
console.log(`  Frontend files found: ${frontendFiles.length}\n`);
if (frontendFiles.length > 0 && frontendFiles.length <= 20) {
  frontendFiles.forEach(f => {
    console.log(`    - ${f.path}`);
  });
} else if (frontendFiles.length > 20) {
  frontendFiles.slice(0, 10).forEach(f => {
    console.log(`    - ${f.path}`);
  });
  console.log(`    ... and ${frontendFiles.length - 10} more`);
}

console.log('\n' + '═'.repeat(70) + '\n');

// Media Engine
console.log('⚡ Media Engine:\n');
const mediaEngineFiles = extractedFiles.filter(f => f.path.startsWith('media-engine/'));
console.log(`  Media Engine files found: ${mediaEngineFiles.length}\n`);
if (mediaEngineFiles.length > 0) {
  mediaEngineFiles.forEach(f => {
    console.log(`    - ${f.path}`);
  });
} else {
  console.log('  ⚠️  No Media Engine files in this runbook');
  console.log('     Media Engine preserved from existing repository');
}

console.log('\n' + '═'.repeat(70) + '\n');

if (APPLY_MODE) {
  console.log('🚀 APPLYING INTEGRATION...\n');
  
  // Create necessary directories
  const dirsToCreate = new Set();
  integrationPlan.forEach(p => {
    const dir = dirname(p.target);
    if (dir !== '.') dirsToCreate.add(dir);
  });
  
  dirsToCreate.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  📁 Created directory: ${dir}`);
    }
  });
  
  console.log('\n');
  
  // Copy files
  let copiedCount = 0;
  integrationPlan.forEach(p => {
    try {
      const content = readFileSync(p.fullPath);
      mkdirSync(dirname(p.target), { recursive: true });
      writeFileSync(p.target, content);
      console.log(`  ✅ ${p.target}`);
      copiedCount++;
    } catch (e) {
      console.log(`  ❌ ${p.target} - ${e.message}`);
    }
  });
  
  console.log(`\n✅ Integration complete: ${copiedCount} files copied\n`);
  console.log('Next steps:');
  console.log('1. Review changes: git status');
  console.log('2. Run tests: npm test');
  console.log('3. Deploy: npm run deploy:staging\n');
  
} else {
  console.log('✅ Plan complete (dry-run)\n');
  console.log('To apply this plan, run:\n');
  console.log('  node scripts/integration-plan.mjs --apply\n');
}
