const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable inline requires for smaller and faster JS bundle
config.transformer = {
    ...config.transformer,
    getTransformOptions: async () => ({
        transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
        },
    }),
};

// Ensure 'react-native' field is prioritized over 'browser'
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Stub native-only modules that don't work on web
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'better-sqlite3') {
        return {
            filePath: path.resolve(__dirname, 'src/stubs/better-sqlite3.js'),
            type: 'sourceFile',
        };
    }
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
