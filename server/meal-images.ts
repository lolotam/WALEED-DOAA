/**
 * صور الوجبات (اتولّدت بـ Higgsfield). المفتاح = اسم الوجبة بالظبط.
 * الوجبات اللي ملهاش صورة لسه بتظهر من غير صورة.
 */
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3EdClEC844P74nTtlNxhy5SFk3k/';

export const MEAL_IMAGES: Record<string, string> = {
  'فول مدمس بزيت الزيتون': CDN + 'hf_20261107_201413_5a1fd20d-3f25-4e98-a80a-c5328e643e41.png',
  'كبدة إسكندراني': CDN + 'hf_20261107_201413_d3b4645e-2aca-421b-9f03-d3e95366767b.png',
  // Hugging Face (Z-Image Turbo) — محفوظة في client/public/meals
  'شكشوكة بالفلفل': '/meals/m02.webp',
  'شوفان بالزبادي والموز': '/meals/m03.webp',
  'جبنة قريش وبيض مسلوق': '/meals/m04.webp',
  'سندوتش تونة بالليمون': '/meals/m05.webp',
  'أومليت خضار بالفيتا': '/meals/m06.webp',
  'حمص بالطحينة والزبادي': '/meals/m07.webp',
  'لحمة بالخضار ورز': '/meals/m09.webp',
  'صدور فراخ مشوية مع كينوا وسلطة': '/meals/m10.webp',
};

export const imageFor = (title: string): string | undefined => MEAL_IMAGES[title];

/** رابط كامل (التليجرام محتاج رابط مش مسار) */
export const absoluteImageFor = (title: string, site: string): string | undefined => {
  const u = MEAL_IMAGES[title];
  return u && u.startsWith('/') ? site + u : u;
};
