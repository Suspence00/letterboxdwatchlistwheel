import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Starting Codebase Health Check...');

let hasErrors = false;

// 1. Gather all JS source files dynamically
function getJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            files = files.concat(getJsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const jsFiles = getJsFiles('js');

console.log(`\n1. Running syntax checks across ${jsFiles.length} JavaScript modules...`);
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

// 2. Check for Duplicate Exported Functions in ui.js
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

// 3. File Size & Line Budget Check
console.log('\n3. Checking Module Line Budgets (Target < 600 lines per module)...');
jsFiles.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    if (lines > 600) {
        console.warn(`  ⚠️  ${file} is large (${lines} lines). Consider decomposing to optimize for AI agents.`);
    }
});

if (hasErrors) {
    console.log('\n❌ Health Check FAILED. Fix errors before committing.');
    process.exit(1);
} else {
    console.log('\n✅ Health checks PASSED. Run browser tests to verify behavior.');
    process.exit(0);
}
