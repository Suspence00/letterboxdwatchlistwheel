import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Starting Codebase Health Check...');

let hasErrors = false;

// 1. Check for Syntax Errors
console.log('\n1. Checking JS Syntax (node -c)...');
const jsFiles = ['js/ui.js', 'js/main.js', 'js/wheel.js', 'js/utils.js', 'js/state.js', 'js/discord.js', 'js/import.js', 'js/backup.js', 'js/audio.js'];

jsFiles.forEach(file => {
    try {
        execSync(`node -c ${file}`, { stdio: 'pipe' });
        console.log(`  ✅ ${file} passed syntax check.`);
    } catch (e) {
        console.error(`  ❌ ${file} FAILED syntax check!`);
        console.error(e.message);
        hasErrors = true;
    }
});

// 2. Check for Duplicate Exported Functions
console.log('\n2. Checking for Duplicate Exports in ui.js...');
try {
    const content = fs.readFileSync('js/ui.js', 'utf8');
    const regex = /export function (\w+)/g;
    const found = {};
    let match;
    while ((match = regex.exec(content)) !== null) {
        found[match[1]] = (found[match[1]] || 0) + 1;
    }

    const duplicates = Object.entries(found).filter(([name, count]) => count > 1);

    if (duplicates.length > 0) {
        console.error('  ❌ Duplicates found in js/ui.js:');
        duplicates.forEach(([name, count]) => {
            console.error(`     - ${name}: defined ${count} times`);
        });
        hasErrors = true;
    } else {
        console.log('  ✅ No duplicate exports found in js/ui.js.');
    }
} catch (e) {
    console.error('  ❌ Failed to analyze js/ui.js:', e.message);
}

if (hasErrors) {
    console.log('\n❌ Health Check FAILED. Fix errors before committing.');
    process.exit(1);
} else {
    console.log('\n✅ Health Check PASSED. Codebase is stable.');
    process.exit(0);
}
