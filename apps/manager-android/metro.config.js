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

// 3. Prevent duplicate react/react-native instances across monorepo packages
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(projectRoot, 'node_modules/react-native-web'),
  '@/shared': path.resolve(workspaceRoot, 'src/shared'),
  '@': path.resolve(workspaceRoot, 'src'),
  '@restaurantos/shared-mobile': path.resolve(workspaceRoot, 'apps/shared-mobile/src'),
};

// 4. Block accidental nested node_modules in packages to ensure singletons
config.resolver.blockList = [
  /.*[/\\]apps[/\\]shared-mobile[/\\]node_modules[/\\].*/,
];

module.exports = config;
