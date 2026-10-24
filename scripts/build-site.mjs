/**
 * 静态站点生成器
 * 把 App 里的政策数据渲染成一个可直接托管到 GitHub Pages 的网站。
 *
 * 运行：npm run build:site
 * 输出：site/
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { annualSchedule, policyCategories } from '../src/data/policies.js'
import { relatedPolicies, relationReason } from '../src/lib/policy.js'

marked.setOptions({ gfm: true, breaks: true })

const OUT = 'site'
const SITE = {
  name: 'CQPUE资助政策',
  tagline: '把学生资助政策讲清楚',
  desc: '重庆工程职业技术大学学生资助政策的结构化整理：21 个资助项目，含资格条件、办理流程、时间节点与材料清单。',
  author: '周泽维',
  phone: '15736152295',
  updated: '2026 年 10 月 24 日',
  // 部署到 GitHub Pages 后把这里改成实际地址，例如 https://用户名.github.io/仓库名
  url: '',
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const byId = (id) => policyCategories.find((p) => p.id === id)

/* ------------------------------------------------------------------ 信息架构 */

const GROUPS = [
  {
    title: '国家政策',
    desc: '中央与地方财政出资，覆盖奖、助、贷、补、免',
    items: policyCategories.filter((p) => p.tag === '国家政策'),
  },
  {
    title: '校内政策',
    desc: '学校自筹资金设立，按学年与学期评定',
    items: policyCategories.filter((p) => p.tag === '校内政策'),
  },
]

const MINDMAP = [
  {
    label: '国家政策',
    color: '#0071e3',
    groups: [
      { label: '奖优', ids: ['national-scholarship', 'encouragement-scholarship', 'zhumeng-scholarship'] },
      { label: '助困', ids: ['national-grant'] },
      { label: '助学贷款', ids: ['student-loan'] },
      { label: '服兵役', ids: ['military-compensation', 'military-tuition-waiver', 'military-grant'] },
      { label: '基层就业', ids: ['grassroots-compensation'] },
      { label: '入学与认定', ids: ['green-channel', 'difficulty-assessment'] },
    ],
  },
  {
    label: '校内政策',
    color: '#af52de',
    groups: [
      { label: '奖学金', ids: ['president-honor', 'comprehensive-scholarship', 'excellence-scholarship', 'progress-scholarship', 'exchange-scholarship'] },
      { label: '减免与补助', ids: ['tuition-waiver', 'freshman-subsidy', 'temporary-subsidy', 'holiday-subsidy'] },
      { label: '勤工助学', ids: ['work-study'] },
    ],
  },
]

const FLOW = [
  { t: '学生提交申请', d: '学工系统线上填表，无需开具任何证明' },
  { t: '班级民主评议', d: '评议小组按条件排序，名单班级公示' },
  { t: '学院审核公示', d: '学院资助工作组审核，公示不少于 3 日' },
  { t: '学校审定公示', d: '资助中心复核，全校公示不少于 5 个工作日' },
  { t: '资金发放', d: '按月或一次性转入学生本人银行卡' },
]

/* ------------------------------------------------------------------ 样式 */

