import type { MapSpawn } from '@/types/tarkov';
export interface SpawnCluster {
  centerX: number;
  centerZ: number;
  count: number;
}
export function clusterSpawns(spawns: MapSpawn[], gridSize: number): SpawnCluster[] {
  const buckets = new Map<string, { sumX: number; sumZ: number; count: number }>();
  for (const spawn of spawns) {
    if (!spawn.position) continue;
    const { x, z } = spawn.position;
    const cellX = Math.floor(x / gridSize);
    const cellZ = Math.floor(z / gridSize);
    const key = `${cellX},${cellZ}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sumX += x;
      bucket.sumZ += z;
      bucket.count += 1;
    } else {
      buckets.set(key, { sumX: x, sumZ: z, count: 1 });
    }
  }
  const clusters: SpawnCluster[] = [];
  for (const bucket of buckets.values()) {
    clusters.push({
      centerX: bucket.sumX / bucket.count,
      centerZ: bucket.sumZ / bucket.count,
      count: bucket.count,
    });
  }
  return clusters;
}
