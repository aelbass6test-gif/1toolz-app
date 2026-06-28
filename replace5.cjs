const fs = require('fs');
let content = fs.readFileSync('components/OrderForm.tsx', 'utf8');

// Client Data Header
content = content.replace(/bg-blue-50 dark:bg-blue-500\/10/g, '${tClass.bgLight} ${tClass.bgLightDark}');
content = content.replace(/text-blue-600/g, '${tClass.textMain}');

// Shipping Data Header
content = content.replace(/bg-emerald-50 dark:bg-emerald-500\/10/g, '${tClass.bgLight} ${tClass.bgLightDark}');
content = content.replace(/text-emerald-600/g, '${tClass.textMain}');

// Delivery Date Header
content = content.replace(/bg-sky-50 dark:bg-sky-500\/10/g, '${tClass.bgLight} ${tClass.bgLightDark}');
content = content.replace(/text-sky-600/g, '${tClass.textMain}');

// Notes Header
content = content.replace(/bg-pink-50 dark:bg-pink-500\/10/g, '${tClass.bgLight} ${tClass.bgLightDark}');
content = content.replace(/text-pink-600/g, '${tClass.textMain}');

// Options Header
content = content.replace(/bg-purple-50 dark:bg-purple-500\/10/g, '${tClass.bgLight} ${tClass.bgLightDark}');
content = content.replace(/text-purple-600/g, '${tClass.textMain}');

content = content.replace(/className="w-12 h-12 bg-\w+-50 dark:bg-\w+-500\/10 rounded-2xl flex items-center justify-center text-\w+-600"/g, 'className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}');

fs.writeFileSync('components/OrderForm.tsx', content);
