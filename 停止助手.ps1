$ErrorActionPreference = 'Stop'
$taskPidFile = Join-Path $PSScriptRoot 'data\server.pid'
if (Test-Path -LiteralPath $taskPidFile) {
    $taskServerPid = [int](Get-Content -LiteralPath $taskPidFile)
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskServerPid" -ErrorAction SilentlyContinue
    $taskExpectedRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
    if ($taskProcess -and $taskProcess.Name -eq 'node.exe') {
        $taskPortOwner = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 18765 -State Listen -ErrorAction SilentlyContinue
        $taskExpectedServer = (Join-Path $taskExpectedRoot 'server.mjs').Replace('\','/')
        if ($taskPortOwner.OwningProcess -contains $taskServerPid -and $taskProcess.CommandLine.Replace('\','/').Contains($taskExpectedServer)) { Stop-Process -Id $taskServerPid }
    }
    Remove-Item -LiteralPath $taskPidFile
}
