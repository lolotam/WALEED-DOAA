import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import fs from 'node:fs';
import path from 'node:path';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sex: text('sex').notNull(), // male | female
  birthDate: text('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  startWeight: real('start_weight').notNull(),
  startDate: text('start_date').notNull(),
  goalWeight: real('goal_weight').notNull(),
  activityFactor: real('activity_factor').notNull(),
  bodyFatPct: real('body_fat_pct'),
  waterGoalMl: integer('water_goal_ml').notNull(),
  color: text('color').notNull(),
  avoidChicken: integer('avoid_chicken', { mode: 'boolean' }).notNull().default(false),
});

export const weights = sqliteTable('weights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: text('profile_id').notNull(),
  date: text('date').notNull(),
  weightKg: real('weight_kg').notNull(),
  bodyFatPct: real('body_fat_pct'),
  waistCm: real('waist_cm'),
  note: text('note'),
});

export const water = sqliteTable('water', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: text('profile_id').notNull(),
  date: text('date').notNull(),
  ml: integer('ml').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sleep = sqliteTable('sleep', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: text('profile_id').notNull(),
  date: text('date').notNull(),
  bedTime: text('bed_time').notNull(),
  wakeTime: text('wake_time').notNull(),
  hours: real('hours').notNull(),
});

export const pantry = sqliteTable('pantry', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
});

export const mealPlans = sqliteTable('meal_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  slot: text('slot').notNull(),
  optionsJson: text('options_json').notNull(),
  chosenIndex: integer('chosen_index'),
  chosenBy: text('chosen_by'), // user | auto
  source: text('source').notNull(), // ai | library
  eaten: integer('eaten', { mode: 'boolean' }).notNull().default(false),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const pushSubs = sqliteTable('push_subs', {
  endpoint: text('endpoint').primaryKey(),
  json: text('json').notNull(),
});

const DATA_DIR = process.env.DATA_DIR || './data';
fs.mkdirSync(DATA_DIR, { recursive: true });
export const sqlite = new Database(path.join(DATA_DIR, 'health.db'));
sqlite.pragma('journal_mode = WAL');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, sex TEXT NOT NULL, birth_date TEXT NOT NULL,
  height_cm REAL NOT NULL, start_weight REAL NOT NULL, start_date TEXT NOT NULL, goal_weight REAL NOT NULL,
  activity_factor REAL NOT NULL, body_fat_pct REAL, water_goal_ml INTEGER NOT NULL, color TEXT NOT NULL,
  avoid_chicken INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT NOT NULL, date TEXT NOT NULL,
  weight_kg REAL NOT NULL, body_fat_pct REAL, waist_cm REAL, note TEXT);
CREATE TABLE IF NOT EXISTS water (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT NOT NULL, date TEXT NOT NULL,
  ml INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sleep (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT NOT NULL, date TEXT NOT NULL,
  bed_time TEXT NOT NULL, wake_time TEXT NOT NULL, hours REAL NOT NULL);
CREATE TABLE IF NOT EXISTS pantry (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS meal_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, slot TEXT NOT NULL,
  options_json TEXT NOT NULL, chosen_index INTEGER, chosen_by TEXT, source TEXT NOT NULL,
  eaten INTEGER NOT NULL DEFAULT 0, UNIQUE(date, slot));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_weights ON weights(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_water ON water(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_sleep ON sleep(profile_id, date);
`);

export const db = drizzle(sqlite);

export function getSetting(key: string): string | null {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setSetting(key: string, value: string) {
  sqlite.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
