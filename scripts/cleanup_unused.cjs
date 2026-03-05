const { Project } = require('ts-morph');
const path = require('path');

const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
});

project.addSourceFilesAtPaths([
    path.join(__dirname, '../src/**/*.{ts,tsx,js,jsx}'),
    path.join(__dirname, '../app/**/*.{ts,tsx,js,jsx}')
]);

let totalUnusedRemoved = 0;

const sourceFiles = project.getSourceFiles();

// Array of error codes related to unused variables
const unusedErrorCodes = [6133, 6192, 6196, 6198, 6199, 6205]; // TS codes for unused locals, parameters, imports

for (const sourceFile of sourceFiles) {
    if (sourceFile.getFilePath().includes('node_modules')) continue;

    // To avoid breaking things blindly, let's fix unused identifiers
    // ts-morph provides fixUnusedIdentifiers() which removes unused imports and variables safely.

    try {
        const startText = sourceFile.getFullText();
        sourceFile.fixUnusedIdentifiers();
        const endText = sourceFile.getFullText();

        if (startText !== endText) {
            console.log(`Fixed unused identifiers in: ${sourceFile.getFilePath()}`);
            sourceFile.saveSync();
            totalUnusedRemoved++;
        }
    } catch (e) {
        console.error(`Error processing ${sourceFile.getFilePath()}:`, e.message);
    }
}

console.log(`\nFixed unused identifiers in ${totalUnusedRemoved} files.`);
