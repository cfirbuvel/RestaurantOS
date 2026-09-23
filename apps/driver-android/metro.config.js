const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Map modules
config.resolver.extraNodeModules = {
  '@/shared': path.resolve(workspaceRoot, 'src/shared'),
  '@': path.resolve(workspaceRoot, 'src'),
  '@restaurantos/shared-mobile': path.resolve(workspaceRoot, 'apps/shared-mobile/src'),
};

module.exports = config;