const CSS = `
:root {
  --bg: #ffffff;
  --bg-alt: #f5f5f7;
  --card: #ffffff;
  --text: #1d1d1f;
  --text-2: #6e6e73;
  --text-3: #86868b;
  --line: #d2d2d7;
  --line-2: #e8e8ed;
  --accent: #0071e3;
  --accent-2: #0077ed;
  --green: #2e9e4f;
  --red: #d70015;
  --purple: #8e44ad;
  --radius: 18px;
  --radius-sm: 12px;
  --max: 1080px;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Noto Sans SC", "Microsoft YaHei",
    system-ui, sans-serif;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --bg-alt: #0a0a0a;
    --card: #1d1d1f;
    --text: #f5f5f7;
    --text-2: #a1a1a6;
    --text-3: #86868b;
    --line: #2d2d2f;
    --line-2: #242426;
    --accent: #2997ff;
    --accent-2: #4aa8ff;
    --green: #30d158;
    --red: #ff453a;
    --purple: #bf5af2;
  }
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 17px;
  line-height: 1.55;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

img, svg { max-width: 100%; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.skip {
  position: absolute; left: -9999px; top: 0; z-index: 999;
  background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 8px;
}
.skip:focus { left: 16px; top: 12px; }

.wrap { max-width: var(--max); margin: 0 auto; padding: 0 24px; }

/* ---------- 导航 ---------- */
.nav {
  position: sticky; top: 0; z-index: 100;
  height: 52px;
  display: flex; align-items: center;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--line-2);
}
@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  .nav { background: var(--bg); opacity: .98; }
}
.nav .wrap { display: flex; align-items: center; gap: 28px; width: 100%; }
.nav-brand {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 15px; color: var(--text); letter-spacing: -0.02em;
}
.nav-brand svg { width: 22px; height: 22px; }
.nav-links { display: flex; gap: 24px; margin-left: auto; }
.nav-links a { color: var(--text-2); font-size: 13.5px; }
.nav-links a:hover { color: var(--text); text-decoration: none; }
.nav-links a[aria-current="page"] { color: var(--text); font-weight: 500; }
@media (max-width: 720px) { .nav-links { display: none; } }

/* ---------- 通用 ---------- */
section { padding: 104px 0; }
section.alt { background: var(--bg-alt); }
@media (max-width: 720px) { section { padding: 64px 0; } }

.eyebrow {
  font-size: 13px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--accent); margin: 0 0 12px;
}
h2 { font-size: clamp(26px, 3.4vw, 40px); line-height: 1.12; letter-spacing: -0.025em; margin: 0 0 12px; font-weight: 700; }
.lede { font-size: clamp(17px, 1.6vw, 21px); color: var(--text-2); max-width: 62ch; margin: 0 0 40px; }

/* ---------- Hero ---------- */
.hero { padding: clamp(72px, 12vw, 132px) 0 clamp(64px, 10vw, 108px); text-align: center; }
.hero h1 {
  font-size: clamp(40px, 7.2vw, 82px);
  line-height: 1.04; letter-spacing: -0.035em; font-weight: 700;
  margin: 0 auto 20px; max-width: 18ch;
}
.hero p {
  font-size: clamp(17px, 2vw, 23px); line-height: 1.42; color: var(--text-2);
  max-width: 46ch; margin: 0 auto 34px;
}
.hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px; padding: 0 22px; border-radius: 980px;
  font-size: 16px; font-weight: 500; letter-spacing: -0.01em;
  background: var(--accent); color: #fff; border: none; cursor: pointer;
  transition: background .2s ease, transform .2s ease;
}
.btn:hover { background: var(--accent-2); text-decoration: none; }
.btn:active { transform: scale(.98); }
.btn.ghost { background: transparent; color: var(--accent); border: 1px solid var(--line); }
.btn.ghost:hover { background: var(--bg-alt); }

.stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px; background: var(--line-2);
  border-radius: var(--radius); overflow: hidden;
  margin-top: 64px;
}
.stats > div { background: var(--card); padding: 26px 12px; text-align: center; }
.stats b { display: block; font-size: clamp(24px, 3vw, 34px); letter-spacing: -0.03em; font-weight: 700; }
.stats span { font-size: 12.5px; color: var(--text-2); }
@media (max-width: 620px) { .stats { grid-template-columns: repeat(2, 1fr); } }

/* ---------- 卡片 ---------- */
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.card {
  display: flex; gap: 14px; align-items: flex-start;
  background: var(--card); border: 1px solid var(--line-2);
  border-radius: var(--radius); padding: 20px;
  color: inherit; transition: transform .25s cubic-bezier(.32,.72,0,1), box-shadow .25s, border-color .25s;
}
.card:hover {
  text-decoration: none; transform: translateY(-2px);
  border-color: var(--line);
  box-shadow: 0 12px 32px rgba(0,0,0,.08);
}
.card .tile {
  flex: none; width: 42px; height: 42px; border-radius: 11px;
  display: grid; place-items: center; font-size: 21px;
}
.card h3 { margin: 2px 0 4px; font-size: 17px; letter-spacing: -0.02em; font-weight: 600; }
.card p { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--text-2); }
.card .badge {
  display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 6px;
  font-size: 11px; font-weight: 600;
}
.badge.n { color: var(--accent); background: rgba(0,113,227,.12); }
.badge.s { color: var(--purple); background: rgba(175,82,222,.14); }

/* ---------- 搜索 ---------- */
.search-bar { position: relative; max-width: 520px; margin: 0 0 32px; }
.search-bar input {
  width: 100%; height: 46px; padding: 0 44px 0 44px;
  font-size: 16px; font-family: inherit; color: var(--text);
  background: var(--bg-alt); border: 1px solid var(--line-2); border-radius: 12px;
  outline: none; transition: border-color .2s, background .2s;
}
.search-bar input:focus { border-color: var(--accent); background: var(--card); }
.search-bar .ic { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-3); }
.search-bar .clr { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: none; color: var(--text-3); cursor: pointer; border-radius: 50%; font-size: 16px; }
.empty { padding: 40px 0; color: var(--text-3); font-size: 15px; }

/* ---------- 思维导图 ---------- */
.map-frame {
  background: var(--card); border: 1px solid var(--line-2); border-radius: var(--radius);
  padding: 12px; overflow: auto;
}
.map-frame svg { display: block; min-width: 720px; width: 100%; height: auto; }
.map-hint { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; font-size: 13px; color: var(--text-3); flex-wrap: wrap; }

.deps { margin-top: 20px; padding: 18px 20px; background: var(--bg-alt); border-radius: var(--radius); }
.deps-label { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); margin-bottom: 10px; }
.deps-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.deps-row a { font-size: 13.5px; padding: 6px 12px; border-radius: 8px; background: var(--card); border: 1px solid var(--line-2); color: var(--text); }
.deps-row a:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
.dep-from { font-weight: 600; }
.dep-arrow { color: var(--text-3); }
.deps p { margin: 10px 0 0; font-size: 12.5px; color: var(--text-3); }

/* ---------- 流程 ---------- */
.flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; counter-reset: step; }
.flow > li {
  list-style: none; position: relative; background: var(--card);
  border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 18px 16px;
}
.flow > li::before {
  counter-increment: step; content: counter(step);
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; margin-bottom: 10px;
}
.flow h4 { margin: 0 0 4px; font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; }
.flow p { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-2); }
@media (max-width: 900px) { .flow { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .flow { grid-template-columns: 1fr; } }

/* ---------- 时间轴 ---------- */
.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.timeline li {
  display: grid; grid-template-columns: 110px 1fr; gap: 20px;
  padding: 18px 0; border-top: 1px solid var(--line-2);
}
.timeline li:last-child { border-bottom: 1px solid var(--line-2); }
.timeline .m { font-size: 14px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
.timeline .e { display: grid; gap: 6px; }
.timeline .e div { font-size: 15px; }
.timeline .e span { font-size: 12.5px; color: var(--text-2); }
@media (max-width: 560px) { .timeline li { grid-template-columns: 76px 1fr; gap: 12px; } }

/* ---------- 详情页 ---------- */
.page-head { padding: 56px 0 28px; border-bottom: 1px solid var(--line-2); }
.crumb { font-size: 13px; color: var(--text-3); margin-bottom: 14px; }
.crumb a { color: var(--text-3); }
.crumb a:hover { color: var(--accent); }
.page-head h1 { font-size: clamp(30px, 4.6vw, 46px); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 8px; }
.page-head .sub { font-size: 17px; color: var(--text-2); margin: 0 0 14px; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-3); }
.meta span { padding: 3px 9px; border-radius: 6px; background: var(--bg-alt); }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 56px; padding: 44px 0 96px; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; gap: 0; } .toc { display: none; } }

.toc { position: sticky; top: 76px; align-self: start; font-size: 13.5px; }
.toc strong { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); margin-bottom: 10px; }
.toc a { display: block; padding: 6px 0; color: var(--text-2); border-left: 2px solid transparent; padding-left: 12px; }
.toc a:hover { color: var(--text); text-decoration: none; }
.toc a.active { color: var(--accent); border-left-color: var(--accent); font-weight: 500; }

.block { margin-bottom: 52px; scroll-margin-top: 76px; }
.block > h2 { font-size: 22px; letter-spacing: -0.02em; margin: 0 0 16px; }
.block > h2 .num { color: var(--text-3); font-weight: 500; margin-right: 8px; }

.cond { display: grid; gap: 8px; }
.cond li { list-style: none; display: flex; gap: 10px; font-size: 15px; line-height: 1.5; }
.cond .mark { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; margin-top: 2px; }
.cond .mark.y { background: var(--green); }
.cond .mark.n { background: var(--red); }
.cond ul { margin: 0; padding: 0; display: grid; gap: 8px; }

.prose { font-size: 16px; line-height: 1.68; color: var(--text); }
.prose > *:first-child { margin-top: 0; }
.prose h3 { font-size: 18px; margin: 26px 0 8px; letter-spacing: -0.015em; }
.prose p { margin: 12px 0; }
.prose ul, .prose ol { margin: 12px 0; padding-left: 22px; }
.prose li { margin: 5px 0; }
.prose strong { font-weight: 650; }
.prose table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
.prose th { text-align: left; font-weight: 600; color: var(--text-2); padding: 9px 10px; border-bottom: 1px solid var(--line); }
.prose td { padding: 9px 10px; border-bottom: 1px solid var(--line-2); vertical-align: top; }
.prose blockquote { margin: 16px 0; padding: 12px 16px; background: var(--bg-alt); border-radius: 12px; font-size: 14.5px; color: var(--text-2); }
.prose blockquote p { margin: 4px 0; }
.prose code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 14px; background: var(--bg-alt); padding: 1px 6px; border-radius: 5px; }

.steps { display: grid; gap: 0; }
.steps .role { margin: 22px 0 10px; font-size: 14px; font-weight: 600; color: var(--text-2); }
.steps .role:first-child { margin-top: 0; }
.steps ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
.steps li { display: flex; gap: 12px; }
.steps .n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; margin-top: 2px; }
.steps h4 { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.steps p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-2); }
.steps .pub { margin-top: 6px; font-size: 12.5px; color: #a05a00; }
@media (prefers-color-scheme: dark) { .steps .pub { color: #ffb340; } }

.mats { display: grid; gap: 1px; background: var(--line-2); border-radius: var(--radius-sm); overflow: hidden; }
.mats div { background: var(--card); padding: 13px 16px; display: flex; gap: 12px; align-items: flex-start; }
.mats .nm { font-size: 15px; }
.mats .nt { font-size: 12.5px; color: var(--text-2); margin-top: 2px; }
.mats .tag { margin-left: auto; flex: none; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }
.mats .tag.r { color: var(--red); background: rgba(215,0,21,.1); }
.mats .tag.o { color: var(--green); background: rgba(46,158,79,.12); }

.rel { display: grid; gap: 10px; }
.rel a { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); color: inherit; }
.rel a:hover { border-color: var(--line); text-decoration: none; }
.rel .t { font-size: 15px; }
.rel .s { font-size: 12.5px; color: var(--text-2); }
.rel .why { margin-left: auto; font-size: 12px; color: var(--text-3); white-space: nowrap; }

.pager { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--line-2); padding: 24px 0 0; font-size: 14px; }
.pager a { color: var(--accent); }

/* ---------- 作者 ---------- */
.author { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
@media (max-width: 820px) { .author { grid-template-columns: 1fr; gap: 28px; } }
.author h2 { margin-bottom: 16px; }
.author p { color: var(--text-2); font-size: 15.5px; line-height: 1.7; }
.author dl { display: grid; grid-template-columns: 84px 1fr; gap: 10px 16px; margin: 0; font-size: 14.5px; }
.author dt { color: var(--text-3); }
.author dd { margin: 0; }

/* ---------- 页脚 ---------- */
footer { border-top: 1px solid var(--line-2); padding: 44px 0 64px; font-size: 13px; color: var(--text-3); }
footer .wrap { display: grid; gap: 14px; }
footer a { color: var(--text-2); }
footer .links { display: flex; gap: 20px; flex-wrap: wrap; }

/* ---------- 入场动效 ---------- */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity .7s cubic-bezier(.32,.72,0,1), transform .7s cubic-bezier(.32,.72,0,1); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; } }

/* ---------- 打印 ---------- */
@media print {
  .nav, .hero-actions, .toc, .pager, footer .links { display: none; }
  body { font-size: 11pt; }
  section, .block { page-break-inside: avoid; }
  a { color: #000; text-decoration: none; }
}
`

