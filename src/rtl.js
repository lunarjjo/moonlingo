// moonlingo — right-to-left script detection.
// Covers the scripts commonly served with dir="rtl" on the modern web.

const RTL_BASES = new Set([
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'yi', // Yiddish
  'dv', // Divehi
  'ckb', // Central Kurdish (Sorani)
]);

/**
 * Whether a BCP 47 language tag is written right-to-left.
 * The primary language subtag decides; unknown tags are LTR.
 * @param {string} tag e.g. "ar", "pt-BR", "zh-CN"
 * @returns {boolean}
 */
export function isRtl(tag) {
  if (typeof tag !== 'string' || tag.trim().length === 0) return false;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return RTL_BASES.has(base);
}
