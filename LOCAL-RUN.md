# Scratch 3.0 编辑器 — 本地运行指南（fork 版）

> 适用于 `fork-scratch-editor`（scratch-editor monorepo, v15.1.1, 编辑器本体 `packages/scratch-gui`）。
> 本文档聚焦**如何在本机跑起来**，以及**运行时哪些资源是本地、哪些依赖远程**。

---

## 1. 环境要求

| 项目 | 说明 |
| --- | --- |
| Node.js | 22.x（本机用 `22.22.2-3` 托管版本） |
| 包管理器 | **pnpm**（npm 的 reify 阶段会死锁，已弃用） |
| Git bash 工具 | 需要 `bash`/`env` 等 coreutils（来自 PortableGit 自带 usr/bin） |
| 浏览器 | 任意现代浏览器（本地访问 `http://localhost:8601`） |

> ⚠️ 若 shell 报 `bash: No such file` 或 `env: 'bash': No such file`，是 PATH 缺 Git 自带工具链，先执行下面的「配置环境 PATH」。

---

## 2. 配置环境 PATH（每次新开 shell 都要）

```bash
export PATH="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:$PATH"
```

---

## 3. 安装依赖

```bash
cd F:/Workspace/Buddy/fork/fork-scratch-editor
pnpm install --shamefully-hoist --prefer-offline
```

说明：
- 项目用 npm `workspaces` 字段，但 **pnpm 不读它**，仓库根已补 `pnpm-workspace.yaml`（`packages: ['packages/*']`）。
- 依赖装在本地 `node_modules`（内容寻址 store 在 `F:\.pnpm-store`），**无运行时 CDN 依赖**。
- 切勿用 `pnpm start` / `pnpm --filter ... start`：pnpm 跑脚本会自动触发重装并清空 `.pnpm` 虚拟存储，破坏 node_modules。

---

## 4. 启动开发服务器（推荐：一键脚本）

仓库根目录已提供 `start-dev.sh`，把"配 PATH + 装依赖 + 起服务"全部封装好了，以后只需一条命令（在 Git Bash 中、于仓库根目录执行）：

```bash
./start-dev.sh              # 正常启动（默认端口 8601）
PORT=8602 ./start-dev.sh   # 指定端口
./start-dev.sh --install   # 依赖缺失/损坏时，先重装再启动
```

脚本会自动：① 配置环境 PATH；② 若检测到未装依赖则自动 `pnpm install`（走全局 store，约 1 分钟）；③ 用 `dev.webpack.config.cjs` 启动 webpack dev server。
启动后浏览器打开 **http://localhost:8601/**。

> 停止：在运行脚本的终端按 `Ctrl+C`；或 `taskkill /F /PID <pid>` 结束占用端口的进程。

### 4.1 手动 / 备用启动（与脚本等价）

```bash
export PATH="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:$PATH"
cd F:/Workspace/Buddy/fork/fork-scratch-editor
pnpm install --shamefully-hoist --prefer-offline   # 仅首次 / 依赖损坏时
cd packages/scratch-gui
node "$(node -e "console.log(require.resolve('webpack/bin/webpack.js'))")" serve --config ../../dev.webpack.config.cjs
```

- 用 `dev.webpack.config.cjs`（仓库根）启动是为了修复白屏，见第 6 节。
- ⚠️ **切勿用 `pnpm start`**：pnpm 跑脚本会自动触发重装并清空 `.pnpm` 虚拟存储，破坏 node_modules。

---

## 5. 本地 vs 远程资源清单

下表是**核心问题**：素材、教程是否都在本地？哪些依赖远程？

