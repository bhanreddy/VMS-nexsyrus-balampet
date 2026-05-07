/**
 * Ambient declaration for Metro's `require()` used with image/asset imports.
 * This satisfies the TypeScript compiler without pulling in `@types/node`,
 * which can introduce conflicting Node.js globals in a React Native project.
 */
declare function require(id: string): any;
