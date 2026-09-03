const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const injection = `
  let cachedDistrictsData: any = null;
  let cachedDistrictsTimestamp = 0;

  async function resolveBostaDistrictInfo(cityName: string, rawArea: string) {
    const normCityName = normalizeBostaCity(cityName);
    try {
      const now = Date.now();
      if (!cachedDistrictsData || (now - cachedDistrictsTimestamp > 30 * 60 * 1000)) {
        const res = await safeBostaFetch("https://app.bosta.co/api/v2/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5");
        if (res.ok && res.data) {
          cachedDistrictsData = res.data?.data?.list || res.data?.data || res.data;
          cachedDistrictsTimestamp = now;
        }
      }
    } catch (e) {
      console.error("Failed to load bosta districts:", e);
    }
    
    let fallbackDistrictName = (rawArea || normCityName || "Cairo").trim();
    if (fallbackDistrictName.includes("-")) {
      const parts = fallbackDistrictName.split("-").map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) fallbackDistrictName = parts[parts.length - 1];
    }
    if (!fallbackDistrictName || fallbackDistrictName === "نقطة البيع" || fallbackDistrictName === "غير محدد") {
      fallbackDistrictName = normCityName || "Cairo";
    }

    if (!cachedDistrictsData || !Array.isArray(cachedDistrictsData)) {
      return { cityName: normCityName, districtName: fallbackDistrictName };
    }

    const norm = (s: string) => (s || "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\\s+/g, " ");
    const target = norm(fallbackDistrictName);
    const nCity = norm(normCityName);

    const matchedCity = cachedDistrictsData.find((c: any) => 
      norm(c.cityName) === nCity || norm(c.cityOtherName) === nCity || norm(c.cityName).includes(nCity) || norm(c.cityOtherName).includes(nCity)
    );

    const citiesToSearch = matchedCity ? [matchedCity, ...cachedDistrictsData.filter((c: any) => c !== matchedCity)] : cachedDistrictsData;

    for (const c of citiesToSearch) {
      if (!c.districts || !Array.isArray(c.districts)) continue;
      for (const d of c.districts) {
        if (norm(d.districtName) === target || norm(d.districtOtherName) === target) {
          return { cityId: c.cityId, cityName: c.cityName, districtId: d.districtId, districtName: d.districtName || fallbackDistrictName, districtOtherName: d.districtOtherName, zoneId: d.zoneId };
        }
      }
    }

    if (target.length >= 3) {
      for (const c of citiesToSearch) {
        if (!c.districts || !Array.isArray(c.districts)) continue;
        for (const d of c.districts) {
          const dOther = norm(d.districtOtherName);
          const dName = norm(d.districtName);
          if (dOther.includes(target) || (target.length >= 4 && dOther && target.includes(dOther)) || dName.includes(target)) {
            return { cityId: c.cityId, cityName: c.cityName, districtId: d.districtId, districtName: d.districtName || fallbackDistrictName, districtOtherName: d.districtOtherName, zoneId: d.zoneId };
          }
        }
      }
    }

    return { cityId: matchedCity ? matchedCity.cityId : undefined, cityName: matchedCity ? matchedCity.cityName : normCityName, districtName: fallbackDistrictName };
  }
`;

code = code.replace(
  '  const resolveBostaKey = (c: any, configKey?: string): string => {',
  injection + '\n  const resolveBostaKey = (c: any, configKey?: string): string => {'
);

fs.writeFileSync('server.ts', code);
