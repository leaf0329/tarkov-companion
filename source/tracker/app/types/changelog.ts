export type ChangelogStats = {
  additions: number;
  deletions: number;
};
export type ChangelogBullet = string | { text: string; stats?: ChangelogStats };
export type ChangelogItem = {
  date: string;
  label?: string;
  bullets: ChangelogBullet[];
  stats?: ChangelogStats;
};
export type ChangelogResponse = {
  source: 'releases' | 'commits';
  items: ChangelogItem[];
  hasMore: boolean;
  error?: string;
};
