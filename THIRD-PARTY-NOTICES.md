# 来源与许可

- 本地窗口、保存层与整合修改：Copyright (C) 2026 leaf0329，AGPL-3.0-only，见 LICENSE。
- TarkovTracker：GPL-3.0，https://github.com/tarkovtracker-org/TarkovTracker ，许可全文位于 source/tracker/LICENSE.md。复用了中文任务界面、任务树、目标地图、Leaflet 渲染和本机进度模型。
- TarkovMonitor：GPL-3.0，https://github.com/the-hideout/TarkovMonitor ，许可全文位于 source/monitor/LICENSE.txt。LocalMonitor 使用 GameWatcher、LogMonitor、LogMessageTypes 与 MatchingNotificationPolicy；本地修改支持指定截图目录和通知时间戳。
- tarkov.dev：MIT，https://github.com/the-hideout/tarkov-dev ，源代码及许可证保留在 source/maps。公开数据来自 json.tarkov.dev；任务数据的最终获取及适配使用 TarkovTracker 的原有接口。
- 地点名称和坐标：复用上述 tarkov.dev 的 `src/data/maps.json`，由 `scripts/sync-map-landmarks.mjs` 提取至本地地图数据；中文名称由本地整合补充，保留原名以便对照。
- Electron 与 Chromium：运行时许可保留在 runtime/electron。
- Koffi 3.3.3：MIT，https://koffi.dev/ ，用于助手自身 Windows 小窗的鼠标消息处理；许可全文保留在 node_modules/koffi/LICENSE.txt。
- Leaflet、Nuxt、Vue、Pinia 及其他依赖：各自原有许可随上游依赖保留。
- 社区 SVG 地图：Shebuka / tarkov-dev-svg-maps，CC BY-NC-SA 4.0；游戏画像、头像与图像归 Battlestate Games 及原权利人所有，不因整合而改用项目代码许可。

这是本机整合版；没有将第三方项目冒称为 leaf0329 原创。

2026-10-30 活动资料：旧工厂 SVG 来自 the-hideout/tarkov-dev-svg-maps 的 172cd23f43f95a302d2f7157507a5d2959d153a0，存为 Factory-PreRework.svg；坐标框架参照 the-hideout/tarkov-dev 的 fd4e5e72605b8027d5316f5c6aa7f3d4ebec239c。素材继续遵循上述 SVG 项目的许可。活动地图与撤离来源记录位于 source/maps/src/data/companion-event-maps.json；活动攻略按 2026-10-30 的 Tarkov.Help、TarkovHead 社区图文概括，具体链接随各条目保留，没有复制攻略全文或照片。未核实的任务编号和坐标不冒充正式数据。

2026-11-15 常驻 PvE 任务补充：任务编号、中文名称、目标条件及社区地图点位参照 EFT 中文 Wiki（https://www.eftarkov.com/task-tree），与 TarkovTracker 公开资料 1.177 对照；逐条来源和校准误差记录在 data/catalog/verified-pve-task-supplements.json。仅整理事实资料，未复制任务剧情、对话、攻略全文或图片。来源内容和游戏素材的权利仍归原权利人；项目代码许可不改变这些权利。地图像素点转换到游戏 X/Z 使用现有公开钥匙门坐标作校准，转换点的高度只是同层参考，未在真实战局逐点核实。灯塔 Shifting Balance 临时任务线未按常驻任务导入。

2026-11-18 插画地图与邪教徒参考范围：

- 插画原图取自使用者提供的资料包与既有本地图像，原图保留于 source/maps/public/materials；逐图作者、文件和校准事实记录在 source/maps/src/data/companion-material-calibration.json。中文翻译/制图署名包含 MR茼蒿，中心区原图为 xTychoYT，实验室原图为 FatalBulletHit，其他署名以原图水印为准。未知素材未宣称为本项目原创或 AGPL 授权。
- RE3MR 地图（https://reemr.se/ ，许可说明 https://reemr.se/about/）继续遵循作者的 CC BY-NC-SA 4.0；本次对其中部分图片进行了裁切、几何配准和瓦片化。原图、衍生瓦片及其他第三方图像各自保留原许可，本项目代码的 AGPL 不改变它们的使用限制。
- 灯塔使用 RE3MR v1.7 原图；数值校准事实参照 David04-09/tarkov-companion 的 src/maps/mapConfig.ts（https://github.com/David04-09/tarkov-companion/blob/main/src/maps/mapConfig.ts），该来源将其标注为约 20 米精度的初步对齐。未复制该项目的界面或运行代码。
- 邪教徒范围由 EFT 中文 Wiki 社区图的区域轮廓和 TarkovTracker 公开 API 的 sectantPriest 刷新坐标整理；逐项来源和日期保存在 source/tracker/app/data/companionCultistAreas.json。普通 PvE/PvP 坐标于 2026-11-18 核对，时段参照 Cultists Wiki（https://escapefromtarkov.fandom.com/wiki/Cultists）。红圈为公开范围的包围参考，不是游戏内实时检测结果；未混入节日三人组。

2026-11-23 第一赛季文件点位：8 类物品的真实编号和参考位置来自 TarkovTracker 公开 `/api/tarkov/tasks-core` 数据（https://tarkovtracker.org/api/tarkov/tasks-core?lang=zh&gameMode=pve），上游为 tarkov.dev，核对资料版本 1.185；逐项位置和来源保存在 source/tracker/app/data/companionSeasonDocuments.json，已对照 PvP 位置。公开接口把同一参考位置的可见物品分组合并，多类文件用多色点保留。文件类别与地图分布对照 TarkovHead 第一赛季页（https://www.tarkovhead.com/en/season/kord-breach-season-1-1）；未复制社区截图、攻略正文或运行代码。游戏资料与图片的权利仍归原权利人；本项目代码的 AGPL 不改变这些权利。破冰船因上游缺少文件位置、社区坐标及楼层存在冲突而暂不导入。