| 类别 | 资源 | 本地/远程 | 说明 |
| --- | --- | --- | --- |
| **素材库** | 背景/精灵/造型/声音库的**元数据**（名称、标签、md5ext） | ✅ 本地 | `src/lib/libraries/backdrops.json` `costumes.json` `sprites.json` `sounds.json` |
| **素材库** | 上述库的**实际图片/音频文件**（png/svg/mp3/wav） | ❌ **远程** | 运行时通过 `assetHost` 从 `https://assets.scratch.mit.edu` 拉取（`project-fetcher-hoc.jsx:149` 默认；`legacy-storage.ts:167` 拼 URL）。**首次加载需联网**，之后浏览器 IndexedDB 会缓存，离线可复用已加载过的素材 |
| **默认项目** | 打开编辑器时的初始舞台背景/精灵/造型/声音 | ✅ 本地 | `src/lib/default-project/` 自带 svg（如 `cd21514d…svg` 舞台背景、`bcf454…svg` 造型） |
| **micro:bit 固件** | 烧录用 `.hex` | ⚠️ 本地占位 | 因官方固件下载地址不可达，放了最小占位 hex（`static/microbit/scratch-microbit.hex`），**micro:bit 烧录功能不可用**，其余无影响 |
| **教程** | 教程卡片元数据、步骤文本、**缩略图** | ✅ 本地 | `src/lib/libraries/decks/index.jsx`，缩略图为本地 import 的 svg |
| **教程** | 个别卡片内嵌图片 | ❌ 远程 | `https://code.org/api/hour/begin_scratch_talk.png`、`begin_scratch_adventure.png`（2 处） |
| **教程** | “打开示例项目 / 了解更多”链接 | ❌ 远程 | 指向 `scratch.mit.edu` / `scratchfoundation.org`（仅点击跳转，不影响编辑器） |
| **扩展** | 扩展列表/定义 | ✅ 本地 | `src/lib/libraries/extensions/index.jsx` |
| **扩展** | 画笔(pen)、音乐(music)、视频感知(videoSensing)、人脸感知(faceSensing)、makeymakey | ✅ 本地 | 内置 JS 逻辑；videoSensing/faceSensing 用本地摄像头/模型 |
| **扩展** | 硬件扩展（microbit / wedo2 / ev3 / boost / gdxfor） | ✅ 本地连接 | 通过 Scratch Link / Web Bluetooth 连**本地**设备；其“帮助”链接 ❌ 远程（`scratch.mit.edu/microbit` 等） |
| **扩展** | 翻译(translate)、文字转语音(text2speech) | ❌ **远程 API** | 官方扩展实现依赖在线翻译服务 / 云端 TTS；**离线环境下不可用**（除非替换为本地实现）。具体取决于构建实际包含的扩展 |
| **翻译/语言包** | i18n 语言文件（zh-cn 等） | ✅ 本地 | 来自 `scratch-l10n`（已装进 node_modules），运行时本地加载，**无远程请求** |
| **字体** | UI 字体、favicon | ✅ 本地/系统 | 用系统字体栈（无 @font-face 远程字体）；`favicon.ico` 在 `static/` 本地 |
| **社区/账号** | 登录、保存/分享到 scratch.mit.edu、云变量、社区、跨项目 backpack | ❌ **远程** | 全部依赖 `scratch.mit.edu` API。本地单机不需要；未登录时 cloud variable、save 等功能受限是**正常行为** |
| **代码依赖** | npm/pnpm 包 | ✅ 本地 | 全部装进本地 `node_modules`，无运行时 CDN |

**一句话总结**：编辑器本身的代码、UI、积木、编程、默认项目、教程文本/缩略图都是**本地**的；
会拉远程的是——**素材库里的图片/音频文件**（assets.scratch.mit.edu，有本地缓存）、**个别教程图片/链接**、**翻译/语音扩展的云 API**、以及**社区/账号类功能**（本机调试用不到）。

---

## 6. 已修复的启动问题（记录备查）

1. **白屏 + `Invalid hook call / useSyncExternalStore of null`**
   - 根因：pnpm 符号链接 + `webpack.config.js` 里 `resolve.symlinks: false`，导致同一份 `react@18.3.1` 被解析成两个实例。
   - 修复：新增 `dev.webpack.config.cjs`（不改原配置），强制 `resolve.symlinks = true` 并对 `react`/`react-dom`/`react-is` 做 `resolve.alias` 去重。启动命令末尾加 `--config ../../dev.webpack.config.cjs`。

2. **控制台刷屏 `MISSING_TRANSLATION`（zh-cn）**
   - 根因：`scratch-l10n` 的 **zh-cn 语言包本身缺 `gui.*` 系列 key**（en 是源语言所以不报）；react-intl 已用英文兜底，功能正常，但每条缺失都 `console.error` 刷屏。
   - 修复：`src/lib/connected-intl-provider.jsx` 给 `ReactIntlProvider` 加 `onError`，静默所有 `MISSING_TRANSLATION`（其它 intl 错误仍照常报）。
   - 顺带踩坑：该文件原本无 `import React`，项目是 classic JSX runtime，改用 `createElement(...)` 显式调用，避免顶层 Provider 崩溃为白屏。

