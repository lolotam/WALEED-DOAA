import { sqlite } from './db.js';

/** بيانات البداية — تتكتب مرة واحدة بس لو قاعدة البيانات فاضية */
export function seed() {
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
  // تقرير InBody بتاريخ 2026-11-07: السن 36 — تاريخ الميلاد تقريبي ويتعدل من الإعدادات
  insP.run({
    id: 'doaa', name: 'دعاء', sex: 'female', birthDate: '1990-01-01', heightCm: 164,
    startWeight: 93.6, startDate: '2026-11-07', goalWeight: 70, activityFactor: 1.375, bodyFatPct: 45.9,
    waterGoalMl: 2500, color: '#F472B6', avoidChicken: 1,
  });

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
