# CQPUE资助政策

重庆工程职业技术大学学生资助政策的结构化整理。同一套内容，两个出口：

| 出口 | 位置 | 用途 |
|---|---|---|
| 安卓应用 | 本仓库根目录（Vue 3 + Capacitor） | 学生装在手机里离线查 |
| 静态网站 | `site/` | 给其他高校资助工作者在线查阅、转发 |

## 网站

线上内容与 App 完全同源：都读 `src/data/policies.js`。改完政策数据后重新生成即可，不会出现两边不一致。

```bash
npm install
npm run build:site     # 输出到 site/
```

本地预览：

```bash
python -m http.server 4180 --directory site
# 打开 http://127.0.0.1:4180
```

### 部署到 GitHub Pages

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 推送到 `main` 或 `master` 分支，`.github/workflows/pages.yml` 会自动发布 `site/`。
3. 首次发布完成后，仓库 Settings → Pages 顶部会显示访问地址，形如
   `https://<用户名>.github.io/<仓库名>/`。

想让搜索引擎收录时，把 `scripts/build-site.mjs` 里的 `SITE.url` 改成上面的实际地址，重新生成即可（会同时输出 `sitemap.xml`）。

### 站点结构

```
site/
├─ index.html            首页：项目总览 / 搜索 / 思维导图 / 流程 / 全年日程 / 关于作者
├─ map.html              思维导图全屏版
├─ privacy.html          隐私政策
├─ 404.html              自定义 404
├─ policies/<id>.html    21 个政策详情页（资格条件 / 要点 / 流程 / 时间 / 材料 / 相关资助）
└─ assets/               样式、脚本、图标
```

## 应用

```bash
npm run dev            # 本地开发
npm run build          # 打包网页资源
npx cap sync android   # 同步到原生工程
cd android && gradlew assembleRelease
```

## 测试

```bash
npm run test         # 单元 40 项
npm run test:e2e     # 集成 25 项（需先 build）
npm run test:static  # 静态检查 14 项（需先出 APK）
```

## 内容与合规

- 内容依据 13 份国家与校内政策文件整理，非学校官方发布。
- 完全公益：无广告、无内购、无付费服务，不收集任何个人信息。
- 政策随年度调整，具体条件、金额与办理时间以学校学生资助管理中心当年通知为准。

## 文档

- `docs/国家政策核查报告.md` — 11 项国家政策的联网核查与来源
- `docs/校内政策-核对结果.md` — 10 项校内政策的确认结果
- `docs/测试报告.md` — 单元 / 集成 / 系统 / 静态四层测试
- `docs/隐私政策.md` — 隐私政策全文（可提交应用市场）

## 许可

内容可自由取用、修改、再发布，注明来源即可。欢迎其他高校照着改一份自己的。
