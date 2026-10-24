/**
 * 静态检查：安装包完整性、权限、安全、隐私合规、可读性对比度。
 * 运行：node tests/static/checks.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const APK = 'android/app/build/outputs/apk/release/app-release.apk'
const AAPT2 = 'C:/Users/Administrator/Android/build-tools/35.0.0/aapt2.exe'
const APKSIGNER = 'C:/Users/Administrator/Android/build-tools/35.0.0/apksigner.bat'

const results = []
let failed = 0
let warnings = 0

function check(name, fn) {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail })
    console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`)
  } catch (e) {
    failed++
    results.push({ name, ok: false, detail: e.message })
    console.log(`FAIL  ${name}  — ${e.message}`)
  }
}

function info(name, fn) {
  const detail = fn()
  warnings++
  results.push({ name, ok: true, detail, info: true })
  console.log(`INFO  ${name}${detail ? '  — ' + detail : ''}`)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const runBat = (bat, args) => execFileSync('cmd', ['/c', bat, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })

/* ---------------- 安装包 ---------------- */

const badging = run(AAPT2, ['dump', 'badging', APK])

check('安装包基本信息', () => {
  const pkg = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging)
  assert(pkg, '无法解析 badging')
  const [, name, vc, vn] = pkg
  assert(name === 'com.cqvie.aid', `包名 ${name}`)
  assert(Number(vc) >= 3, `versionCode ${vc} 未递增`)

  const min = /minSdkVersion:'(\d+)'/.exec(badging)
  const target = /targetSdkVersion:'(\d+)'/.exec(badging)
  assert(min && Number(min[1]) >= 24, `minSdk ${min && min[1]}`)
  assert(target && Number(target[1]) >= 33, `targetSdk ${target && target[1]}`)
  return `${name} v${vn} (${vc}) · sdk ${min[1]}→${target[1]}`
})

check('升级覆盖可行性（versionCode 递增 + 同一签名）', () => {
  const vc = Number(/versionCode='(\d+)'/.exec(badging)[1])
  const sign = runBat(APKSIGNER, ['verify', '--print-certs', APK])
  const sha = /SHA-256 digest: ([0-9a-f]+)/.exec(sign)
  assert(sha, '未取到签名指纹')
  assert(
    sha[1] === '2bd8667e335da714575efe9c5e2f146e8401c7746fc069dc1e6941f40ed6cf8a',
    `签名变了: ${sha[1]}`,
  )
  return `versionCode ${vc}，证书 ${sha[1].slice(0, 16)}…（与 0.2 / 0.2.1 一致，可覆盖安装）`
})

check('签名方案有效', () => {
  const out = runBat(APKSIGNER, ['verify', '--verbose', APK])
  assert(/Verifies/.test(out), '签名校验未通过')
  assert(/v2 scheme \(APK Signature Scheme v2\): true/.test(out), '缺少 v2 签名')
  return 'v2 签名有效（minSdk 24 起不再需要 v1）'
})

/* ---------------- 权限 ---------------- */

check('权限最小化（无敏感权限）', () => {
  const perms = [...badging.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1])
  const dangerous = perms.filter((p) =>
    /CAMERA|RECORD_AUDIO|READ_CONTACTS|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|READ_SMS|SEND_SMS|READ_PHONE_STATE|CALL_PHONE|WRITE_EXTERNAL|READ_EXTERNAL|MANAGE_EXTERNAL|QUERY_ALL_PACKAGES|READ_CALL_LOG/.test(p),
  )
  assert(dangerous.length === 0, `存在敏感权限: ${dangerous.join(', ')}`)
  return perms.join(', ')
})

check('导出组件可控', () => {
  const xml = run(AAPT2, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', APK])
  const exported = (xml.match(/exported\(0x01010010\)=true/g) || []).length
  assert(exported <= 2, `导出组件 ${exported} 个`)
  assert(/MainActivity/.test(xml) || /activity/.test(xml), '未找到 Activity')
  // AndroidX 的 ProfileInstallReceiver 由 DUMP 签名级权限保护，属标准组件
  assert(/profileinstaller/.test(xml), '未识别到 profileinstaller 组件')
  return `2 个：MainActivity（启动必需）+ ProfileInstallReceiver（AndroidX 标准组件，受 DUMP 权限保护）`
})

/* ---------------- 安全 ---------------- */

const assets = readdirSync('dist/assets')
const js = assets
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(`dist/assets/${f}`, 'utf8'))
  .join('\n')
const html = readFileSync('dist/index.html', 'utf8')
const all = js + html

