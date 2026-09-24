# Fork Scratch — 桌面版（Electron）

把 `scratch-gui` 的生产构建包进 Electron，产出可双击运行的 Windows 桌面程序。

## 产出

| 文件 | 说明 |
| --- | --- |
| `dist/ForkScratch-portable.exe` | **单文件便携版**：双击自解压到临时目录运行，发给别人最方便 |
| `dist/ForkScratch-setup.exe` | NSIS 安装包（可选择安装目录，含卸载程序） |

> 体积约 140MB/个（Electron 自带 Chromium 运行时，无法做小）。

## 本地源码结构

- `main.js` — Electron 主进程：用本地 HTTP server（127.0.0.1 随机端口）托管 `build/`，避免 `file://` 的 fetch/worker 限制；并接管 `beforeunload` 关闭确认（见下方「关闭无响应」）
- `preload.js` — 预加载脚本（占位）
- `desktop.webpack.config.cjs` — 复用 scratch-gui 的 webpack 配置，并修复 pnpm 多 React 实例白屏 + 把产物输出到 `build/`
- `package.json` — 含 electron / electron-builder 依赖与 `build` 打包配置
- `resources/icon.ico` — 应用图标（经典 Scratch Cat，打进 exe/安装包）
- `gen_icon.py` — 图标生成脚本（见下）

## 应用图标

图标用的是默认素材里的经典 Scratch Cat（默认项目第一个造型的 SVG）。
生成链路：headless Chrome 把 SVG 渲染成 512x512 PNG → `gen_icon.py` 裁边、居中、输出多尺寸 `resources/icon.ico`（16~256）。

重新生成：

```bash
cd desktop/icon_tmp
# 1) 渲染 SVG（如 icon_raw.png 已存在可跳过）
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --hide-scrollbars --virtual-time-budget=8000 --screenshot=icon_raw.png --window-size=512,512 \
  --default-background-color=FFFFFFFF "file:///F:/Workspace/Buddy/fork/fork-scratch-editor/desktop/icon_tmp/icon.html"
# 2) 生成 ico
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" ../gen_icon.py
```

改图标只需替换 `icon_tmp/icon.html` 里的 SVG 再跑一遍上面两步。`icon_tmp/` 已加入 .gitignore。

## 关闭窗口无响应（已修复）

**现象**：有时点右上角 ✕ 没反应，窗口关不掉。

**根因**：scratch-gui 会设置 `window.onbeforeunload`（`project-saver-hoc.jsx`，用于拦截未保存的作品）。
Chromium 原生的 beforeunload 确认框在 Electron 里渲染不可靠——有时弹不出来，页面却处于"等待确认"状态，窗口就卡住关不掉。

**修复**：`main.js` 监听 `will-prevent-unload`，当页面试图阻止关闭时，改用 Electron 自带的
`dialog.showMessageBoxSync` 弹出明确的中式确认框（退出 / 取消）。该弹窗始终可见，选「退出」必定关闭。

## 一键重新构建（本机已配好）

```bash
cd F:/Workspace/Buddy/fork/fork-scratch-editor/desktop

# 1) 安装 Electron（首次需要；二进制走国内镜像，见下）
npm install
#    若 electron 二进制下载失败，设置镜像后重试：
#    ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npm install

# 2) 构建前端（生产构建，输出到 desktop/build）
cd ../packages/scratch-gui
NODE_ENV=production node "$(node -e "console.log(require.resolve('webpack/bin/webpack.js'))")" --config ../../desktop.webpack.config.cjs

# 3) 打包成 exe（winCodeSign/nsis 工具走 npmmirror 镜像）
cd ../../desktop
ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/ \
  node node_modules/electron-builder/cli.js --win portable nsis
```

## 关键环境坑（本机已踩过，记录备用）

1. **Electron 二进制下载**：官方从 GitHub Releases 拉（~108MB），本机网络会 `ECONNRESET` 掐断。
   解决：设 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/` 后重装。
2. **electron-builder 工具**：winCodeSign / nsis / nsis-resources 同样从 GitHub 拉，本机不可达。
   解决：设 `ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/`。
3. **pnpm 多 React 实例**：`desktop.webpack.config.cjs` 已通过 `resolve.symlinks=true` + 对
   `react`/`react-dom`/`react-is` 做**目录级 alias** 修复（注意必须是包目录，不能是 `index.js`，
   否则 `react/jsx-runtime` 会拼成 `index.js/jsx-runtime` 导致构建报错）。
4. **沙箱 safe-delete 误报**：打包成功后 electron-builder 清理中间 `*.nsis.7z` 时会撞沙箱批量删除保护，
   报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`——这是收尾清理失败，**exe 本身已正常生成**，可忽略。

## 素材库本地化（解决"选择背景/角色全是空白"）

**根因**：素材库的名称列表打包在本地，但缩略图与素材本体从 `assets.scratch.mit.edu` 在线加载，
该域名在国内被 SNI 级封锁（换 Fastly IP 也无效），因此列表有名字、图片全空白，点选素材也会加载失败。

**方案**：把全部 1347 个素材文件（svg 804 / png 193 / wav 350）下载到本地打进 exe：

1. `legacy-library-asset-url.ts` / `legacy-storage.ts` 支持 `window.SCRATCH_ASSET_HOST` 覆盖资源主机；
2. `main.js` 在返回 `index.html` 时注入 `window.SCRATCH_ASSET_HOST = location.origin`，并在
   `/internalapi/asset/<md5>.<ext>/get/` 路由上返回 `library-assets/` 里的本地文件；
3. `electron-builder` 通过 `extraResources` 把 `library-assets/` 打进安装产物。

**下载素材**（需要一次能访问 Scratch 的网络，代理或 VPN 均可，之后永久离线可用）：

```bash
cd desktop
# 直连（多数国内网络不可用）
python download_library_assets.py
# 通过本地代理下载（按实际代理端口修改）
python download_library_assets.py --proxy http://127.0.0.1:7890
```

脚本特性：按 md5 校验每个文件完整性、已下载且校验通过的自动跳过（可中断续跑）、6 并发。
下载完成后重新执行下方「一键重新构建」即可。

## 离线说明（与 Web 版一致）

- 素材库已按上节本地化后：背景/角色/造型/声音库完全离线可用。
- 始终离线不可用：micro:bit 烧录（占位固件）、翻译/文字转语音扩展（走云 API）、登录/云端/分享。
