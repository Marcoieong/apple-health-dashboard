import { addDays, todayKey } from '../lib/date';
import type { FoodJournalEntry } from '../models/foodJournal';

const timezone = 'Asia/Macau';
const photo = {
  kind: 'placeholder',
  alt: '示範餐點相片預留位置'
} as const;

function occurredAt(date: string, time: string) {
  return `${date}T${time}:00+08:00`;
}

export function createDemoMealEntries(endDate = todayKey()): FoodJournalEntry[] {
  const yesterday = addDays(endDate, -1);
  const twoDaysAgo = addDays(endDate, -2);

  return [
    {
      id: 'meal-demo-1',
      localDate: endDate,
      occurredAt: occurredAt(endDate, '08:10'),
      timezone,
      mealType: 'breakfast',
      foods: ['燕麥', '香蕉', '無糖豆漿'],
      cookingMethods: ['沖泡'],
      photo,
      source: 'demo'
    },
    {
      id: 'meal-demo-2',
      localDate: endDate,
      occurredAt: occurredAt(endDate, '19:05'),
      timezone,
      mealType: 'dinner',
      foods: ['清蒸魚', '菜心', '番薯'],
      cookingMethods: ['蒸', '灼'],
      notes: '示範紀錄只描述食物種類，不估算份量。',
      photo,
      source: 'demo'
    },
    {
      id: 'meal-demo-3',
      localDate: yesterday,
      occurredAt: occurredAt(yesterday, '12:35'),
      timezone,
      mealType: 'lunch',
      foods: ['豆腐', '菠菜', '糙米'],
      cookingMethods: ['煮'],
      photo,
      source: 'demo'
    },
    {
      id: 'meal-demo-4',
      localDate: yesterday,
      occurredAt: occurredAt(yesterday, '18:50'),
      timezone,
      mealType: 'dinner',
      foods: ['雞肉', '南瓜', '西蘭花'],
      cookingMethods: ['焗', '灼'],
      photo,
      source: 'demo'
    },
    {
      id: 'meal-demo-5',
      localDate: twoDaysAgo,
      occurredAt: occurredAt(twoDaysAgo, '15:20'),
      timezone,
      mealType: 'snack',
      foods: ['蘋果', '原味乳酪'],
      photo,
      source: 'demo'
    }
  ];
}
