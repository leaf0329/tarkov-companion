$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskExecutable = Join-Path $taskRoot 'runtime\electron\electron.exe'
$taskLogPath = Join-Path $taskRoot 'data\launch.log'
function Write-TaskLaunchLog([string]$taskMessage) {
    [IO.File]::AppendAllText($taskLogPath, ([DateTime]::UtcNow.ToString('o') + ' ' + $taskMessage + [Environment]::NewLine), [Text.Encoding]::UTF8)
}
try {
Write-TaskLaunchLog 'Launcher started.'
if (!(Test-Path -LiteralPath $taskExecutable -PathType Leaf)) {
    throw '助手运行文件缺失，请检查 runtime\electron\electron.exe。'
}
$env:ELECTRON_RUN_AS_NODE = $null
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
try {
    $taskPrincipal = [Security.Principal.WindowsPrincipal]::new($taskIdentity)
    $taskIsAdmin = $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} finally { $taskIdentity.Dispose() }
$taskLaunchOptions = @{
    FilePath = $taskExecutable
    ArgumentList = ('"' + $taskRoot + '"')
    WorkingDirectory = $taskRoot
    WindowStyle = 'Normal'
    PassThru = $true
}
if (!$taskIsAdmin) { $taskLaunchOptions.Verb = 'RunAs' }
$taskProcess = Start-Process @taskLaunchOptions
Write-TaskLaunchLog ('App process started: ' + $taskProcess.Id + '; elevation requested: ' + (!$taskIsAdmin))
if ($taskProcess.WaitForExit(3000) -and $taskProcess.ExitCode -ne 0) {
    throw ('助手启动后提前退出，退出代码：' + $taskProcess.ExitCode)
}
} catch {
    Write-TaskLaunchLog ('Launch failed: ' + $_.Exception.Message)
    Write-Error ('启动失败：' + $_.Exception.Message + [Environment]::NewLine + '详细记录：' + $taskLogPath) -ErrorAction Continue
    exit 1
}