/* ------------------------------------------------------------------ 交互脚本 */

const SITE_JS = `(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 搜索：按卡片文本过滤 */
  var q = document.getElementById('q');
  if (q) {
    var clear = document.getElementById('qclear');
    var cards = [].slice.call(document.querySelectorAll('#results .card'));
    var groups = [].slice.call(document.querySelectorAll('#results .group-block'));
    var none = document.getElementById('noresult');
    var hay = cards.map(function (c) { return (c.textContent || '').toLowerCase(); });

    function run() {
      var v = (q.value || '').trim().toLowerCase();
      clear.hidden = !v;
      var shown = 0;
      cards.forEach(function (c, i) {
        var hit = !v || hay[i].indexOf(v) !== -1;
        c.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = [].slice.call(g.querySelectorAll('.card')).some(function (c) {
          return c.style.display !== 'none';
        });
        g.style.display = any ? '' : 'none';
      });
      none.hidden = shown > 0;
    }

    q.addEventListener('input', run);
    clear.addEventListener('click', function () { q.value = ''; run(); q.focus(); });
    run();
  }

  /* 目录：滚动到哪节高亮哪条 */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-90px 0px -65% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* 入场动效 */
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = [].slice.call(document.querySelectorAll('.card, .flow > li, .timeline > li, .author > div'));
    targets.forEach(function (t, i) {
      t.classList.add('reveal');
      t.style.transitionDelay = (Math.min(i % 6, 5) * 40) + 'ms';
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }
})();`

