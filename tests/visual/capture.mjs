/**
 * 静态站视觉回归 - 基线/现状抓取（纯本地，零第三方依赖）
 *
 * 用 Edge headless + CDP 驱动，对 site/ 下每个 HTML 页面抓取：
 *   1) 全页截图 PNG          —— 供人工目视外观是否意外变化
 *   2) 规范化可见文本 .txt    —— 供改动前后逐行 diff，确认信息文字没丢
 *   3) 结构锚点 JSON          —— 关键元素计数硬断言（政策卡片、标题层级、合规声明等）
 *
 * 运行：node tests/visual/capture.mjs <输出目录>
 *   node tests/visual/capture.mjs tests/visual/baseline   # 改动前
 *   node tests/visual/capture.mjs tests/visual/after      # 改动后
 *
 * 注意：全程本地回环 + 本地浏览器，无任何外发请求。
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, sep } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = process.argv[2] || 'tests/visual/baseline'
const SITE_DIR = 'site'
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4191
const CDP_PORT = 9362
const BASE = `http://127.0.0.1:${PORT}/`

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

/** 递归列出 site/ 下所有 html 文件，404 不作为回归基准 */
function listHtml(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listHtml(p))
    else if (extname(p).toLowerCase() === '.html' && name !== '404.html') out.push(p)
  }
  return out.sort()
}

const files = listHtml(SITE_DIR)
mkdirSync(OUT, { recursive: true })

/** 极简静态服务器：把 site/ 挂到根路径 */
const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '')
    let file = join(SITE_DIR, rel)
    if (!file.startsWith(SITE_DIR)) { res.writeHead(403).end(); return }
    if (!statSync(file).isFile()) file = join(file, 'index.html')
    const body = readFileSync(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

/** 启动 Edge headless 并连上 CDP */
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=D:\\deepseekhermsh\\apk_analysis\\edge-visual',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' })

let page
for (let i = 0; i < 100; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
    page = targets.find((t) => t.type === 'page')
    if (page) break
  } catch { /* 等待浏览器就绪 */ }
  await sleep(200)
}
if (!page) { console.error('Edge 未启动'); process.exit(2) }

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id)
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject })
  ws.send(JSON.stringify({ id: mid, method, params }))
})
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error')
  return r.result.value
}
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
})

/** 采集装饰节点文本：眉标/卡片图标/导航角标。这些文本允许在改动后消失 */
const DECOR_JS = `(() => {
  const sels = ['.eyebrow', '.hero-eyebrow', '.card .tile', '.nav-new']
  const out = []
  for (const s of sels) {
    document.querySelectorAll(s).forEach(e => {
      const t = (e.innerText || e.textContent || '').trim()
      if (t && !/^[\\s\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]+$/u.test(t)) out.push(t)
      // 导航角标与主文本在 innerText 中合并成一行，父节点整行也登记为装饰
      if (s === '.nav-new' && e.parentElement) {
        const pt = (e.parentElement.innerText || '').trim()
        if (pt) out.push(pt)
      }
    })
  }
  return out
})()`

/** 抽取结构锚点：这些计数/文本在"只删装饰"的前提下必须保持不变 */
const ANCHOR_JS = `(() => {
  const t = document.body.innerText || ''
  const has = (s) => t.includes(s)
  const cnt = (s) => document.querySelectorAll(s).length
  return {
    cards: cnt('.card'),                       // 政策入口卡片
    h1: cnt('h1'), h2: cnt('h2'), h3: cnt('h3'),
    links: cnt('a[href]'),
    // 合规与信息锚点：必须始终存在
    hasDisclaimer: has('非官方') || has('免责声明'),
    hasScope: has('重庆工程职业技术大学'),
    hasFreshDate: has('内容核对'),
    // 详情类页面正文锚点
    hasCondition: has('条件') || has('对象'),
    hasProcess: has('流程') || has('办理'),
    hasMaterial: has('材料'),
    // 布局健康
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    textLen: t.replace(/\\s+/g, '').length,
  }
})()`

const manifest = []
let fail = 0
for (const file of files) {
  const rel = relative(SITE_DIR, file).split(sep).join('/')
  try {
    await send('Page.navigate', { url: BASE + rel })
    await sleep(350)
    // 规范化可见文本：去空行、行首行尾空白，逐行留存供 diff
    const text = await ev(`(document.body.innerText||'').split(/\\n/).map(s=>s.trim()).filter(Boolean).join('\\n')`)
    const decor = await ev(DECOR_JS)
    const anchor = await ev(ANCHOR_JS)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })

    const base = rel.replace(/\.html$/, '').replace(/\//g, '__') || 'index'
    writeFileSync(join(OUT, base + '.txt'), text, 'utf8')
    writeFileSync(join(OUT, base + '.png'), Buffer.from(shot.data, 'base64'))
    manifest.push({ url: rel, txt: base + '.txt', png: base + '.png', anchor, decor })
    const flag = anchor.scrollWidth - anchor.innerWidth > 1 ? ' [横向溢出]' : ''
    console.log(`OK  ${rel}  卡片${anchor.cards} 文本${anchor.textLen}字${flag}`)
  } catch (e) {
    fail++
    console.log(`ERR ${rel}  ${e.message}`)
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
console.log(`\n抓取完成：${manifest.length} 页，失败 ${fail}，输出目录 ${OUT}`)

ws.close()
edge.kill()
server.close()
process.exit(fail ? 1 : 0)