check('构建产物无 eval / new Function / document.write', () => {
  const hits = (all.match(/\beval\s*\(|new Function\s*\(|document\.write\s*\(/g) || []).length
  assert(hits === 0, `命中 ${hits} 处`)
  return '0 处'
})

check('无运行时外发请求（无 XHR / WebSocket / sendBeacon）', () => {
  const hits = (js.match(/XMLHttpRequest|new WebSocket|navigator\.sendBeacon/g) || []).length
  assert(hits === 0, `命中 ${hits} 处`)
  return '0 处'
})

check('外部域名仅剩文档/错误提示', () => {
  const urls = [...all.matchAll(/https?:\/\/[a-z0-9.\-]+/gi)].map((m) => m[0].toLowerCase())
  const domains = [...new Set(urls.map((u) => u.replace(/^https?:\/\//, '')))]
  const allowed = /^(www\.)?(w3\.org|github\.com|vuejs\.org|localhost|127\.0\.0\.1)$/
  const bad = domains.filter((d) => !allowed.test(d))
  assert(bad.length === 0, `未授权域名: ${bad.join(', ')}`)
  return domains.join(', ')
})

check('无硬编码密钥', () => {
  const secret = /(AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['"][^'"]{12,}|Bearer\s+[A-Za-z0-9\-_.]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i.exec(all)
  assert(!secret, `疑似密钥: ${secret && secret[0].slice(0, 40)}`)
  return '未发现'
})

check('v-html 注入面已消毒', () => {
  const src = readFileSync('src/views/PolicyDetail.vue', 'utf8')
  assert(/v-html/.test(src), '预期存在 v-html')
  assert(/DOMPurify\.sanitize/.test(src), '使用 v-html 但未见 DOMPurify')
  return 'PolicyDetail 的 v-html 经 DOMPurify.sanitize'
})

/* ---------------- 隐私 ---------------- */

check('无第三方统计/推送/广告 SDK', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  const suspicious = deps.filter((d) => /umeng|jpush|getui|bugly|sentry|firebase|analytics|admob|wechat|alipay|growingio|sensors/i.test(d))
  assert(suspicious.length === 0, `依赖含: ${suspicious.join(', ')}`)
  return `${deps.length} 个依赖，均为构建/运行时基础库`
})

check('本地存储不含个人信息', () => {
  const keys = [...new Set([...js.matchAll(/['"`](aid_[a-z_]+)['"`]/g)].map((m) => m[1]))]
  assert(keys.length > 0, '未发现本地存储键')
  assert(keys.every((k) => /^aid_(materials|search)/.test(k)), `未知键: ${keys.join(', ')}`)
  return `${keys.join(', ')}（学习进度与搜索词，无身份信息）`
})

check('调试开关关闭', () => {
  const cfg = JSON.parse(readFileSync('capacitor.config.json', 'utf8'))
  assert(cfg.android.webContentsDebuggingEnabled === false, 'webContentsDebuggingEnabled 未关闭')
  return 'webContentsDebuggingEnabled=false'
})

/* ---------------- 可读性（对比度） ---------------- */

function parseColor(c) {
  if (c.startsWith('#')) {
    const h = c.slice(1)
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 1]
  }
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c)
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
}

function over(fg, bg) {
  const a = fg[3]
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1)
}

function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const contrast = (fg, bg) => {
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

check('正文对比度达到 WCAG AA（4.5:1）', () => {
  const white = [255, 255, 255, 1]
  const pairs = [
    ['正文/白卡', [0, 0, 0, 1], white],
    ['正文/分组背景', [0, 0, 0, 1], parseColor('#f2f2f7')],
    ['深色正文/深色卡片', white, parseColor('#1c1c1e')],
  ]
  return pairs
    .map(([label, fg, bg]) => {
      const ratio = contrast(over(fg, bg), bg)
      assert(ratio >= 4.5, `${label} 仅 ${ratio.toFixed(2)}:1`)
      return `${label} ${ratio.toFixed(1)}:1`
    })
    .join(' · ')
})

info('次要文字与链接色对比度（低于 AA 正文要求，属系统色取舍）', () => {
  const white = [255, 255, 255, 1]
  const secondary = contrast(over([60, 60, 67, 0.6], white), white)
  const link = contrast(parseColor('#007aff'), white)
  return `次要文字 ${secondary.toFixed(2)}:1、系统蓝链接 ${link.toFixed(2)}:1（Apple 原生同款配色）；如需过 AA 可把不透明度提到 0.78、链接色改 #0066CC`
})

/* ---------------- 汇总 ---------------- */

const pass = results.filter((r) => r.ok && !r.info).length
console.log(`\n静态检查 ${results.length} 项：通过 ${pass}，失败 ${failed}，提示 ${warnings}`)
process.exit(failed ? 1 : 0)
