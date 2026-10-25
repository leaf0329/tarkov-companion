# 来源与许可

- 本地窗口、保存层与整合修改：Copyright (C) 2026 leaf0329，AGPL-3.0-only，见 LICENSE。
- TarkovTracker：GPL-3.0，https://github.com/tarkovtracker-org/TarkovTracker ，许可全文位于 source/tracker/LICENSE.md。复用了中文任务界面、任务树、目标地图、Leaflet 渲染和本机进度模型。
- TarkovMonitor：GPL-3.0，https://github.com/the-hideout/TarkovMonitor ，许可全文位于 source/monitor/LICENSE.txt。LocalMonitor 使用 GameWatcher、LogMonitor、LogMessageTypes 与 MatchingNotificationPolicy；本地修改支持指定截图目录和通知时间戳。
- tarkov.dev：MIT，https://github.com/the-hideout/tarkov-dev ，源代码及许可证保留在 source/maps。公开数据来自 json.tarkov.dev；任务数据的最终获取及适配使用 TarkovTracker 的原有接口。
- 地点名称和坐标：复用上述 tarkov.dev 的 `src/data/maps.json`，由 `scripts/sync-map-landmarks.mjs` 提取至本地地图数据；中文名称由本地整合补充，保留原名以便对照。
- Electron 与 Chromium：运行时许可保留在 runtime/electron。
- Microsoft .NET 10 运行时：MIT，许可与第三方声明保留在 runtime/monitor/DOTNET-LICENSE.TXT 和 DOTNET-THIRD-PARTY-NOTICES.TXT。
- Koffi 3.3.3：MIT，https://koffi.dev/ ，用于助手自身 Windows 小窗的鼠标消息处理；许可全文保留在 node_modules/koffi/LICENSE.txt。
- Leaflet、Nuxt、Vue、Pinia 及其他依赖：各自原有许可随上游依赖保留。
- 社区 SVG 地图：Shebuka / tarkov-dev-svg-maps，CC BY-NC-SA 4.0；游戏画像、头像与图像归 Battlestate Games 及原权利人所有，不因整合而改用项目代码许可。

这是本机整合版；没有将第三方项目冒称为 leaf0329 原创。