/* ------------------------------------------------------------------ 组件 */

const ICON_SHIELD = `<svg viewBox="0 0 200 200" aria-hidden="true">
  <rect width="200" height="200" rx="44" fill="#0071e3"/>
  <path d="M100 46 L74 57 L74 88 Q74 104 100 112 Q126 104 126 88 L126 57 Z" fill="#fff" opacity=".97"/>
  <path d="M44 132 Q54 112 76 119 Q88 123 93 135 L93 145 Q80 143 66 147 Q50 152 44 132Z" fill="#f59e0b"/>
  <path d="M156 132 Q146 112 124 119 Q112 123 107 135 L107 145 Q120 143 134 147 Q150 152 156 132Z" fill="#f97316"/>
  <path d="M100 130 Q94 121 94 116 Q94 110 100 110 Q106 110 106 116 Q106 121 100 130Z" fill="#f59e0b"/>
</svg>`

const iconSVG = (hex, emoji) => `<span class="tile" style="background:${hex}22">${emoji}</span>`

const nav = (base, active) => {
  const link = (href, label, key) =>
    `<a href="${base}${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`
  return `<a class="skip" href="#main">跳到主要内容</a>
<nav class="nav" aria-label="主导航">
  <div class="wrap">
    <a class="nav-brand" href="${base}index.html">${ICON_SHIELD}CQPUE资助政策</a>
    <div class="nav-links">
      ${link('#policies', '资助项目', 'policies')}
      ${link('#mindmap', '体系全景', 'mindmap')}
      ${link('#schedule', '全年日程', 'schedule')}
      ${link('#author', '关于作者', 'author')}
    </div>
  </div>
</nav>`
}

