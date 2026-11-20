# 静态站视觉回归

针对 `site/`（GitHub Pages 静态站）的视觉与信息完整性回归。原有 `test:unit` / `test:e2e` / `test:static` 覆盖的是 APP（`src/` 与 `dist/`），不覆盖静态站，本工具补上这一空缺。

## 解决什么问题

改静态站的生成脚本 `build-site.mjs` 时，最大风险是"想删装饰，误删信息"。本工具通过改动前后两期对比，用数据回答：**是否只动了装饰层，信息内容是否完整**。

## 判定逻辑

1. **结构锚点硬校验**：政策卡片数、h1/h2/h3 数量、链接数、适用范围与免责声明、页面宽度——任一变化即判 FAIL。
2. **装饰节点自动标记**：抓取时用 `.eyebrow / .hero-eyebrow / .card .tile / .nav-new` 选择器，把装饰元素的文本登记为"允许消失"。无需维护易漏的关键词白名单。
3. **可见文本逐行 diff**：除已标记装饰外，任何信息行被删或新增都判 FAIL。
4. **截图留档**：每页全页 PNG 供人工目视，作为机器判定的补充。

## 使用方法

```bash
# 1) 改动前：在干净产物上抓基线
npm run build:site
npm run visual:baseline

# 2) 改动源脚本并重建
#    编辑 scripts/build-site.mjs
npm run build:site

# 3) 改动后：抓现状并对比
npm run visual:after
npm run visual:compare
```

对比通过（退出码 0）表示仅装饰层变化、信息完整；失败会逐页列出被删/新增的信息行，需人工复核。

## 环境

- 浏览器：Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`），可用 `EDGE_PATH` 覆盖。
- 依赖：零第三方，仅用 Node 内置模块 + Edge CDP。
- 网络：全程本地回环（127.0.0.1）+ 本地浏览器，无外发请求。

## 目录说明

- `capture.mjs`：抓取脚本（截图 + 文本 + 锚点 + 装饰标记）
- `compare.mjs`：对比脚本（硬校验 + 文本 diff）
- `baseline/`：改动前基线（43 页 PNG + TXT + manifest.json）
- `after/`：改动后现状（结构同上）
