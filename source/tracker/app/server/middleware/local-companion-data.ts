import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const endpoints = new Set(['bootstrap', 'tasks-core', 'tasks-objectives', 'tasks-rewards', 'hideout', 'items-lite', 'map-spawns', 'editions', 'prestige']);
const cache = new Map<string, { changed: number; response: Record<string, unknown> }>();
async function readCatalog(directory: string, endpoint: string): Promise<Record<string, unknown>> {
  const file = join(directory, endpoint + '.json');
  const changed = (await stat(file)).mtimeMs;
  const previous = cache.get(endpoint);
  if (previous?.changed === changed) return previous.response;
  const response = JSON.parse(await readFile(file, 'utf8'));
  if (!response.data) throw createError({ statusCode: 503, message: 'Local catalog is invalid' });
  cache.set(endpoint, { changed, response });
  return response;
}
export default defineEventHandler(async (event) => {
  const directory = process.env.COMPANION_CATALOG_DIR;
  if (!directory) return;
  const endpoint = getRequestURL(event).pathname.replace('/api/tarkov/', '');
  const query = getQuery(event);
  if (![event.method === 'GET', endpoints.has(endpoint), query.gameMode === 'pve'].every(Boolean)) return;
  return readCatalog(directory, endpoint);
});