const footer = (base) => `<footer>
  <div class="wrap">
    <div class="links">
      <a href="${base}index.html">首页</a>
      <a href="${base}privacy.html">隐私政策</a>
      <a href="${base}policies/difficulty-assessment.html">从困难认定开始</a>
    </div>
    <div>本站由周泽维个人整理，<strong>完全免费、无广告、无商业用途</strong>，仅用于学习与研究。</div>
    <div>非重庆工程职业技术大学官方发布。政策可能随年度调整，具体条件、金额与办理时间以学校学生资助管理中心当年通知为准。</div>
    <div>数据更新：${SITE.updated} · 21 个资助项目 · 13 份政策依据</div>
  </div>
</footer>`

const DEPS = `<div class="deps">
  <div class="deps-label">前置关系</div>
  <div class="deps-row">
    <a class="dep-from" href="policies/difficulty-assessment.html">家庭经济困难学生认定</a>
    <span class="dep-arrow">→</span>
    <a href="policies/national-grant.html">国家助学金</a>
    <a href="policies/encouragement-scholarship.html">国家励志奖学金</a>
    <a href="policies/tuition-waiver.html">学费减免</a>
    <a href="policies/freshman-subsidy.html">新生困难补助</a>
  </div>
  <p>这些项目都要求先通过困难认定；认定等级同时决定助学金的档次。</p>
</div>`

const layout = ({ title, description, base = '', active, body, extraHead = '' }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">
<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}assets/site.css">
${extraHead}
</head>
<body>
${nav(base, active)}
<main id="main">
${body}
</main>
${footer(base)}
<script src="${base}assets/site.js" defer></script>
</body>
</html>`

const card = (p, base) => `<a class="card" href="${base}policies/${p.id}.html">
  ${iconSVG(p.color, p.icon)}
  <div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.subtitle)}</p>
    <span class="badge ${p.tag === '国家政策' ? 'n' : 's'}">${esc(p.tag)}</span>
  </div>
</a>`

/* ------------------------------------------------------------------ 思维导图 */

function buildMindmap() {
  const ROW = 32
  const PAD_TOP = 40
  const X = { root: 24, cat: 220, grp: 432, leaf: 596 }
  const W = 900

  const leaves = []
  let y = PAD_TOP
  const catNodes = []

  for (const cat of MINDMAP) {
    const catItem = { label: cat.label, color: cat.color, x: X.cat, groups: [] }
    let firstLeafY = null
    let lastLeafY = null

    for (const g of cat.groups) {
      const grpItem = { label: g.label, x: X.grp, ys: [] }
      for (const id of g.ids) {
        const p = byId(id)
        if (!p) continue
        leaves.push({ id, title: p.title, color: cat.color, x: X.leaf, y })
        grpItem.ys.push(y)
        if (firstLeafY === null) firstLeafY = y
        lastLeafY = y
        y += ROW
      }
      grpItem.y = grpItem.ys.reduce((a, b) => a + b, 0) / grpItem.ys.length
      catItem.groups.push(grpItem)
      y += 8
    }
    catItem.y = (firstLeafY + lastLeafY) / 2
    catNodes.push(catItem)
    y += 26
  }

  const H = y - 6
  // 根节点放在整张图的正中，而不是两个分支的重心（否则会被更长的分支拽偏）
  const rootY = Math.round(H / 2)

  const curve = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2
    return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  let out = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="学生资助体系思维导图：国家政策 11 项、校内政策 10 项">`
  out += `<style>
    .mm-root-bg{fill:#1d1d1f}
    .mm-root{font:700 17px var(--font,system-ui);fill:#fff}
    .mm-cat{font:700 15px var(--font,system-ui);fill:#fff}
    .mm-grp{font:600 13px var(--font,system-ui);fill:#86868b}
    .mm-leaf{font:400 13.5px var(--font,system-ui);fill:#1d1d1f}
    .mm-leaf:hover{fill:#0071e3}
    .mm-link{fill:none;stroke:#d2d2d7;stroke-width:1.4}
    .mm-link2{fill:none;stroke:#e0e0e5;stroke-width:1.1}
    @media (prefers-color-scheme: dark){
      .mm-root-bg{fill:#f5f5f7}
      .mm-root{fill:#1d1d1f}
      .mm-grp{fill:#86868b}.mm-leaf{fill:#f5f5f7}
      .mm-link{stroke:#3a3a3c}.mm-link2{stroke:#2c2c2e}
    }
  </style>`

  out += `<rect class="mm-root-bg" x="${X.root}" y="${rootY - 22}" width="152" height="44" rx="12"/>`
  out += `<text class="mm-root" x="${X.root + 18}" y="${rootY + 5}">学生资助体系</text>`

  for (const cat of catNodes) {
    out += `<path class="mm-link" d="${curve(X.root + 152, rootY, cat.x, cat.y - 22)}"/>`
    out += `<rect x="${cat.x}" y="${cat.y - 22}" width="138" height="44" rx="11" fill="${cat.color}"/>`
    out += `<text class="mm-cat" x="${cat.x + 16}" y="${cat.y + 5}">${esc(cat.label)}</text>`

    for (const g of cat.groups) {
      out += `<path class="mm-link2" d="${curve(cat.x + 138, cat.y, g.x, g.y)}"/>`
      out += `<text class="mm-grp" x="${g.x}" y="${g.y + 4.5}">${esc(g.label)}</text>`

      for (const ly of g.ys) {
        const leaf = leaves.find((l) => l.y === ly)
        if (!leaf) continue
        out += `<path class="mm-link2" d="${curve(g.x + 86, g.y, X.leaf - 10, ly)}"/>`
        out += `<a href="policies/${leaf.id}.html"><circle cx="${X.leaf - 10}" cy="${ly}" r="2.4" fill="${cat.color}" opacity=".65"/>`
        out += `<text class="mm-leaf" x="${X.leaf}" y="${ly + 4.5}">${esc(leaf.title)}</text></a>`
      }
    }
  }

  out += `</svg>`
  return out
}

