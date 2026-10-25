import { defineEventHandler, setResponseHeaders } from 'h3';
import { createLogger } from '@/server/utils/logger';
import type { ContributorApiItem, ContributorsResponse } from '@/types/contributors';
type GitHubContributor = {
  avatar_url?: string | null;
  contributions?: number | null;
  html_url?: string | null;
  login?: string | null;
  type?: string | null;
};
const logger = createLogger('Contributors');
const CONTRIBUTORS_PER_PAGE = 100;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_TIMEOUT_MS = 20000;
const MAX_TOTAL_PAGES = 10;
const MIN_TIMEOUT_MS = 1000;
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_USER_AGENT = 'TarkovTracker-Contributors';
const EXCLUDED_LOGIN_SUBSTRINGS = ['semantic-release'];
const DEFAULT_EXCLUDED_LOGINS = [
  'claude',
  'claude[bot]',
  'semantic-release-bot',
  'semantic-release[bot]',
];
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};
const parseNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const parseCommaSeparated = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
};
const normalizeLogin = (value: string): string => {
  return value.trim().toLowerCase();
};
const parseString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};
const toBooleanBotType = (contributor: GitHubContributor): boolean => {
  return String(contributor.type ?? '').toLowerCase() === 'bot';
};
const shouldExcludeContributor = (
  contributor: GitHubContributor,
  excludedLogins: Set<string>
): boolean => {
  const rawLogin = contributor.login;
  if (typeof rawLogin !== 'string' || !rawLogin.trim()) return true;
  const login = normalizeLogin(rawLogin);
  if (!login) return true;
  if (toBooleanBotType(contributor)) return true;
  if (login.includes('[bot]')) return true;
  if (EXCLUDED_LOGIN_SUBSTRINGS.some((value) => login.includes(value))) return true;
  return excludedLogins.has(login);
};
const parseContributions = (value: unknown): number => {
  const parsed = parseNumber(value, 0);
  return parsed > 0 ? parsed : 0;
};
const fetchContributorPage = async (
  url: string,
  githubToken: string,
  timeoutMs: number
): Promise<GitHubContributor[] | null> => {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    };
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      logger.warn('GitHub contributors request failed.', {
        status: response.status,
        url,
      });
      return null;
    }
    const parsed = (await response.json()) as unknown;
    if (!Array.isArray(parsed)) {
      logger.warn('GitHub contributors response is not an array.', { url });
      return null;
    }
    return parsed as GitHubContributor[];
  } catch (error) {
    logger.error('Failed to fetch contributor page.', {
      error: error instanceof Error ? error.message : String(error),
      url,
    });
    return null;
  }
};
const sortContributors = (items: ContributorApiItem[]): ContributorApiItem[] => {
  return [...items].sort((a, b) => {
    if (b.contributions !== a.contributions) return b.contributions - a.contributions;
    return a.login.localeCompare(b.login, undefined, { sensitivity: 'base' });
  });
};
const normalizeContributors = (
  contributors: GitHubContributor[],
  excludedLogins: Set<string>
): ContributorApiItem[] => {
  const dedupedContributors = new Map<string, ContributorApiItem>();
  for (const contributor of contributors) {
    if (shouldExcludeContributor(contributor, excludedLogins)) continue;
    const rawLogin = String(contributor.login || '');
    const login = normalizeLogin(rawLogin);
    const normalizedContributor: ContributorApiItem = {
      avatar: String(contributor.avatar_url || ''),
      contributions: parseContributions(contributor.contributions),
      login: rawLogin,
      url: String(contributor.html_url || `https://github.com/${rawLogin}`),
    };
    const existing = dedupedContributors.get(login);
    if (!existing || normalizedContributor.contributions > existing.contributions) {
      dedupedContributors.set(login, normalizedContributor);
    }
  }
  return sortContributors(Array.from(dedupedContributors.values()));
};
const fetchContributors = async (
  baseUrl: string,
  githubToken: string,
  timeoutMs: number,
  excludedLogins: Set<string>
): Promise<ContributorApiItem[] | null> => {
  const allContributors: GitHubContributor[] = [];
  for (let page = 1; page <= MAX_TOTAL_PAGES; page++) {
    const pageUrl = `${baseUrl}/contributors?per_page=${CONTRIBUTORS_PER_PAGE}&page=${page}`;
    const contributors = await fetchContributorPage(pageUrl, githubToken, timeoutMs);
    if (!contributors) {
      if (!allContributors.length) {
        return null;
      }
      logger.warn('GitHub contributors pagination failed; returning partial results.', {
        page,
        url: pageUrl,
      });
      break;
    }
    allContributors.push(...contributors);
    if (contributors.length < CONTRIBUTORS_PER_PAGE) {
      break;
    }
  }
  return normalizeContributors(allContributors, excludedLogins);
};
export default defineEventHandler(async (event): Promise<ContributorsResponse> => {
  const runtimeConfig = useRuntimeConfig(event);
  const owner = parseString(runtimeConfig.public.githubOwner, 'tarkovtracker-org');
  const repo = parseString(runtimeConfig.public.githubRepo, 'TarkovTracker');
  const timeoutMs = clamp(
    parseNumber(runtimeConfig.githubTimeoutMs, DEFAULT_TIMEOUT_MS),
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );
  const cacheTtlMs = clamp(
    parseNumber(runtimeConfig.githubContributorsCacheTtlMs, DEFAULT_CACHE_TTL_MS),
    MIN_CACHE_TTL_MS,
    MAX_CACHE_TTL_MS
  );
  const cacheTtlSeconds = Math.max(1, Math.floor(cacheTtlMs / 1000));
  setResponseHeaders(event, {
    'Cache-Control': `public, max-age=${cacheTtlSeconds}, s-maxage=${cacheTtlSeconds}`,
  });
  const githubToken = parseString(runtimeConfig.githubToken, '');
  const configuredExcludedLogins = parseCommaSeparated(runtimeConfig.githubContributorsExclude);
  const excludedLogins = new Set(
    [...DEFAULT_EXCLUDED_LOGINS, ...configuredExcludedLogins].map(normalizeLogin)
  );
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const fetchedItems = await fetchContributors(baseUrl, githubToken, timeoutMs, excludedLogins);
  if (fetchedItems) {
    return { items: fetchedItems };
  }
  logger.warn('Failed to fetch contributors from GitHub.', { owner, repo });
  return { items: [], error: 'Failed to fetch contributors' };
});
