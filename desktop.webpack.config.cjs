// Desktop build config for fork-scratch-editor.
// Reuses scratch-gui's own webpack config but fixes the pnpm + symlinks:false
// "multiple React copies" white-screen problem (same root cause we hit on the dev server),
// and redirects the output into desktop/build so electron-builder can package it.
const path = require('path');
const fs = require('fs');

// Force the playground (file://-loadable) build target.
process.env.BUILD_TYPE = process.env.BUILD_TYPE || 'dev';

const scratchGuiDir = path.resolve(__dirname, 'packages/scratch-gui');
const base = require(path.join(scratchGuiDir, 'webpack.config.js'));

// Resolve a single *physical* copy of react / react-dom / react-is from the scratch-gui
// context (where pnpm hoisted them). We return the package ROOT directory — not the
// index.js file — so that subpath imports like `react/jsx-runtime` resolve correctly.
// (Aliasing to index.js breaks `react/jsx-runtime` -> `index.js/jsx-runtime`.)
const resolvePkgRealDir = (name) =>
    path.dirname(fs.realpathSync(require.resolve(`${name}/package.json`, { paths: [scratchGuiDir] })));

const fix = (cfg) => {
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.symlinks = true; // undo the symlinks:false that causes duplicate React
    cfg.resolve.alias = cfg.resolve.alias || {};
    const reactDir = resolvePkgRealDir('react');
    const reactDomDir = resolvePkgRealDir('react-dom');
    const reactIsDir = resolvePkgRealDir('react-is');
    cfg.resolve.alias.react = reactDir;
    cfg.resolve.alias['react-dom'] = reactDomDir;
    cfg.resolve.alias['react-is'] = reactIsDir;
    // Explicit subpath aliases (belt and suspenders for the automatic JSX runtime).
    cfg.resolve.alias['react/jsx-runtime'] = path.join(reactDir, 'jsx-runtime');
    cfg.resolve.alias['react/jsx-dev-runtime'] = path.join(reactDir, 'jsx-dev-runtime');
    cfg.resolve.alias['react-dom/client'] = path.join(reactDomDir, 'client');
    cfg.mode = 'production';
    cfg.devtool = false;
    cfg.output = cfg.output || {};
    cfg.output.path = path.resolve(__dirname, 'desktop', 'build');
    // Drop the UMD library wrapper so the bundle is a plain browser app.
    if (cfg.output.library) {
        delete cfg.output.library;
    }
    return cfg;
};

module.exports = Array.isArray(base) ? base.map(fix) : fix(base);
