/**
 * 集成 / 系统测试（自动化）
 *
 * 用 Vite preview 起真实静态服务，Chrome headless 通过 CDP 驱动，
 * 覆盖：功能链路、路由、状态持久化、兼容性、离线、性能、稳定性。
 *
 * 运行：node tests/e2e/run.mjs
 */
import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { preview } from 'vite'

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4183
const BASE = `http://127.0.0.1:${PORT}/#/`
const DEBUG_PORT = 9361

const results = []
let failed = 0

function record(name, ok, detail = '', ms = 0) {
  results.push({ name, ok, detail, ms })
  if (!ok) failed++
  const tag = ok ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${name}${detail ? '  — ' + detail : ''}`)
}

async function test(name, fn) {
  const t0 = Date.now()
  try {
    const detail = await fn()
    record(name, true, detail || '', Date.now() - t0)
  } catch (e) {
    record(name, false, e.message, Date.now() - t0)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/* ---------------- Chrome / CDP ---------------- */

async function launch() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=D:\\deepseekhermsh\\apk_analysis\\chrome-e2e',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' })

  let targets
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
      break
    } catch {
      await sleep(200)
    }
  }
  if (!targets) throw new Error('Chrome 未启动')

  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))

  let id = 0
  const pending = new Map()
  const errors = []

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails?.exception?.description || 'exception')
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) {
      const d = r.exceptionDetails
      throw new Error(d.exception?.description || d.text || 'eval error')
    }
    return r.result.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')

  const viewport = (width, height = 844, dsf = 2) =>
    send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: true })

  const colorScheme = (scheme) =>
    send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })

  const goto = async (hash, wait = 900) => {
    await send('Page.navigate', { url: BASE + hash })
    await sleep(wait)
  }

  return { chrome, ws, send, ev, viewport, colorScheme, goto, errors }
}

/* ---------------- 用 vite preview 起服务 ---------------- */

async function startServer() {
  const server = await preview({
    preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
    logLevel: 'silent',
  })
  return server
}

/* ---------------- 主流程 ---------------- */

const server = await startServer()
const { chrome, ws, send, ev, viewport, colorScheme, goto, errors } = await launch()

try {
  await viewport(390)
  await colorScheme('light')

  // 每个用例都从干净的存储状态开始
  await goto('', 600)
  await ev(`sessionStorage.clear(); localStorage.clear()`)

  /* ============ 功能 ============ */

  await test('首页渲染 21 个政策条目（国家 11 / 校内 10）', async () => {
    await goto('')
    const total = await ev(`document.querySelectorAll('.cell--policy').length`)
    const headers = await ev(`[...document.querySelectorAll('.group-header')].map(e=>e.textContent.trim())`)
    assert(total === 21, `条目数 ${total}，期望 21`)
    assert(headers.includes('国家政策') && headers.includes('校内政策'), `分组缺失: ${headers}`)
    return `已渲染 ${total} 条`
  })

  await test('搜索「国奖」标题命中排第一', async () => {
    await goto('')
    await ev(`(() => { const i=document.querySelector('.search-input'); i.value='国奖'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`)
    await sleep(400)
    const first = await ev(`document.querySelector('.group .cell-title')?.textContent.trim()`)
    assert(first === '国家奖学金', `首条结果是「${first}」`)
    return `首条：${first}`
  })

  await test('搜索「贷款」命中生源地助学贷款', async () => {
    await ev(`(() => { const i=document.querySelector('.search-input'); i.value='贷款'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`)
    await sleep(400)
    const all = await ev(`[...document.querySelectorAll('.cell--policy .cell-title')].map(e=>e.textContent.trim())`)
    assert(all.includes('生源地信用助学贷款'), `结果: ${all}`)
    return `${all.length} 条结果`
  })

  await test('点击搜索结果进入详情页', async () => {
    await ev(`document.querySelector('.cell--policy').click()`)
    await sleep(700)
    const hash = await ev(`location.hash`)
    assert(hash.startsWith('#/policy/'), `路由异常: ${hash}`)
    return hash
  })

  await test('详情页四个 Tab 均有内容', async () => {
    await goto('policy/national-grant')
    const tabs = await ev(`document.querySelectorAll('.seg-btn').length`)
    assert(tabs === 4, `Tab 数 ${tabs}`)

    const overview = await ev(`document.querySelectorAll('.md p').length`)
    assert(overview > 3, `总览段落 ${overview}`)

    await ev(`document.querySelectorAll('.seg-btn')[1].click()`); await sleep(400)
    const flow = await ev(`document.querySelectorAll('.step-row').length`)
    assert(flow > 0, '流程无步骤')

    await ev(`document.querySelectorAll('.seg-btn')[2].click()`); await sleep(400)
    const tl = await ev(`document.querySelectorAll('.tl-row').length`)
    assert(tl > 0, '时间节点为空')

    await ev(`document.querySelectorAll('.seg-btn')[3].click()`); await sleep(400)
    const mats = await ev(`document.querySelectorAll('.mat-row').length`)
    assert(mats > 0, '材料清单为空')
    return `总览${overview}段/流程${flow}步/时间${tl}条/材料${mats}项`
  })

  await test('材料勾选刷新后仍保留', async () => {
    await ev(`document.querySelectorAll('.mat-row')[0].click()`)
    await sleep(300)
    const key = await ev(`Object.keys(localStorage).find(k=>k.startsWith('aid_materials_'))`)
    assert(!!key, '未写入 localStorage')

    await ev(`location.reload()`)
    await sleep(1200)
    await ev(`document.querySelectorAll('.seg-btn')[3].click()`)
    await sleep(400)
    const checked = await ev(`document.querySelectorAll('.mat-row.is-checked').length`)
    assert(checked === 1, `刷新后勾选数 ${checked}`)
    return `键 ${key}`
  })

  await test('返回首页后搜索词与滚动位置都恢复', async () => {
    await goto('')
    await ev(`sessionStorage.clear()`)
    await ev(`location.reload()`)
    await sleep(1200)

    const total = await ev(`document.querySelectorAll('.cell--policy').length`)
    assert(total === 21, `清空状态后应显示 21 条，实际 ${total}`)

    await ev(`window.scrollTo(0, 700)`)
    await sleep(300)
    const before = await ev(`Math.round(window.scrollY)`)
    await ev(`document.querySelectorAll('.cell--policy')[8].click()`)
    await sleep(800)
    await ev(`history.back()`)
    await sleep(1400)
    const after = await ev(`Math.round(window.scrollY)`)

    await ev(`(() => { const i=document.querySelector('.search-input'); i.value='贷款'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`)
    await sleep(400)
    await ev(`document.querySelector('.cell--policy').click()`)
    await sleep(700)
    await ev(`history.back()`)
    await sleep(1300)
    const q = await ev(`document.querySelector('.search-input')?.value`)

    assert(Math.abs(after - before) <= 4, `滚动 ${before} → ${after}`)
    assert(q === '贷款', `搜索词恢复为「${q}」`)
    return `滚动 ${before}→${after}，搜索词 ${q}`
  })

  await test('未知路由重定向到首页', async () => {
    await goto('policy/not-exist-id', 1200)
    const hash = await ev(`location.hash`)
    assert(hash === '#/' || hash === '#', `未重定向: ${hash}`)
    return hash
  })

  await test('全年日程渲染 10 个月段', async () => {
    await goto('timeline')
    const groups = await ev(`document.querySelectorAll('.month-head').length`)
    const chips = await ev(`document.querySelectorAll('.chip--month').length`)
    assert(groups === 10, `月段 ${groups}`)
    assert(chips === 10, `月份按钮 ${chips}`)
    return `${groups} 个月段`
  })

  /* ============ 兼容性 ============ */

  await test('5 种屏幕宽度无横向溢出', async () => {
    const out = []
    for (const w of [320, 360, 390, 430, 768]) {
      await viewport(w)
      await goto('', 800)
      const overflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`)
      out.push(`${w}px:${overflow > 1 ? '溢出' + overflow : 'ok'}`)
      assert(overflow <= 1, `${w}px 横向溢出 ${overflow}px`)
    }
    return out.join(' ')
  })

  await test('深色模式下背景与文字颜色切换', async () => {
    await colorScheme('dark')
    await viewport(390)
    await goto('', 900)
    const bg = await ev(`getComputedStyle(document.body).backgroundColor`)
    assert(bg === 'rgb(0, 0, 0)', `深色背景 ${bg}`)
    await colorScheme('light')
    await goto('', 700)
    const bg2 = await ev(`getComputedStyle(document.body).backgroundColor`)
    assert(bg2 === 'rgb(242, 242, 247)', `浅色背景 ${bg2}`)
    return `深色 ${bg} / 浅色 ${bg2}`
  })

  /* ============ 离线（弱网更极端的场景） ============ */

  await test('断网后应用仍可正常渲染与搜索', async () => {
    await send('Network.enable')
    await send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    })
    await ev(`(() => { const i = document.querySelector('.search-input'); if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } })()`)
    await sleep(500)
    const cells = await ev(`document.querySelectorAll('.cell--policy').length`)
    await ev(`(() => { const i=document.querySelector('.search-input'); i.value='勤工'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`)
    await sleep(400)
    const hit = await ev(`document.querySelector('.cell--policy .cell-title')?.textContent.trim()`)
    await send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    })
    assert(cells === 21, `离线渲染条目 ${cells}`)
    assert(hit === '勤工助学', `离线搜索命中「${hit}」`)
    return `离线仍渲染 ${cells} 条，搜索命中 ${hit}`
  })

  /* ============ 易用性 ============ */

  await test('可点击区域尺寸符合触控规范', async () => {
    await goto('')
    const home = await ev(`(() => {
      const minH = (sel) => {
        const els = [...document.querySelectorAll(sel)]
        if (!els.length) return 0
        return Math.round(Math.min(...els.map(e => e.getBoundingClientRect().height)))
      }
      return { row: minH('.cell--policy'), tab: minH('.tab-item') }
    })()`)
    assert(home.row >= 44, `政策行高仅 ${home.row}px`)
    assert(home.tab >= 44, `底部标签高仅 ${home.tab}px`)

    await goto('policy/national-grant')
    const seg = await ev(`Math.round(document.querySelector('.seg-btn').getBoundingClientRect().height)`)
    assert(seg >= 28, `分段控件高 ${seg}px`)

    return `政策行 ${home.row}px · 底部标签 ${home.tab}px · 分段控件 ${seg}px`
  })
  /* ============ 性能 ============ */

  await test('首屏指标与资源体积', async () => {
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await send('Page.navigate', { url: BASE })
    await sleep(1500)
    const perf = await ev(`(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {}
      const res = performance.getEntriesByType('resource')
      const js = res.filter(r => r.name.endsWith('.js')).reduce((s, r) => s + (r.decodedBodySize || 0), 0)
      const css = res.filter(r => r.name.endsWith('.css')).reduce((s, r) => s + (r.decodedBodySize || 0), 0)
      return {
        dcl: Math.round(nav.domContentLoadedEventEnd || 0),
        load: Math.round(nav.loadEventEnd || 0),
        fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
        jsKB: Math.round(js / 1024), cssKB: Math.round(css / 1024)
      }
    })()`)
    assert(perf.dcl < 2000, `DOMContentLoaded ${perf.dcl}ms`)
    assert(perf.fcp < 2000, `FCP ${perf.fcp}ms`)
    const distAssets = readdirSync('dist/assets')
    const jsBytes = distAssets.filter((f) => f.endsWith('.js')).reduce((s, f) => s + statSync('dist/assets/' + f).size, 0)
    const cssBytes = distAssets.filter((f) => f.endsWith('.css')).reduce((s, f) => s + statSync('dist/assets/' + f).size, 0)
    return `FCP ${perf.fcp}ms · DCL ${perf.dcl}ms · JS ${Math.round(jsBytes / 1024)}KB · CSS ${Math.round(cssBytes / 1024)}KB（产物实际体积）`
  })

  await test('JS 堆内存占用', async () => {
    const heap = await ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576*10)/10 : -1`)
    if (heap > 0) assert(heap < 60, `堆占用 ${heap}MB`)
    return heap > 0 ? `${heap} MB` : '浏览器未暴露该指标'
  })

  /* ============ 稳定性 ============ */

  await test('Monkey 随机点击 80 次无未捕获异常', async () => {
    await goto('')
    const before = errors.length
    const clicks = await ev(`(async () => {
      const els = () => [...document.querySelectorAll('.cell--tappable, .seg-btn, .chip, .tab-item, .month-btn')]
      let n = 0
      for (let i = 0; i < 80; i++) {
        const list = els()
        if (!list.length) break
        const el = list[Math.floor(Math.random() * list.length)]
        el.click()
        n++
        await new Promise(r => setTimeout(r, 25))
      }
      return n
    })()`)
    await sleep(800)
    const added = errors.slice(before)
    assert(added.length === 0, `出现异常: ${added.slice(0, 2).join(' | ')}`)
    return `${clicks} 次点击，0 异常`
  })

  await test('连续路由切换 60 次无异常', async () => {
    const before = errors.length
    await ev(`(async () => {
      const ids = ['', 'timeline', 'policy/national-grant', 'policy/work-study', 'policy/green-channel']
      for (let i = 0; i < 60; i++) {
        location.hash = '#/' + ids[i % ids.length]
        await new Promise(r => setTimeout(r, 30))
      }
      location.hash = '#/'
    })()`)
    await sleep(1200)
    const added = errors.slice(before)
    assert(added.length === 0, `出现异常: ${added.slice(0, 2).join(' | ')}`)
    return '60 次切换，0 异常'
  })

  await test('压力：搜索输入高频触发 50 次', async () => {
    await goto('')
    const before = errors.length
    await ev(`(async () => {
      const i = document.querySelector('.search-input')
      const words = ['国奖','贷款','勤工','退役','学费','奖','']
      for (let k = 0; k < 50; k++) {
        i.value = words[k % words.length]
        i.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise(r => setTimeout(r, 10))
      }
      i.value = ''
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await sleep(700)
    const added = errors.slice(before)
    assert(added.length === 0, `异常: ${added.slice(0, 2).join(' | ')}`)
    return '50 次输入，0 异常'
  })
} finally {
  try { ws.close() } catch {}
  try { chrome.kill() } catch {}
  try { server.httpServer.close() } catch {}

  const pass = results.filter((r) => r.ok).length
  console.log(`\n总计 ${results.length} 项：通过 ${pass}，失败 ${failed}`)
  const totalMs = results.reduce((s, r) => s + r.ms, 0)
  console.log(`耗时 ${(totalMs / 1000).toFixed(1)}s`)
  process.exit(failed ? 1 : 0)
}
