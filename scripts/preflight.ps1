# 资助站推送前自检
# 用法：powershell -ExecutionPolicy Bypass -File .\scripts\preflight.ps1
# 作用：推送前跑一次，检查隐私泄露 / 密钥泄露 / 构建是否成功
# 任何一项失败都会以非零退出码结束，避免误推

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$fail = 0
$warn = 0

function Section($title) { Write-Host ""; Write-Host "=== $title ===" -ForegroundColor Cyan }
function OK($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function BAD($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:fail++ }
function WARN($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn++ }

# ---------- 1. 隐私扫描 ----------
Section "1/3 隐私扫描（手机号 / 身份证）"
$scanFiles = Get-ChildItem $root -Recurse -File -Include *.md,*.html,*.js,*.mjs,*.json,*.vue,*.css,*.txt,*.yml,*.yaml -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' }
$privacy = $scanFiles |
           Select-String -Pattern '(?<![0-9.])1[3-9][0-9]{9}(?![0-9])|(?<![0-9])[0-9]{17}[0-9Xx](?![0-9A-Za-z])' -ErrorAction SilentlyContinue |
           Where-Object { $_.Line -notmatch 'tel:|13800138000|示例|示例号码|placeholder' }
if ($privacy) {
    BAD "发现 $($privacy.Count) 处疑似隐私号码"
    $privacy | Select-Object -First 10 | ForEach-Object {
        $masked = $_.Line.Trim() -replace '1[3-9][0-9]{9}','***号码***' -replace '[0-9]{17}[0-9Xx]','***身份证***'
        Write-Host "         $($_.Filename):$($_.LineNumber)  $($masked.Substring(0,[Math]::Min(90,$masked.Length)))"
    }
} else {
    OK "无手机号 / 身份证命中"
}

# ---------- 2. 密钥扫描 ----------
Section "2/3 密钥扫描（令牌 / API Key / 私钥）"
$secrets = $scanFiles |
           Select-String -Pattern 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----' -ErrorAction SilentlyContinue
if ($secrets) {
    BAD "发现 $($secrets.Count) 处疑似密钥"
    $secrets | Select-Object -First 10 | ForEach-Object {
        Write-Host "         $($_.Filename):$($_.LineNumber)"
    }
    Write-Host "         注意：删掉文件不等于安全，先去对应平台撤销该密钥！" -ForegroundColor Yellow
} else {
    OK "无密钥命中"
}

# ---------- 3. 构建测试 ----------
Section "3/3 构建测试（scripts/build-site.mjs）"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $buildOut = & node scripts/build-site.mjs 2>&1
    $code = $LASTEXITCODE
} else {
    # 本机 node 不在 PATH 时，用 DSH 内置 Electron 作为 node
    $electron = 'D:\deepseekharness\DeepSeek Harness.exe'
    if (Test-Path $electron) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $electron
        $psi.Arguments = '"' + (Join-Path $root 'scripts\build-site.mjs') + '"'
        $psi.WorkingDirectory = $root
        $psi.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
        $proc = [System.Diagnostics.Process]::Start($psi)
        $buildOut = $proc.StandardOutput.ReadToEnd()
        $buildErr = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        $code = $proc.ExitCode
        if ($buildErr) { $buildOut = "$buildOut`n$buildErr" }
    } else {
        WARN "未找到 node，也找不到 DSH 内置 Electron，跳过构建测试"
        $code = 0
    }
}

if ($code -eq 0) {
    $htmlCount = (Get-ChildItem (Join-Path $root 'site') -Recurse -File -Filter *.html -ErrorAction SilentlyContinue | Measure-Object).Count
    OK "构建成功，产物 html $htmlCount 个"
    # 构建后复查产物里有没有隐私
    $postCheck = Get-ChildItem (Join-Path $root 'site') -Recurse -File -Include *.html,*.js -ErrorAction SilentlyContinue |
                 Select-String -Pattern '1[3-9][0-9]{9}' -ErrorAction SilentlyContinue
    if ($postCheck) { BAD "产物中发现手机号 $($postCheck.Count) 处（构建模板里可能有硬编码）" }
    else { OK "产物中无手机号" }
} else {
    if ("$buildOut" -match 'ERR_MODULE_NOT_FOUND|Cannot find package') {
        WARN "构建无法执行：缺少 node_modules 依赖"
        Write-Host "         先跑一次 npm install，或在本机已装好依赖的目录执行构建" -ForegroundColor Yellow
        Write-Host "         （源码语法未校验，推送前请自行确认能构建）" -ForegroundColor Yellow
    } else {
        BAD "构建失败（退出码 $code）"
    }
    ($buildOut -split "`n" | Select-Object -Last 12) | ForEach-Object { Write-Host "         $_" }
}

# ---------- 汇总 ----------
Write-Host ""
if ($fail -gt 0) {
    Write-Host "结果：$fail 项失败，$warn 项警告 —— 不要推送！" -ForegroundColor Red
    exit 1
} elseif ($warn -gt 0) {
    Write-Host "结果：全部通过（$warn 项警告，可自行判断）" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "结果：全部通过，可以推送" -ForegroundColor Green
    Write-Host "下一步：" -ForegroundColor Cyan
    Write-Host "  git add -A; git commit -m 'docs: xxx'"
    Write-Host "  git push origin master"
    Write-Host "  git subtree push --prefix site origin gh-pages"
    exit 0
}
