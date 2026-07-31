import {
  deriveMeetingStatus,
  numberAgenda,
  selectCarryoverItems,
} from '../domain';

describe('meetings domain logic', () => {
  describe('deriveMeetingStatus', () => {
    it('should return "draft" when is_draft is true, regardless of mode', () => {
      expect(deriveMeetingStatus({ is_draft: true, mode: 'agenda' })).toBe('draft');
      expect(deriveMeetingStatus({ is_draft: true, mode: 'minutes' })).toBe('draft');
    });

    it('should return "awaiting_minutes" when is_draft is false and mode is "agenda"', () => {
      expect(deriveMeetingStatus({ is_draft: false, mode: 'agenda' })).toBe('awaiting_minutes');
    });

    it('should return "minutes" when is_draft is false and mode is "minutes"', () => {
      expect(deriveMeetingStatus({ is_draft: false, mode: 'minutes' })).toBe('minutes');
    });
  });

  describe('numberAgenda', () => {
    it('should return an empty map when categories are empty', () => {
      const result = numberAgenda([], []);
      expect(result.size).toBe(0);
    });

    it('should return an empty map when items are empty', () => {
      const categories = [{ id: 'cat1', position: 0 }];
      const result = numberAgenda(categories, []);
      expect(result.size).toBe(0);
    });

    it('should number items by category position then item position (1-indexed)', () => {
      const categories = [
        { id: 'cat1', position: 0 },
        { id: 'cat2', position: 1 },
      ];
      const items = [
        { id: 'item1', category_id: 'cat1', position: 0 },
        { id: 'item2', category_id: 'cat1', position: 1 },
        { id: 'item3', category_id: 'cat2', position: 0 },
      ];
      const result = numberAgenda(categories, items);
      expect(result.get('item1')).toBe('1.1');
      expect(result.get('item2')).toBe('1.2');
      expect(result.get('item3')).toBe('2.1');
    });

    it('should handle unsorted categories by sorting on position', () => {
      const categories = [
        { id: 'cat2', position: 1 },
        { id: 'cat1', position: 0 },
      ];
      const items = [
        { id: 'item1', category_id: 'cat1', position: 0 },
        { id: 'item2', category_id: 'cat2', position: 0 },
      ];
      const result = numberAgenda(categories, items);
      // cat1 (position 0) should be first => 1.1, cat2 (position 1) should be second => 2.1
      expect(result.get('item1')).toBe('1.1');
      expect(result.get('item2')).toBe('2.1');
      expect(result.size).toBe(2);
    });

    it('should handle unsorted items by sorting on position within each category', () => {
      const categories = [{ id: 'cat1', position: 0 }];
      const items = [
        { id: 'item2', category_id: 'cat1', position: 1 },
        { id: 'item1', category_id: 'cat1', position: 0 },
      ];
      const result = numberAgenda(categories, items);
      expect(result.get('item1')).toBe('1.1');
      expect(result.get('item2')).toBe('1.2');
    });

    it('should use stable sort (preserve input order for equal positions)', () => {
      const categories = [{ id: 'cat1', position: 0 }];
      const items = [
        { id: 'item1', category_id: 'cat1', position: 0 },
        { id: 'item2', category_id: 'cat1', position: 0 },
      ];
      const result = numberAgenda(categories, items);
      expect(result.get('item1')).toBe('1.1');
      expect(result.get('item2')).toBe('1.2');
    });

    it('should skip items whose category is not in the categories list', () => {
      const categories = [{ id: 'cat1', position: 0 }];
      const items = [
        { id: 'item1', category_id: 'cat1', position: 0 },
        { id: 'item2', category_id: 'unknown_cat', position: 0 },
      ];
      const result = numberAgenda(categories, items);
      expect(result.get('item1')).toBe('1.1');
      expect(result.has('item2')).toBe(false);
    });

    it('should consume category index slot even for empty categories placed first', () => {
      const categories = [
        { id: 'catA', position: 0 },
        { id: 'catB', position: 1 },
      ];
      const items = [{ id: 'i1', category_id: 'catB', position: 0 }];
      const result = numberAgenda(categories, items);
      // catA (position 0) is empty but consumes slot 1, so catB (position 1) gets slot 2
      expect(result.get('i1')).toBe('2.1');
      expect(result.size).toBe(1);
    });
  });

  describe('selectCarryoverItems', () => {
    it('should return empty array when items are empty', () => {
      expect(selectCarryoverItems([])).toEqual([]);
    });

    it('should select items with status "open"', () => {
      const items = [
        { id: 'item1', status: 'open' },
        { id: 'item2', status: 'closed' },
      ];
      const result = selectCarryoverItems(items);
      expect(result).toEqual(['item1']);
    });

    it('should select items with status "in_progress"', () => {
      const items = [
        { id: 'item1', status: 'in_progress' },
        { id: 'item2', status: 'closed' },
      ];
      const result = selectCarryoverItems(items);
      expect(result).toEqual(['item1']);
    });

    it('should select both "open" and "in_progress" items', () => {
      const items = [
        { id: 'item1', status: 'open' },
        { id: 'item2', status: 'in_progress' },
        { id: 'item3', status: 'closed' },
      ];
      const result = selectCarryoverItems(items);
      expect(result).toEqual(['item1', 'item2']);
    });

    it('should exclude "closed" items', () => {
      const items = [
        { id: 'item1', status: 'closed' },
        { id: 'item2', status: 'closed' },
      ];
      const result = selectCarryoverItems(items);
      expect(result).toEqual([]);
    });

    it('should preserve input order', () => {
      const items = [
        { id: 'item1', status: 'in_progress' },
        { id: 'item2', status: 'open' },
        { id: 'item3', status: 'closed' },
        { id: 'item4', status: 'open' },
      ];
      const result = selectCarryoverItems(items);
      expect(result).toEqual(['item1', 'item2', 'item4']);
    });
  });
});
