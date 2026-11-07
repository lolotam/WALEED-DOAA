import { sqlite } from './db.js';

/** بيانات البداية — تتكتب مرة واحدة بس لو قاعدة البيانات فاضية */
export function seed() {
  migrate();
  const has = sqlite.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number };
  if (has.n > 0) return;

  const insP = sqlite.prepare(`INSERT INTO profiles
    (id,name,sex,birth_date,height_cm,start_weight,start_date,goal_weight,activity_factor,body_fat_pct,water_goal_ml,color,avoid_chicken)
    VALUES (@id,@name,@sex,@birthDate,@heightCm,@startWeight,@startDate,@goalWeight,@activityFactor,@bodyFatPct,@waterGoalMl,@color,@avoidChicken)`);

  insP.run({
    id: 'waleed', name: 'وليد', sex: 'male', birthDate: '1987-01-13', heightCm: 182,
    startWeight: 94, startDate: '2026-11-07', goalWeight: 82, activityFactor: 1.2, bodyFatPct: null,
    waterGoalMl: 2500, color: '#14B8A6', avoidChicken: 0,
  });
  // تقرير InBody بتاريخ 2026-11-07
  insP.run({
    id: 'doaa', name: 'دعاء', sex: 'female', birthDate: '1989-11-26', heightCm: 164,
    startWeight: 93.6, startDate: '2026-11-07', goalWeight: 70, activityFactor: 1.375, bodyFatPct: 45.9,
    waterGoalMl: 2500, color: '#F472B6', avoidChicken: 1,
  });

  sqlite.prepare("UPDATE profiles SET avoid_eggs=1 WHERE id='doaa'").run();

  const insW = sqlite.prepare('INSERT INTO weights(profile_id,date,weight_kg,body_fat_pct,note) VALUES (?,?,?,?,?)');
  insW.run('waleed', '2026-11-07', 94, null, 'وزن البداية');
  insW.run('doaa', '2026-11-07', 93.6, 45.9, 'InBody — البداية');

  const pantry: Record<string, string[]> = {
    'لحوم وبروتين': ['لحمة بقري', 'لحمة مفرومة', 'صدور فراخ', 'كبدة', 'سمك', 'تونة', 'جمبري', 'بيض'],
    'بقوليات': ['عدس', 'فول', 'حمص', 'فاصوليا ناشفة'],
    'نشويات وحبوب': ['رز', 'شوفان', 'عيش بر', 'بطاطس', 'مكرونة', 'كينوا', 'برغل'],
    'خضار': ['خيار', 'طماطم', 'خس', 'جرجير', 'بقدونس', 'كوسة', 'بروكلي', 'فلفل ألوان', 'باذنجان', 'بصل', 'ثوم', 'جزر', 'ملوخية'],
    'ألبان': ['زبادي', 'زبادي يوناني', 'لبن لايت', 'جبنة قريش', 'جبنة فيتا لايت'],
    'دهون': ['زيت زيتون', 'مكسرات', 'طحينة'],
    'فاكهة': ['تفاح', 'موز', 'برتقال'],
    'إضافات': ['بهارات', 'ليمون', 'خل', 'صلصة طماطم', 'عسل', 'تمر'],
  };
  const insPantry = sqlite.prepare('INSERT INTO pantry(name,category,available) VALUES (?,?,1)');
  for (const [cat, items] of Object.entries(pantry)) for (const it of items) insPantry.run(it, cat);
}

/** تعديلات بيانات بتتنفذ مرة واحدة */
function migrate() {
  const done = (k: string) => (sqlite.prepare('SELECT 1 FROM settings WHERE key=?').get(`mig:${k}`) ? true : false);
  const mark = (k: string) => sqlite.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run(`mig:${k}`, new Date().toISOString());
  if (!done('fixed-breakfast')) {
    sqlite.prepare("UPDATE profiles SET avoid_eggs=1 WHERE id='doaa'").run();
    const ins = sqlite.prepare('INSERT INTO pantry(name,category,available) SELECT ?,?,1 WHERE NOT EXISTS (SELECT 1 FROM pantry WHERE name=?)');
    for (const [n, c] of [['جبنة رومي', 'ألبان'], ['جبنة حلوم', 'ألبان'], ['جبنة طيبة', 'ألبان'], ['لبنة', 'ألبان'],
      ['لانشون', 'لحوم وبروتين'], ['حلاوة طحينية', 'إضافات'], ['طماطم شيري', 'خضار'],
      ['قهوة فرنساوي', 'مشروبات'], ['شاي', 'مشروبات'], ['سكر دايت', 'مشروبات']]) ins.run(n, c, n);
    // فطار بكرة اللي اتولّد قبل التحديث يتعمل من جديد بالفطار الثابت (لو محدش اختار)
    sqlite.prepare("DELETE FROM meal_plans WHERE slot='breakfast' AND chosen_index IS NULL AND date >= date('now')").run();
    mark('fixed-breakfast');
  }
  if (!done('doaa-birthdate')) {
    sqlite.prepare("UPDATE profiles SET birth_date='1989-11-26' WHERE id='doaa'").run();
    mark('doaa-birthdate');
  }
}