/* ------------------------------------------------------------------ 页面 */

function renderIndex() {
  const mindmap = buildMindmap()

  const policySections = GROUPS.map(
    (g) => `<div class="group-block">
      <h3 style="font-size:22px;letter-spacing:-.02em;margin:48px 0 6px">${esc(g.title)} <span style="color:var(--text-3);font-weight:400;font-size:15px">${g.items.length} 项</span></h3>
      <p style="color:var(--text-2);font-size:14.5px;margin:0 0 20px">${esc(g.desc)}</p>
      <div class="grid">${g.items.map((p) => card(p, '')).join('')}</div>
    </div>`,
  ).join('')

  const timeline = annualSchedule
    .map(
      (m) => `<li><div class="m">${esc(m.month)}</div><div class="e">
        ${m.events.map((e) => `<div>${esc(e.title)}${e.desc ? `<span>　${esc(e.desc)}</span>` : ''}</div>`).join('')}
      </div></li>`,
    )
    .join('')

  const body = `
<header class="hero">
  <div class="wrap">
    <h1>把学生资助政策<br>讲清楚</h1>
    <p>21 个资助项目，从资格条件到材料清单，一站查完。</p>
    <div class="hero-actions">
      <a class="btn" href="#policies">浏览全部项目</a>
      <a class="btn ghost" href="#mindmap">看体系全景</a>
    </div>
    <div class="stats">
      <div><b>21</b><span>资助项目</span></div>
      <div><b>11</b><span>国家政策</span></div>
      <div><b>10</b><span>校内政策</span></div>
      <div><b>13</b><span>政策依据</span></div>
    </div>
  </div>
</header>

<section id="policies" class="alt">
  <div class="wrap">
    <p class="eyebrow">资助项目</p>
    <h2>按类别找到你要的项目</h2>
    <p class="lede">国家政策覆盖奖、助、贷、补、免；校内政策按学年与学期评定。不确定从哪开始，先看「家庭经济困难学生认定」——它是大多数资助的前置条件。</p>

    <div class="search-bar">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
      <input id="q" type="search" placeholder="搜索项目、金额、条件" aria-label="搜索资助项目">
      <button class="clr" id="qclear" aria-label="清除" hidden>✕</button>
    </div>

    <div id="results">
      ${policySections}
    </div>
    <div id="noresult" class="empty" hidden>没有找到相关项目，试试「国奖」「贷款」「勤工」。</div>
  </div>
</section>

<section id="mindmap">
  <div class="wrap">
    <p class="eyebrow">体系全景</p>
    <h2>一张图看懂资助体系</h2>
    <p class="lede">左边是国家政策，右边是校内政策。按用途归类，点任一节点可直接进入该项目。</p>
    <div class="map-frame">${mindmap}</div>
    <div class="map-hint">
      <span>点节点可直接进入对应项目</span>
      <a href="map.html">全屏查看 →</a>
    </div>
    ${DEPS}
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <p class="eyebrow">办理流程</p>
    <h2>一份申请，要过五道关</h2>
    <p class="lede">不同项目的细节不同，但主线一致：学生申请、班级评议、学院审核、学校审定、资金发放。每一级都有公示环节。</p>
    <ul class="flow">
      ${FLOW.map((f) => `<li><h4>${esc(f.t)}</h4><p>${esc(f.d)}</p></li>`).join('')}
    </ul>
  </div>
</section>

<section id="schedule">
  <div class="wrap">
    <p class="eyebrow">全年日程</p>
    <h2>资助工作全年不停</h2>
    <p class="lede">9 月是申请高峰，3 月是学费减免与校长荣誉奖的窗口。把这张表存下来，别错过时间。</p>
    <ul class="timeline">${timeline}</ul>
  </div>
</section>

<section id="author" class="alt">
  <div class="wrap author">
    <div>
      <p class="eyebrow">关于作者</p>
      <h2>周泽维</h2>
      <p>独立开发者。做这个项目的起因很简单：资助政策散落在十几个文件里，学生看不懂、辅导员也记不全。于是把它整理成一份可以随时查的结构化资料，先做成安卓应用，再搬到这里。</p>
      <p>项目完全公益：没有广告、没有内购、没有付费咨询，也不收集任何个人信息。如果你所在的学校也想做一份，欢迎直接拿去改。</p>
      <p><a href="privacy.html">隐私政策</a> · <a href="tel:15736152295">15736152295</a></p>
    </div>
    <div>
      <dl>
        <dt>项目</dt><dd>CQPUE资助政策</dd>
        <dt>归属</dt><dd>重庆工程职业技术大学</dd>
        <dt>范围</dt><dd>21 个资助项目 · 10 个月段日程</dd>
        <dt>依据</dt><dd>13 份国家与校内政策文件</dd>
        <dt>形态</dt><dd>安卓应用 + 本网页</dd>
        <dt>费用</dt><dd>完全免费，无商业用途</dd>
        <dt>更新</dt><dd>${SITE.updated}</dd>
      </dl>
    </div>
  </div>
</section>
`

  return layout({
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.desc,
    active: 'policies',
    body,
  })
}

