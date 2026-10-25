$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$taskCompiler = & $taskVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'VC\Tools\MSVC\**\bin\Hostx64\x64\cl.exe'
if (!$taskCompiler) { throw 'Microsoft C++ Build Tools (x64) are required to build the overlay input DLL.' }
$taskVc = [IO.Path]::GetFullPath((Join-Path (Split-Path $taskCompiler -Parent) '..\..\..'))
$taskSdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$taskSdkVersion = Get-ChildItem -LiteralPath (Join-Path $taskSdk 'Include') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 -ExpandProperty Name
$taskArtifacts = Join-Path $taskRoot 'data\acceptance\overlay-native-build'
$taskOutput = Join-Path $taskRoot 'runtime\overlay'
New-Item -ItemType Directory -Path $taskArtifacts, $taskOutput -Force | Out-Null
& $taskCompiler /nologo /LD /MT /O2 /W4 /WX `
    ('/I' + (Join-Path $taskVc 'include')) `
    ('/I' + (Join-Path $taskSdk "Include\$taskSdkVersion\um")) `
    ('/I' + (Join-Path $taskSdk "Include\$taskSdkVersion\shared")) `
    ('/I' + (Join-Path $taskSdk "Include\$taskSdkVersion\ucrt")) `
    ('/Fo' + (Join-Path $taskArtifacts 'overlay-input.obj')) `
    (Join-Path $taskRoot 'native\overlay-input.c') /link /MACHINE:X64 `
    ('/LIBPATH:' + (Join-Path $taskVc 'lib\x64')) `
    ('/LIBPATH:' + (Join-Path $taskSdk "Lib\$taskSdkVersion\um\x64")) `
    ('/LIBPATH:' + (Join-Path $taskSdk "Lib\$taskSdkVersion\ucrt\x64")) `
    ('/IMPLIB:' + (Join-Path $taskArtifacts 'CompanionOverlay.lib')) `
    ('/OUT:' + (Join-Path $taskOutput 'CompanionOverlay.dll')) comctl32.lib
if ($LASTEXITCODE -ne 0) { throw 'Overlay input compilation failed.' }
