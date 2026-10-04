# leaf0329 · 塔科夫个人助手 · Windows x64 便携版

项目自有代码的授权条款见仓库根目录 LICENSE。作者署名：leaf0329；原始项目：https://github.com/leaf0329/tarkov-companion 。第三方代码、地图、头像和任务资料继续适用各自原有条款，项目许可证不替代或重新授权这些内容。

许可摘要：禁止商用；对外发布、分发或提供修改版服务时须公开完整对应源码，个人非商业自用修改无需公开；转载保留 leaf0329 署名、原仓库链接和许可证。完整条款以 LICENSE 为准，源码地址：https://github.com/leaf0329/tarkov-companion 。

双击 EXE 启动，无需安装 Node.js。程序退出时关闭本次启动的截图助手和置顶浮窗。

这是空白版：不包含制作者的角色进度、游戏日志、截图和本机目录设置。首次使用请在设置中核对游戏日志与截图目录。为避免在新电脑首次启动时删除已有截图，空白版的自动截图和自动删除均默认关闭，请自行开启。

进度、设置和浏览器缓存保存在 EXE 同级“助手数据”文件夹。携带程序只需 EXE；携带使用后的进度请同时复制“助手数据”。程序需要在可写目录中运行。

设置内“选择目录…”打开系统文件夹窗口；修改目录、角色、自动截图、清理、快捷键和不透明度后，统一点击底部“保存全部设置”。关闭设置不保存草稿。浮窗顶部可直接调节不透明度（25%～100%，越低越透明）；该快捷调节立即保存。任务详情的关闭按钮固定在顶部，Wiki 在系统默认浏览器打开。

同图多楼层定位依赖每层独立校准和高度/区域规则，不能只凭图片推断楼层。破冰船目前仅负一层、一层、二层有校准；灯塔新版参考图无定位校准。无法匹配已校准楼层时不显示自动定位箭头，可以手动切层查看参考图。

代码使用 JavaScript Obfuscator 在本机构建混淆，运行资源采用 AES-256-GCM 加密封装。程序运行需要解密资源到 Windows 临时目录，正常退出时清理。本保护增加静态提取难度，不保证无法逆向，也不是用户密码加密。自有源码保留在开发项目中，不随便携包分发。

第三方资料与许可：

- Electron 与 Chromium：许可证随运行时保留。
- Dagre：MIT，LICENSE 随资源保留。
- TarkovTracker tarkov-data-overlay：MIT，许可证随 vendor 目录保留。https://github.com/tarkovtracker-org/tarkov-data-overlay
- 正式版任务数据来自 tarkov.dev PvE、枫织梦境公开接口及 Escape from Tarkov Wiki；Wiki 资料按来源署名及相应 CC BY-SA 条款使用。https://tarkov.dev/ https://member.kaedeori.com/ https://escapefromtarkov.fandom.com/
- 地图、头像和校准参考妙妙工具箱 3.08.3；地图图内原作者署名保留，游戏图像权利归各自权利人。
- 灯塔 v1.7 地图：RE3MR，CC BY-NC-SA 4.0，原图未修改。https://reemr.se/lighthouse/ https://creativecommons.org/licenses/by-nc-sa/4.0/

这是非商业游戏辅助工具。任务接取、完成和失败可由官方 PvE 日志同步；单条目标计数和缺少真实 ID 的新任务仍需手动记录。资源加密不改变任何第三方素材的权利或许可条件。
