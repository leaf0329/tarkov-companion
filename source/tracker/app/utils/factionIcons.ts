import { PMC_FACTIONS, type PMCFaction } from '@/utils/constants';
const FACTION_ICON_PATHS: Record<PMCFaction, string> = {
  BEAR: '/img/factions/BEAR.webp',
  USEC: '/img/factions/USEC.webp',
};
function isPMCFaction(faction: string): faction is PMCFaction {
  return PMC_FACTIONS.includes(faction as PMCFaction);
}
export function getFactionIconPath(factionName: string | null | undefined): string | null {
  if (!factionName) return null;
  const normalizedFaction = factionName.trim().toUpperCase();
  if (!isPMCFaction(normalizedFaction)) return null;
  return FACTION_ICON_PATHS[normalizedFaction];
}