function renderPolicy(p, index) {
  const prev = policyCategories[(index - 1 + policyCategories.length) % policyCategories.length]
  const next = policyCategories[(index + 1) % policyCategories.length]

  const rules = p.rules || {}
  const positives = rules.prerequisites || []
  const negatives = [...(rules.exclusions || []), ...(rules.disqualifiers || [])]

  const cond = positives.length
    ? `<ul>${positives.map((r) => `<li><span class="mark y">✓</span><span>${esc(r)}</span></li>`).join('')}</ul>`
    : ''
  const neg = negatives.length
    ? `<div style="margin-top:16px"><h3 style="font-size:14px;color:var(--text-2);margin:0 0 10px">不能申请或会被取消资格</h3>
       <ul>${negatives.map((r) => `<li><span class="mark n">✕</span><span>${esc(r)}</span></li>`).join('')}</ul></div>`
    : ''

  const chain = (p.approvalChain || [])
    .map(
      (lvl) => `<div class="role">${esc(lvl.role)}　<span style="color:var(--text-3);font-weight:400">第 ${lvl.level} 级</span></div>
      <ol>${lvl.steps.map((s, j) => `<li><span class="n">${j + 1}</span><div><h4>${esc(s.title)}</h4><p>${esc(s.desc)}</p>${lvl.publicity ? `<p class="pub">📣 ${esc(lvl.publicity)}</p>` : ''}</div></li>`).join('')}</ol>`,
    )
    .join('')

  const mats = (p.materials || [])
    .map(
      (m) => `<div><div><div class="nm">${esc(m.name)}</div>${m.note ? `<div class="nt">${esc(m.note)}</div>` : ''}</div>
      <span class="tag ${m.required ? 'r' : 'o'}">${m.required ? '必需' : '选交'}</span></div>`,
    )
    .join('')

  const tl = (p.timeline || [])
    .map((t) => `<li><div class="m">${esc(t.month)}</div><div class="e"><div>${esc(t.event)}</div></div></li>`)
    .join('')

  const related = relatedPolicies(p, policyCategories, 4).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    reason: relationReason(p, r),
  }))

  const rel = related
    .map(
      (r) => `<a href="${r.id}.html"><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.subtitle)}</div></div><span class="why">${esc(r.reason)}</span></a>`,
    )
    .join('')

  const body = `
<div class="wrap">
  <div class="page-head">
    <div class="crumb"><a href="../index.html">首页</a> / ${esc(p.tag)}</div>
    <h1>${esc(p.icon)} ${esc(p.title)}</h1>
    <p class="sub">${esc(p.subtitle)}</p>
    <div class="meta">
      <span>${esc(p.tag)}</span>
      ${p.source ? `<span>依据 ${esc(p.source)}</span>` : ''}
      <span>更新 ${SITE.updated}</span>
    </div>
  </div>

  <div class="layout">
    <div class="content">
      <div class="block" id="s1">
        <h2><span class="num">01</span>资格条件</h2>
        <div class="cond">${cond}${neg}</div>
      </div>

      <div class="block" id="s2">
        <h2><span class="num">02</span>政策要点</h2>
        <div class="prose">${marked.parse(p.overview || '')}</div>
      </div>

      <div class="block" id="s3">
        <h2><span class="num">03</span>办理流程</h2>
        <div class="steps">${chain}</div>
      </div>

      <div class="block" id="s4">
        <h2><span class="num">04</span>时间节点</h2>
        <ul class="timeline">${tl}</ul>
      </div>

      <div class="block" id="s5">
        <h2><span class="num">05</span>材料清单</h2>
        <div class="mats">${mats}</div>
      </div>

      ${rel ? `<div class="block" id="s6"><h2><span class="num">06</span>相关资助</h2><div class="rel">${rel}</div></div>` : ''}

      <div class="pager">
        <a href="${prev.id}.html">← ${esc(prev.title)}</a>
        <a href="${next.id}.html">${esc(next.title)} →</a>
      </div>
    </div>

    <aside class="toc">
      <strong>本页目录</strong>
      <a href="#s1">资格条件</a>
      <a href="#s2">政策要点</a>
      <a href="#s3">办理流程</a>
      <a href="#s4">时间节点</a>
      <a href="#s5">材料清单</a>
      ${rel ? '<a href="#s6">相关资助</a>' : ''}
    </aside>
  </div>
</div>`

  return layout({
    title: `${p.title} · ${SITE.name}`,
    description: `${p.title}：${p.subtitle}。${(p.description || '').slice(0, 80)}`,
    base: '../',
    active: 'policies',
    body,
  })
}

