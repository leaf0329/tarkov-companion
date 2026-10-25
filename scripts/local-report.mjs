import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/companion.json','utf8'));
const tasks=data.profiles[data.selectedProfile]?.tasks || {};
const counts={};for(const entry of Object.values(tasks))counts[entry.status]=(counts[entry.status] || 0)+1;
console.log(JSON.stringify({settings:{hotkey:data.settings.hotkey,autoScreenshot:data.settings.autoScreenshot},tasks:counts,hasUi:!!data.profiles[data.selectedProfile]?.ui?.pve}));
