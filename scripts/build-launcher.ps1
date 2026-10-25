$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$taskOutputFolder = Join-Path $taskRoot 'runtime\launcher'
New-Item -ItemType Directory -Path $taskOutputFolder -Force | Out-Null
$taskOutput = Join-Path $taskOutputFolder 'launcher.exe'
& $taskCompiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll ('/win32manifest:' + (Join-Path $taskRoot 'desktop\launcher.manifest')) ('/out:' + $taskOutput) (Join-Path $taskRoot 'desktop\launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Copy-Item -LiteralPath $taskOutput -Destination (Join-Path (Split-Path $taskRoot -Parent) '启动塔科夫助手.exe') -Force
