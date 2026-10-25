import fs from 'node:fs';
import path from 'node:path';

export function mergeScreenshotTasks(response, additions, progress) {
  const existing = new Set(response.data.tasks.map(task => task.id));
  const current = additions.filter(task => ['active', 'ready'].includes(progress[task.id]?.status) && !existing.has(task.id));
  return { ...response, data: { ...response.data, tasks: [...response.data.tasks, ...current] } };
}

export function applyScreenshotTaskSupplements(response, endpoint, folder) {
  if (!['tasks-core', 'tasks-objectives'].includes(endpoint)) return response;
  const file = path.join(folder, 'screenshot-task-supplements.json');
  if (!fs.existsSync(file)) return response;
  const additions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const state = JSON.parse(fs.readFileSync(path.join(folder, '../companion.json'), 'utf8'));
  const progress = state.profiles[state.selectedProfile]?.tasks ?? {};
  return mergeScreenshotTasks(response, additions[endpoint], progress);
}
