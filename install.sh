#!/usr/bin/env bash
# 把 dsh-osk-lift 挂到 dsh 的 profile 里（默认 web profile）。
#
# 用法： ./install.sh [profile名]
# 卸载： 把 ~/.dsh/profiles/<profile>/cordis.patch.yml 里
#        "- insert:" 那段（id: osk-lift）删掉即可。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PROFILE="${1:-web}"
PATCH="$HOME/.dsh/profiles/$PROFILE/cordis.patch.yml"

if [ ! -f "$PATCH" ]; then
  echo "找不到 profile 补丁文件：$PATCH" >&2
  echo "先启动一次 dsh web（会生成 profile），再运行这个脚本。" >&2
  exit 1
fi

if grep -q "id: osk-lift" "$PATCH"; then
  echo "已经装过了（$PATCH 里有 id: osk-lift），跳过。"
  exit 0
fi

cat >>"$PATCH" <<EOF

# dsh-osk-lift：屏幕键盘弹出时把界面压到屏幕上方 45%
- insert:
    - id: osk-lift
      name: "$HERE/plugin.mjs"
EOF

echo "已写入：$PATCH"
echo "刷新浏览器页面（F5 / Ctrl+Shift+R）即可生效。"
