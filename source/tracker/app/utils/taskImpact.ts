import type { Task } from '@/types/tarkov';
export interface TaskImpactData {
  tasksCompletions: Record<string, Record<string, boolean>>;
  tasksFailed: Record<string, Record<string, boolean>>;
}
export function resolveImpactTeamIds(
  userView: string,
  visibleTeamStores?: Record<string, unknown>
): string[] {
  if (userView === 'all') {
    return Object.keys(visibleTeamStores || {});
  }
  return [userView];
}
export function countIncompleteSuccessors(
  successorIds: string[],
  teamIds: string[],
  data: TaskImpactData,
  eligibleTaskIds?: Set<string>
): number {
  if (!successorIds.length || !teamIds.length) return 0;
  const { tasksCompletions, tasksFailed } = data;
  let impact = 0;
  for (const successorId of successorIds) {
    if (eligibleTaskIds && !eligibleTaskIds.has(successorId)) continue;
    const isIncomplete = teamIds.some(
      (teamId) =>
        tasksCompletions?.[successorId]?.[teamId] !== true ||
        tasksFailed?.[successorId]?.[teamId] === true
    );
    if (isIncomplete) {
      impact += 1;
    }
  }
  return impact;
}
export function buildTaskImpactScores(
  taskList: Task[],
  teamIds: string[],
  data: TaskImpactData,
  eligibleTaskIds?: Set<string>
): Map<string, number> {
  const impactScores = new Map<string, number>();
  if (!taskList.length) return impactScores;
  if (!teamIds.length) {
    taskList.forEach((task) => impactScores.set(task.id, 0));
    return impactScores;
  }
  taskList.forEach((task) => {
    const successors = task.successors ?? [];
    impactScores.set(
      task.id,
      countIncompleteSuccessors(successors, teamIds, data, eligibleTaskIds)
    );
  });
  return impactScores;
}
