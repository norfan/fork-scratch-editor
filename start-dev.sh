#!/usr/bin/env bash
# Scratch GUI 本地一键启动脚本（fork-scratch-editor）
# 用法（在 Git Bash 中）：
#   ./start-dev.sh            # 正常启动（默认端口 8601）
#   PORT=8602 ./start-dev.sh  # 指定端口
#   ./start-dev.sh --install  # 依赖缺失/损坏时，先重装再启动
set -e

# 1) 补齐环境 PATH（Git 自带 usr/bin 提供 bash/env 等；node 提供运行时）
export PATH="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:$PATH"

# 2) 定位仓库根目录（无论当前在哪个目录运行都正确）
#    用 pwd -W 输出 Windows 原生路径（如 F:/Workspace/...），避免把 POSIX 路径 /f/... 传给
#    原生 Windows 版 node 时被误读成 "F 盘根目录下的 f 子目录"（导致 Cannot find module 'F:\f\...'）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
GUI_DIR="$SCRIPT_DIR/packages/scratch-gui"

# 3) 可选：显式重装依赖
if [ "$1" = "--install" ]; then
    echo "[start-dev] 安装依赖（pnpm，走全局 store，约 1 分钟）..."
    (cd "$SCRIPT_DIR" && pnpm install --shamefully-hoist --prefer-offline)
fi

# 4) 依赖缺失则自动安装
if ! node -e "require.resolve('webpack/bin/webpack.js')" 2>/dev/null; then
    echo "[start-dev] 未找到 webpack，自动安装依赖..."
    (cd "$SCRIPT_DIR" && pnpm install --shamefully-hoist --prefer-offline)
fi

# 5) 启动 dev server
cd "$GUI_DIR"
WEBPACK_BIN="$(node -e "console.log(require.resolve('webpack/bin/webpack.js'))")"
PORT="${PORT:-8601}"
echo "[start-dev] 启动 Scratch GUI dev server → http://localhost:${PORT}/"
exec node "$WEBPACK_BIN" serve --config "$SCRIPT_DIR/dev.webpack.config.cjs" --port "$PORT"
