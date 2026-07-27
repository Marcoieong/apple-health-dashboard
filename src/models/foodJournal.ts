export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodPhotoPlaceholder {
  kind: 'placeholder';
  alt: string;
}

export interface FoodPhotoThumbnail {
  kind: 'authenticated-thumbnail';
  src: `/api/${string}`;
  alt: string;
  width: number;
  height: number;
}

export type FoodPhoto = FoodPhotoPlaceholder | FoodPhotoThumbnail;

export interface FoodJournalEntry {
  id: string;
  occurredAt: string;
  localDate: string;
  timezone: string;
  mealType: MealType;
  foods: string[];
  cookingMethods?: string[];
  notes?: string;
  photo: FoodPhoto;
  source: 'demo' | 'chatgpt';
}

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '小食'
};
