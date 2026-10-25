import { describe, expect, it } from 'vitest';
import { sortSkillsByGameOrder } from '@/utils/constants';
describe('constants', () => {
  describe('sortSkillsByGameOrder', () => {
    it('sorts Endurance first in in-game order', () => {
      const skills = [
        { id: 'Strength', name: 'Strength' },
        { id: 'Endurance', name: 'Endurance' },
        { id: 'Vitality', name: 'Vitality' },
      ];
      const sorted = sortSkillsByGameOrder(skills);
      expect(sorted.map((skill) => skill.id)).toEqual(['Endurance', 'Strength', 'Vitality']);
    });
    it('places unknown skills at the end alphabetically', () => {
      const skills = [
        { id: 'Strength', name: 'Strength' },
        { id: 'MyUnknownB', name: 'My Unknown B' },
        { id: 'MyUnknownA', name: 'My Unknown A' },
      ];
      const sorted = sortSkillsByGameOrder(skills);
      expect(sorted.map((skill) => skill.id)).toEqual(['Strength', 'MyUnknownA', 'MyUnknownB']);
    });
  });
});
