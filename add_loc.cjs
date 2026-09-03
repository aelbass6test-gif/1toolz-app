const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const injection = `
  app.get("/api/bosta/business-locations", async (c) => {
    try {
      const apiKey = resolveBostaKey(c, c.req.query("apiKey"));
      const isStaging = c.req.query("staging") === "true";
      const baseUrl = isStaging ? "https://stg-app.bosta.co" : "https://app.bosta.co";

      if (!apiKey) {
        return c.json({ success: false, error: "مفتاح الربط غير متوفر." }, 400);
      }

      const resResult = await safeBostaFetch(\`\${baseUrl}/api/v2/business-locations\`, {
        headers: { "Authorization": apiKey }
      });

      if (!resResult.ok) {
        return c.json({ success: false, error: resResult.data?.message || "فشل جلب قائمة الفروع من بوسطة" }, (resResult.status >= 200 && resResult.status < 600 ? resResult.status : 500) as any);
      }
      return c.json({ success: true, data: resResult.data?.data || resResult.data });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });
`;

code = code.replace(
  '  // 7.1 Live Bosta Districts List (All Egypt)',
  injection + '\n  // 7.1 Live Bosta Districts List (All Egypt)'
);

fs.writeFileSync('server.ts', code);
