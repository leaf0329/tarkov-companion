using System.Text;
using System.Text.Json;
using System.Diagnostics;
using TarkovMonitor;
using MonitorTaskStatus = TarkovMonitor.TaskStatus;

Console.OutputEncoding = new UTF8Encoding(false);
var gate = new object();
void Emit(object value) { lock(gate)Console.WriteLine(JsonSerializer.Serialize(value)); }
var config = JsonSerializer.Deserialize<MonitorConfig>(File.ReadAllText(args[0]))!;
TarkovMonitor.Properties.Settings.Default.customLogsPath = config.logsPath;
TarkovMonitor.Properties.Settings.Default.customScreenshotsPath = config.screenshotsPath;
using var maps = JsonDocument.Parse(File.ReadAllText(config.mapsPath));
TarkovDev.Maps = maps.RootElement.GetProperty("data").GetProperty("maps").Deserialize<Dictionary<string,TarkovDev.Map>>()!.Values.ToList();
void Connect(GameWatcher watcher, bool history) {
    void Profile(Profile profile) => Emit(new {kind="profile",profile=profile.Id,mode=profile.TarkovDevPlayerMode,history});
    watcher.TaskModified += (_, e) => {
        if(e.Profile.SessionMode != EftSessionMode.PVE || string.IsNullOrEmpty(e.Profile.Id))return;
        var status=e.LogContent.Status switch {MonitorTaskStatus.Started=>"active",MonitorTaskStatus.Failed=>"failed",MonitorTaskStatus.Finished=>"completed",_=>"unknown"};
        if(status=="unknown")return;
        var at=e.LogContent.message.dt>0?e.LogContent.message.dt*1000:DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Emit(new {kind="quest",id=e.LogContent.TaskId,status,profile=e.Profile.Id,at,history});
    };
    watcher.ProfileReady += (_,e)=>Profile(e.Profile);
    watcher.ProfileChanged += (_,e)=>Profile(e.Profile);
    watcher.InitialReadComplete += (_,e)=>Profile(e.Profile);
    watcher.MapLoading += (_,e)=>{if(e.RaidInfo?.Map!=null){Profile(e.Profile);Emit(new {kind="map",map=e.RaidInfo.Map.id,mode=e.Profile.TarkovDevPlayerMode,profile=e.Profile.Id,history});}};
    watcher.MapLoaded += (_,e)=>{if(e.RaidInfo?.Map!=null){Profile(e.Profile);Emit(new {kind="map",map=e.RaidInfo.Map.id,mode=e.Profile.TarkovDevPlayerMode,profile=e.Profile.Id,history});}};
    watcher.RaidStarted += (_,e)=>Emit(new {kind="raid",value="raid",history});
    watcher.RaidEnded += (_,e)=>Emit(new {kind="raid",value="lobby",history});
    watcher.RaidStopping += (_,e)=>Emit(new {kind="raid",value="lobby",history});
    watcher.ExitedPostRaidMenus += (_,e)=>Emit(new {kind="raid",value="lobby",history});
    watcher.GameStopped += (_,e)=>Emit(new {kind="raid",value="lobby",history});
    watcher.PlayerPosition += (_,e)=>{if(e.Profile.SessionMode is EftSessionMode.PVE or EftSessionMode.Regular or EftSessionMode.Seasonal)Emit(new {kind="position",mode=e.Profile.TarkovDevPlayerMode,map=e.RaidInfo.Map.id,profile=e.Profile.Id,x=e.Position.X,y=e.Position.Y,z=e.Position.Z,yaw=e.Rotation,filename=e.Filename,at=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()});};
    watcher.ExceptionThrown += (_,e)=>Emit(new {kind="error",context=e.Context,message=e.Exception.Message});
}
var historical = new GameWatcher(true);
Connect(historical,true);
var profiles=historical.DiscoverProfiles().Where(p=>p.Profile.SessionMode==EftSessionMode.PVE).ToList();
var selected=profiles.OrderByDescending(p=>p.LastSeenUtc).FirstOrDefault()?.Profile;
if(selected!=null){
    var start=historical.GetLogBreakpoints().Where(p=>p.Profile.Id==selected.Id && p.Profile.SessionMode==EftSessionMode.PVE).OrderBy(p=>p.Date).FirstOrDefault();
    if(start!=null)historical.ProcessLogsFromBreakpoint(start);
}
var live = new GameWatcher();
Connect(live,false);
live.Start();
Emit(new {kind="ready",engine="TarkovMonitor 2.2.1.0",profile=selected?.Id});
if(args.Contains("--replay-only"))return;
if(config.parentProcessId>0){using var parent=Process.GetProcessById(config.parentProcessId);await parent.WaitForExitAsync();}
else await Task.Delay(Timeout.Infinite);

sealed class MonitorConfig {
    public string logsPath { get; set; } = "";
    public string screenshotsPath { get; set; } = "";
    public string mapsPath { get; set; } = "";
    public int parentProcessId { get; set; }
}
