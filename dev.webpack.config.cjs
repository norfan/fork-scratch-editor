// Local dev-only wrapper around scratch-gui's webpack config.
// Purpose: fix the blank-screen "Invalid hook call / useSyncExternalStore of null" error.
//
// Root cause: pnpm installs packages as symlinks, but scratch-gui's webpack config sets
// `resolve.symlinks: false`. That makes webpack treat react-redux's `react` and the app's
// `react` as two separate physical modules -> two React instances -> broken hooks.
// We force a single physical React/ReactDOM instance via `resolve.alias` and re-enable
// symlink following. This file is NOT committed (it's a local run fix).

const path = require('path');
const fs = require('fs');

const scratchGuiDir = path.resolve(__dirname, 'packages/scratch-gui');
const config = require(path.join(scratchGuiDir, 'webpack.config.js'));

const resolvePkgRealDir = (name) =>
    path.dirname(fs.realpathSync(require.resolve(`${name}/package.json`, { paths: [scratchGuiDir] })));

config.resolve = config.resolve || {};
config.resolve.symlinks = true;
config.resolve.alias = config.resolve.alias || {};
config.resolve.alias.react = resolvePkgRealDir('react');
config.resolve.alias['react-dom'] = resolvePkgRealDir('react-dom');
config.resolve.alias['react-is'] = resolvePkgRealDir('react-is');

module.exports = config;
