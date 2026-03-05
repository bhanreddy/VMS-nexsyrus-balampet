const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

const sourceFiles = project.getSourceFiles();
let count = 0;

for (const sourceFile of sourceFiles) {
    if (sourceFile.getFilePath().includes('node_modules')) continue;

    const getStylesDecl = sourceFile.getVariableDeclaration('getStyles') || sourceFile.getFunction('getStyles');
    if (!getStylesDecl) continue;

    let paramCount = 2; // Default
    const initializer = getStylesDecl.getInitializer ? getStylesDecl.getInitializer() : null;
    if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
        paramCount = initializer.getParameters().length;
    } else if (getStylesDecl.getKind() === SyntaxKind.FunctionDeclaration) {
        paramCount = getStylesDecl.getParameters().length;
    }

    let modified = false;

    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
        // Check if what's being called is `getStyles`
        if (call.getExpression().getText() === 'getStyles') {
            const args = call.getArguments();
            if (args.length > paramCount) {
                for (let i = args.length - 1; i >= paramCount; i--) {
                    call.removeArgument(i);
                }
                modified = true;
            }
        }
    }

    // Find useMemo to update dependencies array
    const useMemos = calls.filter(c => c.getExpression().getText() === 'React.useMemo' || c.getExpression().getText() === 'useMemo');
    for (const call of useMemos) {
        const args = call.getArguments();
        // Quick heuristic: If we see `getStyles` in the first argument text, we update deps
        if (args.length === 2 && args[0].getText().includes('getStyles') && args[1].getKind() === SyntaxKind.ArrayLiteralExpression) {
            if (paramCount === 0 && args[1].getText() !== '[]') {
                args[1].replaceWithText('[]');
                modified = true;
            } else if (paramCount === 1 && args[1].getText() !== '[theme]') {
                args[1].replaceWithText('[theme]');
                modified = true;
            }
        }
    }

    if (modified) {
        sourceFile.saveSync();
        console.log(`Fixed getStyles calls in: ${sourceFile.getFilePath()}`);
        count++;
    }
}

console.log(`\nFixed total of ${count} files.`);
