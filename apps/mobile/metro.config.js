const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.unstable_enableSymlinks = true;

// In pnpm hoisted monorepos, expo/AppEntry.js does `import App from '../../App'`.
// The relative path resolves into the .pnpm virtual store, not the project root.
// Intercept every `../../App` resolution and redirect to our bridge file.
const _resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '../../App') {
    return {
      filePath: path.resolve(projectRoot, 'App.js'),
      type: 'sourceFile',
    };
  }
  if (_resolveRequest) {
    return _resolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
