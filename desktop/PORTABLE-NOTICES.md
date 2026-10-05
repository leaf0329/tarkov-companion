# leaf0329 · 塔科夫个人助手 · Windows x64 便携版

Copyright (C) 2026 leaf0329。项目自有代码采用 GNU Affero General Public License v3.0（AGPL-3.0-only），全文及授权声明见随包提供的 LICENSE 和 NOTICE。原始项目：https://github.com/leaf0329/tarkov-companion 。第三方代码、地图、头像和任务资料继续适用各自原有条款，项目许可证不替代或重新授权这些内容。

许可摘要：允许商业使用自有代码；分发时按 AGPL 向接收者提供完整对应源码，修改版经网络与用户交互时须提供免费获取该版本对应源码的机会；仅个人自用修改无需公开。保留适用版权及许可声明，显著注明修改及日期。软件不提供担保。完整条款以 LICENSE 为准。

本包 v1.0.4 对应的完整可读源码与构建说明：https://github.com/leaf0329/tarkov-companion/tree/v1.0.4 。也可在同版本 Release 下载 Source code：https://github.com/leaf0329/tarkov-companion/releases/tag/v1.0.4 。再分发者须按 AGPL 提供自己分发版本的对应源码，不能用原版源码替代修改版源码。

双击 EXE 启动，无需安装 Node.js。程序退出时关闭本次启动的截图助手和置顶浮窗。

这是空白版：不包含制作者的角色进度、游戏日志、截图和本机目录设置。首次使用请在设置中核对游戏日志与截图目录。为避免在新电脑首次启动时删除已有截图，空白版的自动截图和自动删除均默认关闭，请自行开启。

进度、设置和浏览器缓存保存在 EXE 同级“助手数据”文件夹。携带程序只需 EXE；携带使用后的进度请同时复制“助手数据”。程序需要在可写目录中运行。

设置内“选择目录…”打开系统文件夹窗口；修改目录、角色、自动截图、清理、快捷键和不透明度后，统一点击底部“保存全部设置”。关闭设置不保存草稿。浮窗顶部可直接调节不透明度（25%～100%，越低越透明）；该快捷调节立即保存。任务详情的关闭按钮固定在顶部，Wiki 在系统默认浏览器打开。

浮窗顶部“自动截图”按钮直接开关自动 Insert，与主窗口同步并立即保存。显示“关”时停止自动发送截图键，重新开启沿用设置中的截图间隔。局外不需要定位时可在小地图上直接关闭。

同图多楼层定位依赖每层独立校准和高度/区域规则，不能只凭图片推断楼层。破冰船目前仅负一层、一层、二层有校准；灯塔新版参考图无定位校准。无法匹配已校准楼层时不显示自动定位箭头，可以手动切层查看参考图。

代码使用 JavaScript Obfuscator 在本机构建混淆，运行资源采用 AES-256-GCM 加密封装。程序运行需要解密资源到 Windows 临时目录，正常退出时清理。本保护增加静态提取难度，不保证无法逆向，也不是用户密码加密。完整、未混淆的对应源码由上述版本链接免费提供，构建混淆不限制 AGPL 授予的权利。

第三方资料与许可：

- Electron 与 Chromium：许可证随运行时保留。
- Dagre：MIT，LICENSE 随资源保留。
- TarkovTracker tarkov-data-overlay：MIT，许可证随 vendor 目录保留。https://github.com/tarkovtracker-org/tarkov-data-overlay
- 正式版任务数据来自 tarkov.dev PvE、枫织梦境公开接口及 Escape from Tarkov Wiki；Wiki 资料按来源署名及相应 CC BY-SA 条款使用。https://tarkov.dev/ https://member.kaedeori.com/ https://escapefromtarkov.fandom.com/
- 地图、头像和校准参考妙妙工具箱 3.08.3；地图图内原作者署名保留，游戏图像权利归各自权利人。
- 灯塔 v1.7 地图：RE3MR，CC BY-NC-SA 4.0，原图未修改。https://reemr.se/lighthouse/ https://creativecommons.org/licenses/by-nc-sa/4.0/

这是本地游戏辅助工具。任务接取、完成和失败可由官方 PvE 日志同步；单条目标计数和缺少真实 ID 的新任务仍需手动记录。资源加密不改变任何第三方素材的权利或许可条件。部分第三方素材具有非商业限制，不能将自有代码的 AGPL 授权解释为这些素材的商用授权。
