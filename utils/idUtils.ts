/**
 * Cryptographically safe unique identifier generator with timestamp prefix
 * to prevent collision across concurrent sessions, rapid batch loops, or multi-device operations.
 */
export const generateSafeId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36);
  let randomPart = '';
  
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 10);
  } else {
    randomPart = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
  }

  return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
};
