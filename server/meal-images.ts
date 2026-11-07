/**
 * صور الوجبات (اتولّدت بـ Higgsfield). المفتاح = اسم الوجبة بالظبط.
 * الوجبات اللي ملهاش صورة لسه بتظهر من غير صورة.
 */
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3EdClEC844P74nTtlNxhy5SFk3k/';

export const MEAL_IMAGES: Record<string, string> = {
  'فول مدمس بزيت الزيتون': CDN + 'hf_20261107_201413_5a1fd20d-3f25-4e98-a80a-c5328e643e41.png',
  'كبدة إسكندراني': CDN + 'hf_20261107_201413_d3b4645e-2aca-421b-9f03-d3e95366767b.png',
};

export const imageFor = (title: string): string | undefined => MEAL_IMAGES[title];
