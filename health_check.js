import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const lineBudget = 500;

function getJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return getJsFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    }).sort();
}

function checkModules() {
    const jsFiles = getJsFiles(path.join(projectRoot, 'js'));
    if (jsFiles.length === 0) throw new Error('No JavaScript modules found in js/.');

    let hasErrors = false;
    console.log(`\n1. Checking syntax across ${jsFiles.length} JavaScript modules...`);
    for (const file of jsFiles) {
        const label = path.relative(projectRoot, file).replace(/\\/g, '/');
        try {
            // Parse only: browser modules must not execute in this Node process.
            execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
            console.log(`  ✅ ${label} passed syntax check.`);
        } catch (error) {
            console.error(`  ❌ ${label} FAILED syntax check!`);
            console.error(error.stderr?.toString().trim() || error.message);
            hasErrors = true;
        }
    }

    console.log(`\n2. Checking module line budgets (target < ${lineBudget} lines; advisory only)...`);
    for (const file of jsFiles) {
        const label = path.relative(projectRoot, file).replace(/\\/g, '/');
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content === '' ? 0 : content.split(/\r?\n/).length - Number(content.endsWith('\n'));
            if (lines >= lineBudget) {
                console.warn(`  ⚠️  ${label} has ${lines} lines. Consider splitting by responsibility.`);
            }
        } catch (error) {
            console.error(`  ❌ Failed to read ${label}: ${error.message}`);
            hasErrors = true;
        }
    }

    // Node catches duplicate explicit exports during parsing, but --check does
    // not resolve imports or re-exports. Browser tests cover module linking.
    console.log('\nScope: syntax and advisory line budgets only. Run browser tests to verify module linking and behavior.');
    return hasErrors;
}

console.log('🔍 Starting Codebase Health Check...');
try {
    const hasErrors = checkModules();
    console.log(hasErrors ? '\n❌ Health check FAILED.' : '\n✅ Health checks PASSED.');
    process.exitCode = hasErrors ? 1 : 0;
} catch (error) {
    console.error(`\n❌ Health check FAILED: ${error.message}`);
    process.exitCode = 1;
}
