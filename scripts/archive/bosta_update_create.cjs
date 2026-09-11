const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldDropOffStr = `        dropOffAddress: {
          firstLine: customerAddressLine,
          city: city,
          districtName: order.shippingArea || order.city || undefined,
          districtId: order.bostaDistrictId || undefined,
          zoneId: order.bostaZoneId || undefined,
          buildingNumber: order.buildingNumber || undefined,
          floor: order.floor || undefined,
          apartment: order.apartment || undefined
        },`;

const newDropOffStr = `        dropOffAddress: {
          firstLine: customerAddressLine,
          city: bostaLocationInfo.cityName || city,
          cityId: bostaLocationInfo.cityId || undefined,
          districtName: bostaLocationInfo.districtName || undefined,
          districtId: bostaLocationInfo.districtId || order.bostaDistrictId || undefined,
          zoneId: bostaLocationInfo.zoneId || order.bostaZoneId || undefined,
          buildingNumber: order.buildingNumber || undefined,
          floor: order.floor || undefined,
          apartment: order.apartment || undefined
        },`;

code = code.replace(oldDropOffStr, newDropOffStr);

// We need to inject `const bostaLocationInfo = await resolveBostaDistrictInfo(city, order.shippingArea || order.city || "");` before it
code = code.replace('let codAmount = 0;', 'const bostaLocationInfo = await resolveBostaDistrictInfo(city, order.shippingArea || order.city || "");\n      let codAmount = 0;');

fs.writeFileSync('server.ts', code);
