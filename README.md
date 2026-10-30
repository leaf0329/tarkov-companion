# leaf0329 · 塔科夫助手

Windows 本地助手，提供官方 PvE 任务与藏身处进度、任务树、截图定位地图和置顶小地图。PvP 提供实时地图，位置与朝向在每次游戏截图后更新。整合界面基于 TarkovTracker，日志解析基于 TarkovMonitor，地图配置与地点资料来自 tarkov.dev。

**[下载 v2.1.1 纯净便携版](https://github.com/leaf0329/tarkov-companion/releases/tag/v2.1.1)** · [使用说明](使用说明.md) · [更新记录](CHANGELOG.md)

## 使用

1. 下载 Release 附件 `leaf0329-Tarkov-Companion-2.1.1-win-x64.zip`，完整解压到可写文件夹或 U 盘。
2. 双击外层的 **启动塔科夫助手.exe**，按 Windows 提示确认管理员权限。保留它与 `tarkov-integrated` 文件夹的相对位置；普通使用无需安装 Node.js 或 .NET SDK。
3. 在“本地设置”选择游戏 Logs 和 Screenshots 目录，点击底部“保存全部设置”。游戏截图键设为 **Insert**。
4. 默认 **F11** 显示或隐藏置顶小地图。自动截图和截图清理默认关闭，需要定位时可在地图顶部开启自动截图。

左键拖动地图，滚轮缩放，Ctrl + 滚轮或顶部菜单切换楼层。关闭“跟随”可规划路线；右下角重置按钮显示全图。关闭主窗口会停止本助手服务，小地图的关闭按钮只隐藏小地图。

便携包的进度、目录与浏览器状态均为空白。使用后的数据保存在 `tarkov-integrated/data`。换电脑后重新选择游戏目录；给其他人使用时，分享原始纯净压缩包。

## 地图与任务

- 支持 1.3.0.0 的工厂疫区与实验室疫区，保留独立地图编号、楼层和定位。工厂疫区使用旧工厂 SVG；活动撤离名称和参考位置按社区资料单独补充，详情显示活动规则。尚未在真实战局中逐点验收。
- 主窗口顶部“活动攻略”收录四项 2026 万圣节任务的完整目标、前置与来源，核对日期为 2026-10-30。活动任务编号、PvE 开放范围仍待确认，攻略不自动改写任务状态；个别房间号资料存在冲突，会在页面注明。
- 主地图和小地图同步任务、位置、截图与跟随开关；小窗口支持缩放、移动和不透明度设置。
- 同一任务的所有未完成目标点同时显示。点击某个任务点会展开它对应的目标、地点、物品和钥匙，点击“展开完整任务”查看其他要求。
- 工具栏的“钥匙房”可开关当前楼层的钥匙标点，记住本机选择；点击标点查看钥匙名称、楼层与供电要求。
- 点击撤离点名称或圆点，查看可用阵营、撤离条件和楼层。未收录的额外限制或楼层会明确提示，是否开放以游戏本局撤离列表为准。
- 地点名称按地图和楼层显示，任务详情仅在点击时打开。详情内容可滚动，关闭按钮保留在顶部。
- 任务树、目标勾选和藏身处进度保存在本机，无需登录。公开任务数据、部分头像和地图瓦片仍可能需要联网。

定位按截图间隔更新；楼层判断结合上游高度和建筑范围，未在游戏内逐地图逐点验收。任务状态可由日志同步，目标计数仍可手动勾选。PvP 不提供任务进度跟踪。

## 源码与构建

本标签包含这份便携版对应的未混淆源码、依赖锁文件、地图资源及构建脚本。运行时二进制和构建缓存在 Release 中提供，不纳入 Git。

- `desktop/`：Electron 主程序、持久化、窗口和启动器。
- `native/`：本地日志组件与小窗鼠标输入组件。
- `source/tracker/`：TarkovTracker 源码及本地整合修改。
- `source/monitor/`：TarkovMonitor 源码及日志适配修改。
- `source/maps/`：tarkov.dev 源码和地图配置。
- `scripts/`：前端构建、原生组件构建、资料缓存与纯净打包。
- `data/catalog/`：公开资料快照；个人存档、目录、缓存、截图和诊断记录不在仓库中。

在 Windows x64 上开发，使用上游要求的 Node.js `>=24.21.0`、锁文件声明的 pnpm `11.14.0`。重编译日志组件需要 .NET 10 SDK；重编译小窗输入组件需要 Microsoft C++ Build Tools（x64）及 Windows 10 SDK。

先将本仓库源码放在名为 `tarkov-integrated` 的目录中。可以从同一 Release 复制 `runtime` 作为第三方运行时，其中 Electron 为 `44.5.1`；下面的命令会用源码重新生成前端与本地组件。无需复制任何个人数据。

```powershell
npm ci
pnpm --dir source/tracker install --frozen-lockfile
npm run build:tracker
dotnet publish native/LocalMonitor.csproj -c Release -r win-x64 --self-contained true -o runtime/monitor
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-overlay.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-launcher.ps1
npm test
```

编译好的窗口启动器位于上一级 `启动塔科夫助手.exe`。执行 `node scripts/package-clean.mjs <新的输出目录>` 可生成空白版；输出目录须尚不存在。脚本只复制白名单中的公开资料，重建空白进度与设置。

前端整合源码已经包含补丁，正常构建直接使用当前源码。更细的上游开发说明见 `source/tracker/README.md` 和对应的 `package.json`。

## 验证

2.1.1 修复从旧版升级后仍读取浏览器旧地图缓存的问题。本机版使用已有的磁盘公开资料缓存，不改动个人进度与目录设置。回归复现了“旧缓存 17 图、本地资料 19 图”，确认修正后两张疫区地图可见、可选择，刷新后仍正常；缓存回归测试、类型检查、相关文件 lint 和两份生产构建通过。

本次更新已通过相关 33 项地图测试、资料刷新回归测试、Nuxt 类型检查、相关文件 ESLint 和翻译检查。本机版与 PvP/PvE 便携版生产构建通过；隔离的无界面浏览器检查覆盖两张疫区地图、玩家标记、楼层、活动撤离条件、380×320 小窗关闭详情，以及四项活动攻略。资料刷新回归检查确认新地图名单会传给日志定位组件，未核实的 placeholder_ 任务会被排除，个人存档保持原样。发布包另检查空白进度、必需运行组件和对应源码。

这些检查覆盖已列出的场景；未替代真实游戏中每张地图、每个撤离点和每种楼层的人工验收。

## 许可与来源

Copyright (C) 2026 leaf0329。项目自有代码采用 **AGPL-3.0-only**，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。允许在遵守许可证的条件下使用、修改与分发；对外分发须提供对应源码，向用户提供修改版网络服务时须按 AGPL 提供源码获取机会。个人自用修改无需公开。

请保留版权、许可证和来源声明，转载注明 [原仓库](https://github.com/leaf0329/tarkov-companion)。第三方代码与素材继续遵循各自许可：TarkovTracker / TarkovMonitor 为 GPL-3.0，tarkov.dev 为 MIT，部分社区 SVG 地图为 CC BY-NC-SA 4.0，游戏图像属于原权利人。AGPL 对自有代码的授权不改变这些素材的限制，详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

旧版源码和旧版单文件程序保留在历史标签与 Releases 中；v2.0.0 起使用当前整合版及文件夹式便携包。
