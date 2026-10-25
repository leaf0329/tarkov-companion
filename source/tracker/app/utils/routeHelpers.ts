import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from 'vue-router';
export const getQueryString = (
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.find((entry): entry is string => typeof entry === 'string');
  }
  return undefined;
};
type QueryLike = LocationQuery | LocationQueryRaw;
export const normalizeQuery = (query: QueryLike): string => {
  const normalized: Record<string, string> = {};
  Object.keys(query)
    .sort()
    .forEach((key) => {
      const value = query[key];
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        const entries = value.filter(
          (entry): entry is string | number => entry !== undefined && entry !== null
        );
        const nonEmptyEntries = entries.filter((entry) =>
          typeof entry === 'string' ? entry !== '' : true
        );
        if (nonEmptyEntries.length === 0) return;
        normalized[key] = nonEmptyEntries.map(String).join(',');
        return;
      }
      normalized[key] = String(value);
    });
  return JSON.stringify(normalized);
};
