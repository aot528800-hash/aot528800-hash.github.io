#!/usr/bin/env bash
# 一键部署：构建静态站点 → 提交 → 推 master → 推 gh-pages
#
# 用法：
#   ./deploy.sh                  # 自动生成提交信息
#   ./deploy.sh "提交说明"        # 自定义提交信息
#
# 凭据：自动从 git 凭据助手（GCM）读取已保存的 GitHub token，
#       不弹窗、不写入 .git/config、不落盘。

set -uo pipefail
cd "$(dirname "$0")" || exit 1

MSG="${1:-}"
REMOTE_NAME="__deploy_tmp__"
REPO_URL="https://github.com/aot528800-hash/aot528800-hash.github.io.git"

# 退出时无论成败都清掉临时远端，避免 token 留在 .git/config
cleanup() {
  git remote remove "$REMOTE_NAME" >/dev/null 2>&1
}
trap cleanup EXIT

step() { printf '\n\033[36m== %s ==\033[0m\n' "$1"; }
fail() { printf '\033[31m失败：%s\033[0m\n' "$1" >&2; exit 1; }

step "1/5 构建站点"
npm run build:site || fail "构建失败"
[ -f site/ima.html ] || echo "提示：site/ima.html 不存在，检查 scripts/build-site.mjs"

step "2/5 提交改动"
git add -A
if git diff --cached --quiet; then
  echo "没有需要提交的改动，跳过提交"
else
  if [ -z "$MSG" ]; then
    MSG="chore(site): 重新构建 $(date '+%Y-%m-%d %H:%M')"
  fi
  git commit -m "$MSG" || fail "提交失败"
  git log --oneline -1
fi

step "3/5 读取 GitHub 凭据"
CRED=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null) || true
TOKEN=$(printf '%s\n' "$CRED" | grep '^password=' | cut -d= -f2-)
USER_NAME=$(printf '%s\n' "$CRED" | grep '^username=' | cut -d= -f2-)
TOKEN="${TOKEN:-${GITHUB_TOKEN:-}}"
USER_NAME="${USER_NAME:-aot528800-hash}"
[ -n "$TOKEN" ] || fail "取不到 token。请先在普通终端执行一次 git push 完成登录，或设置 GITHUB_TOKEN 环境变量"
echo "凭据就绪：$USER_NAME（token ${#TOKEN} 字节）"

# 临时远端：只在本次运行期间存在
git remote remove "$REMOTE_NAME" >/dev/null 2>&1
git remote add "$REMOTE_NAME" "https://${USER_NAME}:${TOKEN}@github.com/aot528800-hash/aot528800-hash.github.io.git"

mask() { sed -E "s/${TOKEN}/***/g"; }

step "4/5 推送 master"
GIT_TERMINAL_PROMPT=0 git push "$REMOTE_NAME" master 2>&1 | mask | tail -5
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "master 推送失败"

step "5/5 发布 gh-pages"
GIT_TERMINAL_PROMPT=0 git subtree push --prefix site "$REMOTE_NAME" gh-pages 2>&1 | mask | tail -5
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "gh-pages 推送失败"

# 推送后校验远端确实拿到了内容
git fetch origin gh-pages >/dev/null 2>&1
if git ls-tree --name-only FETCH_HEAD | grep -qx "ima.html"; then
  echo "远端校验：gh-pages 已包含 ima.html ✅"
else
  echo "远端校验：未找到 ima.html（Pages 可能还在构建）" >&2
fi

printf '\n\033[32m完成\033[0m\n'
echo "  https://aot528800-hash.github.io/"
echo "  https://aot528800-hash.github.io/ima.html"
echo "Pages 生效通常需要 30–60 秒，浏览器请强制刷新（Ctrl+F5）。"
