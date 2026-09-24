// Preload script for fork-scratch-desktop.
// Runs in an isolated context; exposes a minimal, safe bridge if needed later.
// Currently just a no-op placeholder so the app loads with contextIsolation on.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('forkDesktop', {
    version: '1.0.0'
});
