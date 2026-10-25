namespace TarkovMonitor {
    public static class TarkovDev {
        public static List<Map> Maps { get; set; } = new();
        public class Map {
            public string id { get; set; } = "";
            public string name { get; set; } = "";
            public string nameId { get; set; } = "";
            public string normalizedName { get; set; } = "";
            public string scenePath { get; set; } = "";
        }
    }
}
namespace TarkovMonitor.Properties {
    public sealed class Settings {
        public static Settings Default { get; } = new();
        public string customLogsPath { get; set; } = "";
        public string customScreenshotsPath { get; set; } = "";
        public string customMap { get; set; } = "";
    }
}
