const easternArabicDigits: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Normalize common Egyptian phone formats for reliable customer matching. */
export function normalizePhone(value: unknown): string {
  let digits = String(value ?? '')
    .replace(/[٠-٩۰-۹]/g, (digit) => easternArabicDigits[digit] || digit)
    .replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }

  return digits;
}

export function phonesMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizePhone(left);
  const normalizedRight = normalizePhone(right);
  return normalizedLeft.length >= 8 && normalizedLeft === normalizedRight;
}