3. **micro:bit 固件下载超时**
   - 根因：scratch-gui 的 `prepare` 脚本要下 `downloads.scratch.mit.edu` 的固件，本机不可达。
   - 兜底：手工放占位 `static/microbit/scratch-microbit.hex` + `src/generated/microbit-hex-url.cjs`，构建通过，但烧录功能不可用。

---

## 7. 离线可用 / 不可用 速查

**离线可用（核心创作不受影响）**：积木编程、角色/造型/背景绘制与编辑、声音录制与编辑（录音用本地麦克风）、造型库/声音库（已缓存后）、默认项目、本地保存/加载（**`.sb3` 文件导入导出**；注意未登录时无自动存档，需手动"下载到电脑"）、画笔/音乐/视频感知扩展、硬件扩展（连本地设备）。

**离线不可用（需联网/账号）**：
- 首次浏览素材库（背景/精灵/声音的图片音频需从 `assets.scratch.mit.edu` 拉取，加载一次后缓存）。
- 教程卡片里那 2 张 `code.org` 图片、示例项目/学习库链接。
- 翻译、文字转语音扩展（云 API）。
- 登录、云变量、保存到云端、社区分享、backpack 跨项目。
- micro:bit 烧录（固件占位）。

---

## 8. 故障排查

| 现象 | 处理 |
| --- | --- |
| `bash: No such file` | 先执行第 2 节配置 PATH |
| `npm install` 卡死在 reify | 改用 pnpm（见第 3 节） |
| `pnpm start` 后 node_modules 被破坏 | 永远用「第 4 节」的 `node webpack serve` 命令，不用 pnpm 跑脚本 |
| 页面白屏 / hook 报错 | 确认启动带了 `--config ../../dev.webpack.config.cjs` |
| 控制台 `MISSING_TRANSLATION` 刷屏 | 确认 `connected-intl-provider.jsx` 已含 `onError` 静默（已修） |
| 端口 8601 被占用 | `taskkill /F /PID <pid>` 结束占用进程后重启 |
| 想补全中文翻译 | 需 fork `scratch-l10n` 并补 `gui.*` key，或改用 scratch-gui 自带 translations 流程（当前 zh-cn 不完整，react-intl 用英文兜底） |

---

## 9. 作品保存机制（本地）

未登录（本机调试默认状态）时，Scratch GUI **不会自动把作品存到云端**——云端保存需要 `scratch.mit.edu` 账号与 project host，而 `legacy-storage.ts` 的 `saveProject` 在未设置 host 时会直接 reject `Project host not set`。

本地保存作品的手段：

| 方式 | 入口 | 落点 | 说明 |
| --- | --- | --- | --- |
| **下载到电脑（推荐）** | 文件菜单 → **Save to your computer**（中文界面：文件 ▸ 下载到电脑） | 浏览器**下载文件夹**里的 `.sb3` 文件 | `sb3-downloader.jsx` 把 VM 状态序列化成 `.sb3`（本质是 zip：含 `project.json` + 素材），`download-blob.js` 触发浏览器下载。**这是本地最可靠的保存方式** |
| **从电脑载入** | 文件菜单 → **Load from your computer** | 选择本地 `.sb/.sb2/.sb3` | `sb-file-uploader-hoc.jsx` 读取并载入项目 |
| 浏览器 IndexedDB | 自动 | 浏览器 IndexedDB | ⚠️ 只缓存**素材库资源**（图片/音频），**不保存你的项目文件**；不手动保存就关标签页，作品会丢 |
| localStorage | 自动 | 浏览器 localStorage | 仅存少量 KV（设置/埋点），**不存项目** |

**结论**：本地创作请养成习惯——做完点「下载到电脑」存成 `.sb3`，下次用「从电脑载入」打开。未登录状态下**没有自动云存档**，关掉页面前务必手动保存，否则进度只存在于当前标签页内存里。

> 若希望"刷新不丢、自动本地存档"，需要给 `LegacyStorage` 注册一个 IndexedDB 备份 store（`scratch-storage` 的 `WebStorage` + `addBackupStore`）。这是可选的本地增强，需要时可做。