function renderMapPage(mindmap) {
  const body = `
<div class="wrap" style="padding:48px 0 80px">
  <p class="eyebrow">体系全景</p>
  <h2 style="margin-bottom:28px">学生资助体系思维导图</h2>
  <div class="map-frame">${mindmap}</div>
  <p style="margin-top:18px;font-size:13px;color:var(--text-3)">点击节点进入对应项目；带箭头的连线表示「困难认定」是这些项目的前置条件。</p>
</div>`
  return layout({
    title: `体系全景 · ${SITE.name}`,
    description: '学生资助体系思维导图：国家政策与校内政策的层级关系，以及困难认定作为前置条件的依赖关系。',
    active: 'mindmap',
    body,
  })
}

function renderPrivacy() {
  const md = `本站不收集任何个人信息，不使用 Cookie，不接入统计或广告服务。所有页面均为静态文件，托管在 GitHub Pages 上。

开发者：周泽维（个人开发者，非学校官方）　联系电话：15736152295

本站内容依据学校及国家、重庆市公开的资助政策文件整理，**非学校官方发布**。政策可能随年度调整，具体条件、金额与办理时间**以学校学生资助管理中心当年通知为准**。本站不构成任何政策承诺或法律依据。

完整隐私政策（含安卓应用端说明）见应用内「关于 → 隐私政策」页面，要点如下：

- 不收集、不上传、不存储任何个人信息
- 无账号、无登录、无支付、无广告、无内购
- 不使用 Cookie 与任何追踪技术
- 不接入第三方统计、推送、广告或崩溃上报 SDK
- 安卓应用不申请相机、麦克风、通讯录、位置、短信、存储等敏感权限

生效日期：2026 年 10 月 24 日`

  const body = `
<div class="wrap" style="padding:48px 0 96px;max-width:760px">
  <p class="eyebrow">隐私</p>
  <h2>隐私政策</h2>
  <div class="prose" style="margin-top:24px">${marked.parse(md)}</div>
</div>`
  return layout({ title: `隐私政策 · ${SITE.name}`, description: '本站不收集任何个人信息，无 Cookie、无统计、无广告。', body })
}

function render404() {
  const body = `
<div class="wrap" style="padding:120px 0;text-align:center">
  <h1 style="font-size:clamp(40px,7vw,72px);letter-spacing:-.03em;margin:0 0 12px">页面走丢了</h1>
  <p style="color:var(--text-2);margin:0 0 28px">这个地址没有对应的内容，可能是链接过期了。</p>
  <a class="btn" href="index.html">返回首页</a>
</div>`
  return layout({ title: '页面未找到 · CQPUE资助政策', description: '页面不存在', body })
}

/* ------------------------------------------------------------------ 输出 */

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'assets'), { recursive: true })
mkdirSync(join(OUT, 'policies'), { recursive: true })

writeFileSync(join(OUT, 'assets/site.css'), CSS, 'utf8')
writeFileSync(join(OUT, 'assets/icon.svg'), ICON_SHIELD, 'utf8')
writeFileSync(join(OUT, 'assets/site.js'), SITE_JS, 'utf8')
writeFileSync(join(OUT, '.nojekyll'), '', 'utf8')
writeFileSync(join(OUT, 'index.html'), renderIndex(), 'utf8')
writeFileSync(join(OUT, '404.html'), render404(), 'utf8')
writeFileSync(join(OUT, 'privacy.html'), renderPrivacy(), 'utf8')
writeFileSync(join(OUT, 'map.html'), renderMapPage(buildMindmap()), 'utf8')

policyCategories.forEach((p, i) => {
  writeFileSync(join(OUT, 'policies', `${p.id}.html`), renderPolicy(p, i), 'utf8')
})

const pages = ['index.html', 'map.html', 'privacy.html'].concat(
  policyCategories.map((p) => `policies/${p.id}.html`),
)

writeFileSync(
  join(OUT, 'robots.txt'),
  SITE.url ? `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n` : 'User-agent: *\nAllow: /\n',
  'utf8',
)

if (SITE.url) {
  writeFileSync(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${SITE.url}/${u}</loc></url>`).join('\n')}
</urlset>`,
    'utf8',
  )
}

console.log(`站点已生成：${OUT}/`)
console.log(`  首页 1 · 政策页 ${policyCategories.length} · 导图页 1 · 隐私 1 · 404 1`)
