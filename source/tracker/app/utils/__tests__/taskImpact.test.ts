import { describe, expect, it } from 'vitest';
import {
  buildTaskImpactScores,
  countIncompleteSuccessors,
  resolveImpactTeamIds,
} from '@/utils/taskImpact';
import type { Task } from '@/types/tarkov';
const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  name: 'Task',
  factionName: 'Any',
  ...overrides,
});
describe('resolveImpactTeamIds', () => {
  it('uses visible team ids for all view', () => {
    expect(resolveImpactTeamIds('all', { self: {}, user1: {} })).toEqual(['self', 'user1']);
  });
  it('uses selected user for single-user view', () => {
    expect(resolveImpactTeamIds('self', { user1: {} })).toEqual(['self']);
  });
});
describe('countIncompleteSuccessors', () => {
  const data = {
    tasksCompletions: {
      a: { self: true, user1: false },
      b: { self: false, user1: false },
      c: { self: true, user1: true },
    },
    tasksFailed: {
      c: { self: true, user1: false },
    },
  };
  it('counts incomplete and failed successors', () => {
    const count = countIncompleteSuccessors(['a', 'b', 'c'], ['self'], data);
    expect(count).toBe(2);
  });
  it('filters successors using eligible ids when provided', () => {
    const count = countIncompleteSuccessors(['a', 'b', 'c'], ['self'], data, new Set(['a', 'c']));
    expect(count).toBe(1);
  });
  it('returns zero when no team ids are provided', () => {
    const count = countIncompleteSuccessors(['a', 'b', 'c'], [], data);
    expect(count).toBe(0);
  });
});
describe('buildTaskImpactScores', () => {
  const tasks = [
    createTask({ id: 'root', successors: ['a', 'b', 'c'] }),
    createTask({ id: 'leaf', successors: [] }),
  ];
  const data = {
    tasksCompletions: {
      a: { self: true },
      b: { self: false },
      c: { self: true },
    },
    tasksFailed: {
      c: { self: true },
    },
  };
  it('builds impact scores for each task', () => {
    const scores = buildTaskImpactScores(tasks, ['self'], data);
    expect(scores.get('root')).toBe(2);
    expect(scores.get('leaf')).toBe(0);
  });
  it('returns zero scores when team ids are empty', () => {
    const scores = buildTaskImpactScores(tasks, [], data);
    expect(scores.get('root')).toBe(0);
    expect(scores.get('leaf')).toBe(0);
  });
});
