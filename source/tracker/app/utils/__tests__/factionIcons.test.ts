import { describe, expect, it } from 'vitest';
import { getFactionIconPath } from '@/utils/factionIcons';
describe('getFactionIconPath', () => {
  it('returns USEC icon path', () => {
    expect(getFactionIconPath('USEC')).toBe('/img/factions/USEC.webp');
  });
  it('returns BEAR icon path', () => {
    expect(getFactionIconPath('BEAR')).toBe('/img/factions/BEAR.webp');
  });
  it('normalizes casing and whitespace', () => {
    expect(getFactionIconPath(' usec ')).toBe('/img/factions/USEC.webp');
  });
  it('returns null for unsupported faction', () => {
    expect(getFactionIconPath('Any')).toBeNull();
  });
  it('returns null for empty value', () => {
    expect(getFactionIconPath(undefined)).toBeNull();
  });
});
