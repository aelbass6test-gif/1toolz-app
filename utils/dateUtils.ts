/**
 * Safely parses any date string, timestamp, or Date object into a valid JS Date.
 * Handles Arabic-Indic numerals (٠-٩), ISO strings, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, etc.
 */
export const parseSafeDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
    if (typeof dateVal === 'number') {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d;
    }
    
    let str = String(dateVal).trim();
    if (!str) return null;
    
    // Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Latin (0123456789)
    str = str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

    // Try standard JS Date parse first
    let parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    // Handle DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY or date-time strings
    const parts = str.split(/[\/\-\sT:]/);
    if (parts.length >= 3) {
        const n0 = parseInt(parts[0], 10);
        const n1 = parseInt(parts[1], 10);
        const n2 = parseInt(parts[2], 10);
        const h = parts[3] ? parseInt(parts[3], 10) : 0;
        const m = parts[4] ? parseInt(parts[4], 10) : 0;
        const s = parts[5] ? parseInt(parts[5], 10) : 0;

        if (!isNaN(n0) && !isNaN(n1) && !isNaN(n2)) {
            if (n0 > 1000) {
                // YYYY-MM-DD
                parsed = new Date(n0, n1 - 1, n2, h, m, s);
            } else if (n2 > 1000) {
                // DD/MM/YYYY
                parsed = new Date(n2, n1 - 1, n0, h, m, s);
            }
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }
    return null;
};

/**
 * Checks whether a given date value falls between minDate and maxDate (inclusive).
 * Safely returns false if dateVal is invalid or cannot be parsed.
 */
export const isDateInRange = (
    dateVal: any,
    minDate?: Date | string | null,
    maxDate?: Date | string | null
): boolean => {
    const itemDate = parseSafeDate(dateVal);
    if (!itemDate) return false;

    const itemTime = itemDate.getTime();

    if (minDate) {
        const minD = parseSafeDate(minDate);
        if (minD && itemTime < minD.getTime()) return false;
    }

    if (maxDate) {
        const maxD = parseSafeDate(maxDate);
        if (maxD && itemTime > maxD.getTime()) return false;
    }

    return true;
};
