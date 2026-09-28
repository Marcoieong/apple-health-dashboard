import { describe, expect, it } from 'vitest';
import { mapPrivateMealListItem } from './privateRead.js';

describe('private meal read allowlist', () => {
  it('maps only display metadata and replaces the database id', () => {
    const item = mapPrivateMealListItem(
      {
        id: 'database-secret-id',
        local_date: '2026-07-29',
        timezone: 'Asia/Macau',
        meal_type: 'dinner',
        food_labels: ['魚', '蔬菜'],
        preparation_methods: ['蒸'],
        notes: '少油',
        source: 'shortcut',
        photo_count: 2,
        created_at: '2026-07-29T12:00:00.000Z',
        owner_id: 'must-not-leak',
        object_key: 'must-not-leak'
      },
      'private-owner',
      'hmac-secret'
    );

    expect(item).toMatchObject({
      localDate: '2026-07-29',
      timezone: 'Asia/Macau',
      mealType: 'dinner',
      source: 'shortcut',
      photoCount: 2
    });
    expect(item.id).not.toContain('database-secret-id');
    expect(JSON.stringify(item)).not.toContain('must-not-leak');
  });
});
