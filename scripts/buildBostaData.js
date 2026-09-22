const fs = require('fs');

// We will read transcript or prompt lines if possible or parse directly
const rawCsv = fs.readFileSync(0, 'utf-8'); // Read stdin

const lines = rawCsv.split('\n');
const map = {};

for (const line of lines) {
  if (!line.trim() || line.startsWith("City_Id")) continue;
  const parts = line.split(',');
  if (parts.length < 10) continue;

  let rawGov = parts[2].trim(); // City_Name_Ar
  let zoneNameAr = parts[5] ? parts[5].trim() : ""; // Zone_Name_Ar
  let districtNameAr = parts[9] ? parts[9].trim() : ""; // District_Name_Ar

  if (!rawGov) continue;

  // Standardize governorate names
  if (rawGov === "الاسكندريه") rawGov = "الإسكندرية";
  if (rawGov === "اسيوط") rawGov = "أسيوط";
  if (rawGov === "اسوان") rawGov = "أسوان";
  if (rawGov === "البحيره") rawGov = "البحيرة";
  if (rawGov === "القاهره") rawGov = "القاهرة";
  if (rawGov === "الدقهليه") rawGov = "الدقهلية";
  if (rawGov === "القليوبيه") rawGov = "القليوبية";
  if (rawGov === "الغربيه") rawGov = "الغربية";
  if (rawGov === "الجيزه") rawGov = "الجيزة";
  if (rawGov === "الاسماعيليه") rawGov = "الإسماعيلية";
  if (rawGov === "الاقصر") rawGov = "الأقصر";
  if (rawGov === "مرسي مطروح") rawGov = "مطروح";
  if (rawGov === "المنوفيه") rawGov = "المنوفية";
  if (rawGov === "بور سعيد") rawGov = "بورسعيد";
  if (rawGov === "البحر الاحمر") rawGov = "البحر الأحمر";
  if (rawGov === "الشرقيه") rawGov = "الشرقية";

  if (!map[rawGov]) {
    map[rawGov] = new Set();
  }

  if (districtNameAr) {
    map[rawGov].add(districtNameAr);
  }
  if (zoneNameAr) {
    map[rawGov].add(zoneNameAr);
  }
}

const result = [];
for (const [gov, citiesSet] of Object.entries(map)) {
  result.push({
    name: gov,
    cities: Array.from(citiesSet).filter(c => c.length > 0)
  });
}

const tsContent = `// Official Bosta Cities and Districts Mapping
export const BOSTA_OFFICIAL_GOVERNORATES = ${JSON.stringify(result, null, 2)};
`;

fs.writeFileSync('data/bostaOfficialCities.ts', tsContent, 'utf-8');
console.log("Successfully generated data/bostaOfficialCities.ts with", result.length, "governorates");
