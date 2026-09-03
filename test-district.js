async function resolveBostaDistrictInfo(cityName, rawArea) {
  const r = await fetch("https://app.bosta.co/api/v2/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5");
  const json = await r.json();
  const cachedDistrictsData = json.data || [];

  let fallbackDistrictName = (rawArea || cityName || "Cairo").trim();
  if (fallbackDistrictName.includes("-")) {
    const parts = fallbackDistrictName.split("-").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) fallbackDistrictName = parts[parts.length - 1];
  }
  if (!fallbackDistrictName || fallbackDistrictName === "نقطة البيع" || fallbackDistrictName === "غير محدد") {
    fallbackDistrictName = cityName || "Cairo";
  }

  const norm = (s) => (s || "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
  const target = norm(fallbackDistrictName);
  const normCity = norm(cityName);

  const matchedCity = cachedDistrictsData.find((c) => 
    norm(c.cityName) === normCity || 
    norm(c.cityOtherName) === normCity || 
    norm(c.cityName).includes(normCity) || 
    norm(c.cityOtherName).includes(normCity)
  );

  const citiesToSearch = matchedCity ? [matchedCity, ...cachedDistrictsData.filter((c) => c !== matchedCity)] : cachedDistrictsData;

  for (const c of citiesToSearch) {
    if (!c.districts || !Array.isArray(c.districts)) continue;
    for (const d of c.districts) {
      if (norm(d.districtName) === target || norm(d.districtOtherName) === target) {
        return {
          cityId: c.cityId,
          cityName: c.cityName,
          districtId: d.districtId,
          districtName: d.districtName || fallbackDistrictName,
          districtOtherName: d.districtOtherName,
          zoneId: d.zoneId
        };
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
          return {
            cityId: c.cityId,
            cityName: c.cityName,
            districtId: d.districtId,
            districtName: d.districtName || fallbackDistrictName,
            districtOtherName: d.districtOtherName,
            zoneId: d.zoneId
          };
        }
      }
    }
  }

  return {
    cityId: matchedCity ? matchedCity.cityId : undefined,
    cityName: matchedCity ? matchedCity.cityName : cityName,
    districtName: fallbackDistrictName
  };
}

resolveBostaDistrictInfo("Giza", "الجيزة - الدقي").then(console.log);
