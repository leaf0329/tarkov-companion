$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskPort = 18765
$taskUrl = "http://127.0.0.1:$taskPort"
$taskNode = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $taskNode) { $taskNode = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $taskNode)) { throw '找不到 Node.js。请安装 Node.js 22 或以上版本后重试。' }
$taskRunning = $false
try { $taskState = Invoke-RestMethod -Uri "$taskUrl/api/state" -TimeoutSec 2; $taskRunning = [bool]$taskState.settings.logsPath } catch {}
if (-not $taskRunning) {
    $taskServerArgument = '"' + (Join-Path $taskRoot 'server.mjs') + '"'
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @($taskServerArgument) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'data\server-output.log') -RedirectStandardError (Join-Path $taskRoot 'data\server-error.log') -PassThru
    Set-Content -LiteralPath (Join-Path $taskRoot 'data\server.pid') -Value $taskProcess.Id
    for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
        Start-Sleep -Milliseconds 300
        try { $taskState = Invoke-RestMethod -Uri "$taskUrl/api/state" -TimeoutSec 1; $taskRunning = [bool]$taskState.settings.logsPath; if ($taskRunning) { break } } catch {}
    }
    if (-not $taskRunning) { throw "助手启动失败。请查看 $taskRoot\data\server-error.log" }
}
$taskEdge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $taskEdge)) { $taskEdge = Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe' }
if (Test-Path -LiteralPath $taskEdge) { Start-Process -FilePath $taskEdge -ArgumentList @("--app=$taskUrl", '--window-size=1480,940') -WindowStyle Normal }
else { Start-Process $taskUrl }
