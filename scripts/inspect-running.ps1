param([Parameter(Mandatory=$true)][int]$AssistantPid,[switch]$Observe,[switch]$RepairOverlay,[switch]$Quit)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$env:ELECTRON_RUN_AS_NODE='1'
$taskArguments = @((Join-Path $PSScriptRoot 'inspect-running.cjs'), "$AssistantPid")
if ($Observe) { $taskArguments += '--observe' }
if ($RepairOverlay) { $taskArguments += '--repair-overlay' }
if ($Quit) { $taskArguments += '--quit' }
& (Join-Path $taskRoot 'runtime\electron\electron.exe') @taskArguments
exit $LASTEXITCODE
