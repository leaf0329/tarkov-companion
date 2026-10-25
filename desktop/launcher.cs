using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

internal static class CompanionLauncher
{
    private static string logFile;
    [DllImport("kernel32.dll")] private static extern IntPtr GetConsoleWindow();

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string appRoot = ResolveRoot(args);
            string executable = Path.Combine(appRoot, @"runtime\electron\electron.exe");
            Directory.CreateDirectory(Path.Combine(appRoot, "data"));
            logFile = Path.Combine(appRoot, @"data\launch.log");
            WriteLog("GUI launcher console window: " + GetConsoleWindow().ToInt64());
            if (args.Contains("--restart")) CloseExistingApp(executable);
            var start = new ProcessStartInfo(executable, "\"" + appRoot.TrimEnd('\\') + "\"") {
                WorkingDirectory = appRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            using (var process = new Process { StartInfo = start })
            {
                process.OutputDataReceived += (_, e) => { if (e.Data != null) WriteLog(e.Data); };
                process.ErrorDataReceived += (_, e) => { if (e.Data != null) WriteLog(e.Data); };
                process.Start();
                WriteLog("GUI launcher started app process: " + process.Id);
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                // Keep the redirected pipes open until the app exits, without a console window.
                process.WaitForExit();
                if (process.ExitCode != 0) throw new Exception("助手退出代码：" + process.ExitCode);
                return 0;
            }
        }
        catch (Exception error)
        {
            WriteLog("Launch failed: " + error);
            MessageBox.Show(error.Message + "\n\n启动记录：" + logFile, "leaf0329 · 助手启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string ResolveRoot(string[] args)
    {
        string supplied = args.FirstOrDefault(value => !value.StartsWith("--"));
        string candidate = Path.GetFullPath(supplied ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tarkov-integrated"));
        if (!File.Exists(Path.Combine(candidate, @"runtime\electron\electron.exe"))) throw new FileNotFoundException("找不到助手运行文件，请将启动程序与 tarkov-integrated 文件夹放在一起。");
        return candidate;
    }

    private static void CloseExistingApp(string executable)
    {
        foreach (var process in Process.GetProcessesByName("electron"))
        {
            using (process)
            {
                if (process.MainWindowTitle != "leaf0329 · 塔科夫整合助手") continue;
                if (!String.Equals(process.MainModule.FileName, executable, StringComparison.OrdinalIgnoreCase)) continue;
                if (!process.CloseMainWindow() || !process.WaitForExit(10000)) throw new Exception("请先关闭助手主窗口，再重新启动。当前实例已保留。");
            }
        }
    }

    private static readonly object logLock = new object();
    private static void WriteLog(string message)
    {
        if (logFile == null) return;
        lock (logLock)
        {
            try { File.AppendAllText(logFile, DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine, Encoding.UTF8); }
            catch (IOException) { }
        }
    }
}
