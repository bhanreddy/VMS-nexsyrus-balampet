const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const directoriesToScan = [
    path.join(__dirname, '../src'),
    path.join(__dirname, '../app'),
    path.join(__dirname, '../../SupabaseBackend')
];

let modifiedFiles = [];
let totalConsoleRemovals = 0;
let totalDebuggerRemovals = 0;

function processFile(filePath) {
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('.expo')) return;
    const ext = path.extname(filePath);
    if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return;

    const code = fs.readFileSync(filePath, 'utf-8');

    // Skip if we don't find console or debugger string (fast path)
    if (!code.includes('console.') && !code.includes('debugger')) return;

    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators-legacy'],
        });

        let modified = false;
        let consoleRemovals = 0;
        let debuggerRemovals = 0;

        traverse(ast, {
            CallExpression(p) {
                if (
                    p.node.callee &&
                    p.node.callee.type === 'MemberExpression' &&
                    p.node.callee.object &&
                    p.node.callee.object.type === 'Identifier' &&
                    p.node.callee.object.name === 'console' &&
                    ['log', 'warn', 'error', 'info', 'debug'].includes(p.node.callee.property.name)
                ) {
                    p.remove();
                    modified = true;
                    consoleRemovals++;
                }
            },
            DebuggerStatement(p) {
                p.remove();
                modified = true;
                debuggerRemovals++;
            }
        });

        if (modified) {
            // Generate back to code
            const output = generate(ast, {
                retainLines: true,
                comments: true,
            }, code);

            // Clean up orphaned empty lines that might have been left
            let newCode = output.code.replace(/^\s*[\r\n]/gm, '\n');

            fs.writeFileSync(filePath, newCode, 'utf-8');
            modifiedFiles.push({
                file: filePath,
                consoleRemovals,
                debuggerRemovals
            });
            totalConsoleRemovals += consoleRemovals;
            totalDebuggerRemovals += debuggerRemovals;
        }
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e.message);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

directoriesToScan.forEach(dir => {
    console.log(`Scanning ${dir}...`);
    walkDir(dir);
});

console.log("\n=== CLEANUP REPORT ===");
modifiedFiles.forEach(m => {
    console.log(`${m.file}: Removed ${m.consoleRemovals} console logs, ${m.debuggerRemovals} debuggers`);
});
console.log(`\nTotal files modified: ${modifiedFiles.length}`);
console.log(`Total console statements removed: ${totalConsoleRemovals}`);
console.log(`Total debugger statements removed: ${totalDebuggerRemovals}`);
