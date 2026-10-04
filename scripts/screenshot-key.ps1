param([switch]$SelfTest, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
namespace TarkovCapture {
  public static class Native {
    [StructLayout(LayoutKind.Sequential)] public struct Keyboard { public ushort vk,scan; public uint flags,time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct Mouse { public int x,y; public uint data,flags,time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct Hardware { public uint message; public ushort low,high; }
    [StructLayout(LayoutKind.Explicit)] public struct InputUnion {
      [FieldOffset(0)] public Keyboard keyboard;
      [FieldOffset(0)] public Mouse mouse;
      [FieldOffset(0)] public Hardware hardware;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Input { public uint type; public InputUnion value; }
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern uint MapVirtualKeyW(uint code,uint mapType);
    [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,Input[] inputs,int size);
    public static int InputSize { get { return Marshal.SizeOf(typeof(Input)); } }
    public static uint InsertScan { get { return MapVirtualKeyW(0x2D,4); } }
    static bool IsGame(IntPtr window) {
      if(window==IntPtr.Zero)return false;
      uint id;GetWindowThreadProcessId(window,out id);
      try { using(var process=Process.GetProcessById((int)id))return String.Equals(process.ProcessName,"EscapeFromTarkov",StringComparison.OrdinalIgnoreCase); }
      catch { return false; }
    }
    public static string Press(bool dryRun) {
      var window=GetForegroundWindow();
      if(!IsGame(window))return "paused-background";
      foreach(var key in new int[]{0x10,0x11,0x12,0x5B,0x5C,0x2D})if((GetAsyncKeyState(key)&0x8000)!=0)return "paused-keys";
      if(dryRun)return "dry-run";
      var scan=InsertScan;
      if(scan==0)throw new InvalidOperationException("Insert scan code unavailable");
      var down=new Input { type=1,value=new InputUnion { keyboard=new Keyboard { scan=(ushort)(scan&0xFF),flags=8u|1u } } };
      var up=down;up.value.keyboard.flags|=2u;
      if(GetForegroundWindow()!=window)return "paused-background";
      if(SendInput(1,new Input[]{down},InputSize)!=1)throw new InvalidOperationException("SendInput down: "+Marshal.GetLastWin32Error());
      uint released=0;
      // A short hold lets the game's frame-based keyboard reader observe the press.
      try { Thread.Sleep(80); }
      finally { released=SendInput(1,new Input[]{up},InputSize); }
      if(released!=1)throw new InvalidOperationException("SendInput up: "+Marshal.GetLastWin32Error());
      return "sent";
    }
  }
}
'@
function Write-CaptureMessage($taskMessage) { [Console]::WriteLine(($taskMessage | ConvertTo-Json -Compress)) }
if ($SelfTest) {
  Write-CaptureMessage @{kind='self-test';inputSize=[TarkovCapture.Native]::InputSize;insertScan=[TarkovCapture.Native]::InsertScan}
  exit 0
}
Write-CaptureMessage @{kind='ready'}
while ($null -ne ($taskCommand = [Console]::ReadLine())) {
  if ($taskCommand -eq 'stop') { break }
  if ($taskCommand -ne 'press') { continue }
  try { Write-CaptureMessage @{kind='result';phase=[TarkovCapture.Native]::Press([bool]$DryRun)} }
  catch { Write-CaptureMessage @{kind='result';phase='error';error=$_.Exception.Message} }
}
