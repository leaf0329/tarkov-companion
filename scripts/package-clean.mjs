import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.argv[2]?path.resolve(process.argv[2]):path.join(path.dirname(root),'塔科夫助手-纯净版');
if(fs.existsSync(output))throw Error('纯净版目录已存在，请保留或移走旧目录后再打包：'+output);
const app=path.join(output,'tarkov-integrated');
fs.mkdirSync(app,{recursive:true});
const excluded=new Set(['.git','.nuxt','.cache','.vscode','.vs','bin','obj','coverage','playwright-report','test-results']);
function include(file){
 const parts=path.relative(root,file).split(path.sep),name=path.basename(file);
 if(parts.some(part=>excluded.has(part)))return false;
 if(parts[0]==='source' && parts.includes('node_modules') && !parts.includes('.output'))return false;
 if(name.startsWith('.env') && name!=='.env.example')return false;
 return !/\.(log|jsonl|pdb|map|user|suo)$/.test(name) && name!=='test-report.junit.xml';
}
for(const folder of ['runtime','node_modules','source','native','desktop','scripts','tests']){
 fs.cpSync(path.join(root,folder),path.join(app,folder),{recursive:true,dereference:true,filter:include});
}
for(const name of ['.gitignore','LICENSE','THIRD-PARTY-NOTICES.md','package.json','package-lock.json','启动整合助手.cmd','管理员启动.cmd','更新公开数据.cmd']){
 fs.copyFileSync(path.join(root,name),path.join(app,name));
}
fs.copyFileSync(path.join(root,'runtime/launcher/launcher.exe'),path.join(output,'启动塔科夫助手.exe'));
// Personal data is never copied: only named public metadata files enter the new data directory.
const data=path.join(app,'data');fs.mkdirSync(path.join(data,'catalog'),{recursive:true});
for(const name of ['maps.json','published-editions.json','published-prestige.json']){
 fs.copyFileSync(path.join(root,'data',name),path.join(data,name));
}
for(const name of ['bootstrap','editions','hideout','items-lite','map-spawns','prestige','screenshot-task-supplements','sources','tasks-core','tasks-objectives','tasks-rewards']){
 fs.copyFileSync(path.join(root,'data/catalog',name+'.json'),path.join(data,'catalog',name+'.json'));
}
const blank={settings:{logsPath:'',screenshotsPath:'',hotkey:'F11',opacity:85,interval:5,autoScreenshot:false,cleanupScreenshots:false,follow:true},selectedProfile:'',profiles:{},ui:{}};
fs.writeFileSync(path.join(data,'companion.json'),JSON.stringify(blank,null,2)+'\n');
const instructions=`# leaf0329 · 塔科夫助手纯净便携版

适用于 Windows 10/11 64 位、官方塔科夫 PvE / PvP。运行组件已附带，普通使用无需安装 Node.js 或 .NET SDK。

日志自动识别 PvE、普通 PvP 和 PvP 赛季角色。PvP 仅提供实时地图，位置和朝向在每次截图后更新；切回 PvE 沿用原有 PvE 任务进度。

1. 先完整解压到可写文件夹或 U 盘，保留启动程序与 tarkov-integrated 文件夹的相对位置。
2. 双击外面的“启动塔科夫助手.exe”。程序带管理员权限声明，Windows 提示时确认启动。
3. 首次打开进入“本地设置”。选择这台电脑的游戏 Logs 目录和 Screenshots 目录，点击“保存全部设置”。Steam 版的日志目录通常在游戏 build/Logs；以实际文件夹为准。
4. 通过顶部“实时地图”“任务 / 任务树”进入对应界面；F11 显示或隐藏置顶小地图。已有其他程序占用 F11 时可在本地设置中更改。
5. 游戏截图键需要设为 Insert。首次使用默认关闭自动截图；需要定位时在主地图或小地图开启。读取后删除游戏截图的选项也默认关闭，可在本地设置中自行开启。

同一任务的所有未完成目标点会同时显示。勾选完成一个目标只移除该目标的点位，其他目标继续显示。

地图工具栏的“钥匙房”按钮可开关当前楼层的钥匙房标点，点击钥匙可查看所需钥匙和楼层。点击撤离点名称或圆点，可查看撤离条件、阵营和所在楼层；未收录的限制会明确提示。以游戏本局撤离列表确认是否开放。

左键拖动地图，滚轮缩放，Ctrl + 滚轮或顶部楼层菜单切换楼层。关闭“跟随”即可规划路线，右下角重置按钮显示全图。点击商人头像和任务名称查看当前点位对应的目标、地点名称和任务钥匙；点击“展开完整任务”可查看其他目标。关闭主窗口会停止本助手服务，小地图的关闭按钮仅隐藏小地图。

任务和藏身处进度均为空白，不含原使用者的游戏角色、目录设置、浏览器缓存、截图、诊断日志或备份。使用后，自己的进度和设置保存在 tarkov-integrated/data，移动到其他电脑后重新选择日志和截图目录。分享给下一个人时请使用原始纯净压缩包。

小窗输入组件位于 runtime/overlay/CompanionOverlay.dll，源码为 native/overlay-input.c。需要重新编译时运行 scripts/build-overlay.ps1，构建电脑需有 Microsoft C++ Build Tools（x64）与 Windows 10 SDK。普通使用已附带编译结果，无需安装构建工具。

公开任务资料和 SVG 地图已附带；部分地图瓦片、头像与资料链接需要联网。可通过“更新公开数据.cmd”更新公开游戏资料。

保留 leaf0329 标识和完整来源声明。本地整合源码采用 AGPL-3.0-only，见 tarkov-integrated/LICENSE；第三方代码与素材的许可见 THIRD-PARTY-NOTICES.md。源码位于 source、native、desktop，构建和数据脚本位于 scripts；未附带开发依赖缓存和 .NET SDK。前端构建要求见 source/tracker/package.json，日志组件构建文件为 native/LocalMonitor.csproj。
`;
fs.writeFileSync(path.join(output,'使用说明.md'),instructions);
fs.writeFileSync(path.join(app,'使用说明.md'),instructions);
let files=0,bytes=0;
function inspect(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())inspect(file);else{files++;bytes+=fs.statSync(file).size;}}}
inspect(output);
console.log(JSON.stringify({output,files,MiB:Math.round(bytes/1024/1024*10)/10,profiles:0,automaticScreenshots:false,automaticDeletion:false}));
