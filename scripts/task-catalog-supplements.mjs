import fs from 'node:fs';
import path from 'node:path';

const taskEndpoints = new Set(['tasks-core', 'tasks-objectives', 'tasks-rewards']);

export function mergeTaskCatalogSupplements(response, supplement) {
  if (supplement.schemaVersion !== 1 || supplement.gameMode !== 'pve' || !Array.isArray(supplement.tasks)
      || !Array.isArray(supplement.excludedTaskIds) || !Array.isArray(supplement.replaceTaskIds)) {
    throw Error('Invalid verified PvE task supplement');
  }
  const ids = new Set();
  for (const task of supplement.tasks) {
    if (!/^[a-f0-9]{24}$/.test(task.id) || ids.has(task.id) || !Array.isArray(task.objectives)) {
      throw Error('Invalid or duplicate supplemented task ID: ' + task.id);
    }
    ids.add(task.id);
    const goals = task.objectives.map(goal => goal.id);
    if (goals.some(id => typeof id !== 'string' || !id) || new Set(goals).size !== goals.length) {
      throw Error('Invalid or duplicate objective ID in task: ' + task.id);
    }
  }
  const excluded = new Set(supplement.excludedTaskIds);
  const corrections = new Set(supplement.replaceTaskIds);
  const additions = new Map(supplement.tasks.map(task => [task.id, task]));
  const tasks = response.data.tasks.filter(task => !excluded.has(task.id)).map(task => {
    const patch = additions.get(task.id);
    additions.delete(task.id);
    return patch && corrections.has(task.id) ? patch : task;
  });
  return { ...response, data: { ...response.data, tasks: [...tasks, ...additions.values()] } };
}

export function applyTaskCatalogSupplements(response, endpoint, folder) {
  if (!taskEndpoints.has(endpoint)) return response;
  const file = path.join(folder, 'verified-pve-task-supplements.json');
  if (!fs.existsSync(file)) return response;
  return mergeTaskCatalogSupplements(response, JSON.parse(fs.readFileSync(file, 'utf8')));
}
