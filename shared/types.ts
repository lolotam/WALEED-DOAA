export type ProfileId = 'waleed' | 'doaa';
export type Slot = 'breakfast' | 'lunch' | 'dinner';

export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_AR: Record<Slot, string> = { breakfast: 'الفطار', lunch: 'الغدا', dinner: 'العشا' };
/** نسبة سعرات كل وجبة من اليوم */
export const SLOT_SHARE: Record<Slot, number> = { breakfast: 0.3, lunch: 0.4, dinner: 0.3 };

export interface Ingredient {
  name: string;
  /** الكمية بالجرام لحصة أساسية (baseKcal) */
  grams: number;
  /** بديل لأي حد مش بياكل المكون ده (فراخ أو بيض) */
  doaaAlt?: { name: string; grams: number };
  /** سبب البديل — الافتراضي فراخ */
  altFor?: 'chicken' | 'egg';
}

export interface MealOption {
  title: string;
  cuisine: string;
  description: string;
  /** سعرات الحصة الأساسية */
  baseKcal: number;
  baseProtein: number;
  ingredients: Ingredient[];
  steps: string[];
}

export interface PortionLine { name: string; grams: number }
export interface PersonPortion { kcal: number; protein: number; lines: PortionLine[] }

export type DrinkCode = 'coffee' | 'tea' | 'none';
export const DRINKS: Record<Exclude<DrinkCode, 'none'>, { name: string; kcal: number; protein: number; icon: string }> = {
  coffee: { name: 'قهوة فرنساوي بالحليب', kcal: 70, protein: 4, icon: '☕' },
  tea: { name: 'شاي بالحليب (سكر دايت)', kcal: 60, protein: 3, icon: '🍵' },
};
