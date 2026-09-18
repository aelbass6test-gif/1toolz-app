# Abdomedi Carrier & WhatsApp Edge Worker API

هذا الـ Worker السحابي يعمل كبوابة وسيطة سريعة (Serverless Edge Gateway) لشركات الشحن المصرية (**Bosta** و **Turbo**) مع وسيط فائق السرعة لـ **WhatsApp Meta Webhook**.

---

## 🌟 الميزات المحدثة

1. **مطابقة الـ CORS الديناميكية (Dynamic Origin Matching):**
   - يقبل دومين التطبيق المخصص `https://app.abdomedi.com`.
   - يقبل نطاقات المعاينة والتطوير التابعة لـ AI Studio Cloud Run (`https://ais-dev-...` و `https://ais-pre-...`) وروابط الـ Localhost بدون أي أخطاء CORS.

2. **وسيط استجابة WhatsApp / Meta Webhook على الحافة (Edge Webhook):**
   - استجابة فورية لطلب التحقق من فيسبوك `hub.challenge` خلال أقل من 50 مللي ثانية.
   - استقبال إشعارات الأحداث وتمريرها فورياً للنظام الخلفي (`APP_BACKEND_URL`).

3. **تكامل Bosta v2 الكامل:**
   - تقييم العميل ومعدل التسليم `POST /api/bosta/customer-rate`
   - إنشاء الشحنات الفردية والجماعية `POST /api/bosta/deliveries/create` & `/bulk`
   - طباعة وتوليد بوالص الشحن `POST /api/bosta/deliveries/mass-awb` & `/:id/awb`
   - تتبع الشحنات `GET /api/bosta/deliveries/track/:trackingNumber`
   - المدن والمناطق وفروع الاستلام `GET /api/bosta/cities`, `/districts`, `/business-locations`

4. **تكامل Turbo Express الكامل:**
   - إنشاء وتعديل وإلغاء الشحنات `POST /api/turbo/shipments/create`, `/edit`, `/cancel`
   - تتبع الشحنات اللحظي `POST /api/turbo/shipments/track/:trackingNumber`
   - المحافظات والمناطق `GET /api/turbo/governorates` & `/areas/:id`

---

## 🚀 النشر على Cloudflare

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

## 🔑 المتغيرات والأسرار (Secrets & Environment Variables)

يمكن ضبط المتغيرات مباشرة في لوحة Cloudflare أو عبر الأوامر:

```bash
npx wrangler secret put BOSTA_API_KEY
npx wrangler secret put TURBO_API_KEY
npx wrangler secret put TURBO_MAIN_CLIENT_CODE
npx wrangler secret put META_VERIFY_TOKEN
```

---

## 📡 قائمة المسارات (Endpoints)

- `GET /health` : فحص حالة الخادم ومميزات البوابة
- `GET/POST /api/webhook/whatsapp` : وسيط استقبال وتحقق واتساب ميتا
- `GET /api/bosta/cities` : جلب مدن بوسطة
- `GET /api/bosta/districts` : جلب مناطق بوسطة
- `POST /api/bosta/deliveries/create` : إنشاء شحنة بوسطة
- `GET /api/bosta/deliveries/track/:trackingNumber` : تتبع شحنة بوسطة
- `GET /api/bosta/customer-rate?phone=...` : تقييم العميل وسجل التسليم
- `GET /api/turbo/governorates` : جلب محافظات تيربو
- `POST /api/turbo/shipments/create` : إنشاء شحنة تيربو
- `POST /api/turbo/shipments/track/:trackingNumber` : تتبع شحنة تيربو

