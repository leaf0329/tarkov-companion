import { describe, it, expect } from 'vitest';
import { clusterSpawns } from '@/utils/mapClustering';
import type { MapSpawn } from '@/types/tarkov';
function makeSpawn(x: number, z: number): MapSpawn {
  return { position: { x, y: 0, z }, sides: ['pmc'], categories: ['player'] };
}
function expectClusterAt(clusters: ReturnType<typeof clusterSpawns>, index: number) {
  const cluster = clusters[index];
  expect(cluster).toBeDefined();
  if (!cluster) {
    throw new Error(`Expected cluster at index ${index}`);
  }
  return cluster;
}
describe('clusterSpawns', () => {
  it('groups spawns in the same grid cell and averages centroids', () => {
    const spawns = [makeSpawn(10, 20), makeSpawn(15, 25), makeSpawn(12, 22)];
    const clusters = clusterSpawns(spawns, 50);
    const cluster = expectClusterAt(clusters, 0);
    expect(clusters).toHaveLength(1);
    expect(cluster.count).toBe(3);
    expect(cluster.centerX).toBeCloseTo((10 + 15 + 12) / 3);
    expect(cluster.centerZ).toBeCloseTo((20 + 25 + 22) / 3);
  });
  it('produces separate clusters for spawns in different cells', () => {
    const spawns = [makeSpawn(10, 20), makeSpawn(200, 300)];
    const clusters = clusterSpawns(spawns, 50);
    const sorted = clusters.sort((a, b) => a.centerX - b.centerX);
    const first = expectClusterAt(sorted, 0);
    const second = expectClusterAt(sorted, 1);
    expect(clusters).toHaveLength(2);
    expect(first.centerX).toBe(10);
    expect(first.centerZ).toBe(20);
    expect(first.count).toBe(1);
    expect(second.centerX).toBe(200);
    expect(second.centerZ).toBe(300);
    expect(second.count).toBe(1);
  });
  it('produces count=1 for a single spawn per cell', () => {
    const spawns = [makeSpawn(25, 30)];
    const clusters = clusterSpawns(spawns, 50);
    const cluster = expectClusterAt(clusters, 0);
    expect(clusters).toHaveLength(1);
    expect(cluster.count).toBe(1);
    expect(cluster.centerX).toBe(25);
    expect(cluster.centerZ).toBe(30);
  });
  it('skips spawns with missing position', () => {
    const spawns: MapSpawn[] = [
      makeSpawn(10, 20),
      { sides: ['pmc'], categories: ['player'] } as MapSpawn,
    ];
    const clusters = clusterSpawns(spawns, 50);
    const cluster = expectClusterAt(clusters, 0);
    expect(clusters).toHaveLength(1);
    expect(cluster.count).toBe(1);
  });
  it('returns empty array for empty input', () => {
    expect(clusterSpawns([], 50)).toEqual([]);
  });
  it('handles negative coordinates correctly', () => {
    const spawns = [makeSpawn(-10, -20), makeSpawn(-15, -25)];
    const clusters = clusterSpawns(spawns, 50);
    const cluster = expectClusterAt(clusters, 0);
    expect(clusters).toHaveLength(1);
    expect(cluster.count).toBe(2);
    expect(cluster.centerX).toBeCloseTo(-12.5);
    expect(cluster.centerZ).toBeCloseTo(-22.5);
  });
  it('handles spawns on grid cell boundaries', () => {
    const spawns = [makeSpawn(49, 49), makeSpawn(50, 50)];
    const clusters = clusterSpawns(spawns, 50);
    expect(clusters).toHaveLength(2);
  });
});
