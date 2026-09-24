// Electron main process for fork-scratch-editor desktop.
// Serves the built scratch-gui (desktop/build) over a local http server and loads
// it in a BrowserWindow. A local server avoids file:// quirks (fetch, workers, etc.)
const { app, BrowserWindow, Menu, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'build');
// Locally bundled library assets (sprites/backdrops/costumes/sounds). In packaged builds
// electron-builder copies this via extraResources into process.resourcesPath.
const LIBRARY_ASSETS_DIR = process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'library-assets'))
    ? path.join(process.resourcesPath, 'library-assets')
    : path.join(__dirname, 'library-assets');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
    '.hex': 'application/octet-stream'
};

function safeJoin(root, requestPath) {
    const resolved = path.normalize(path.join(root, requestPath));
    if (!resolved.startsWith(root)) return null; // path traversal guard
    return resolved;
}

// Serve bundled library assets for /internalapi/asset/<md5>.<ext>/get/ (the URL shape
// scratch-storage builds). Falls through with 404 when the asset is not bundled.
function serveLibraryAsset(assetName, res) {
    const filePath = safeJoin(LIBRARY_ASSETS_DIR, assetName);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Asset not bundled');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

// Redirect all scratch asset requests to this same origin, so the bundled copies
// in LIBRARY_ASSETS_DIR are used instead of the unreachable assets.scratch.mit.edu.
const ASSET_HOST_SNIPPET = '<script>window.SCRATCH_ASSET_HOST = window.location.origin;</script>';

function serveIndex(res) {
    fs.readFile(path.join(BUILD_DIR, 'index.html'), (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const html = data.toString('utf8').replace('<head>', `<head>${ASSET_HOST_SNIPPET}`);
        res.writeHead(200, {'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache'});
        res.end(html);
    });
}

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            try {
                let urlPath = decodeURIComponent(req.url.split('?')[0]);
                if (urlPath === '/' || urlPath === '/index.html') {
                    serveIndex(res);
                    return;
                }
                // Locally served scratch asset API: /internalapi/asset/<md5>.<ext>/get/
                const assetMatch = urlPath.match(/^\/internalapi\/asset\/([A-Za-z0-9.-]+)\/get\/?$/);
                if (assetMatch) {
                    serveLibraryAsset(assetMatch[1], res);
                    return;
                }
                let filePath = safeJoin(BUILD_DIR, urlPath);
                if (!filePath) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }
                fs.stat(filePath, (err, stat) => {
                    if (err || !stat.isFile()) {
                        // SPA fallback to index.html
                        serveIndex(res);
                        return;
                    }
                    fs.readFile(filePath, (e2, data) => {
                        if (e2) {
                            res.writeHead(404);
                            res.end('Not found');
                            return;
                        }
                        const ext = path.extname(filePath).toLowerCase();
                        res.writeHead(200, {
                            'Content-Type': MIME[ext] || 'application/octet-stream',
                            'Cache-Control': 'no-cache'
                        });
                        res.end(data);
                    });
                });
            } catch (e) {
                res.writeHead(500);
                res.end('Server error');
            }
        });
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve(`http://127.0.0.1:${port}`);
        });
    });
}

function createWindow(url) {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#ffffff',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadURL(url);

    // scratch-gui sets window.onbeforeunload to guard unsaved changes. Chromium's
    // own beforeunload dialog is unreliable in Electron (it can render invisibly,
    // leaving the window unclosable). Take over here: when the page tries to block
    // the unload, show our own always-visible dialog instead.
    win.webContents.on('will-prevent-unload', (event) => {
        const choice = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['退出', '取消'],
            defaultId: 0,
            cancelId: 1,
            title: 'Fork Scratch',
            message: '当前作品可能未保存，确定退出吗？',
            detail: '未保存的作品将丢失，可先通过「文件 → 保存到电脑」下载 .sb3 文件。'
        });
        if (choice === 0) {
            // Allow the unload despite the page's beforeunload guard.
            event.preventDefault();
        }
        // Otherwise do nothing: the page keeps blocking the unload and the window stays.
    });

    // Minimal menu (File > Quit on Windows/Linux).
    const template = [
        {
            label: 'File',
            submenu: [{ role: 'quit' }]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'toggleDevTools' }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    return win;
}

app.whenReady().then(async () => {
    const url = await startServer();
    createWindow(url);
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
