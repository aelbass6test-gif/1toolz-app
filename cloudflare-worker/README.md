# Abdomedi Carrier API Worker

هذا Worker ينقل مسارات الفحص والقراءة الآمنة لشركات الشحن خارج حماية صفحة التطبيق. المرحلة الأولى لا تنشئ شحنات ولا تستقبل Webhooks؛ هذه المسارات تُضاف بعد ربط قاعدة البيانات والتحقق من التوثيق.

## اختبار محلي

```bash
cd cloudflare-worker
npm install
npm run typecheck
npx wrangler dev
```

## الأسرار

لا تضع المفاتيح في `wrangler.toml` أو GitHub. أضفها عبر Cloudflare:

```bash
npx wrangler secret put BOSTA_API_KEY
npx wrangler secret put TURBO_API_KEY
npx wrangler secret put TURBO_MAIN_CLIENT_CODE
```

## النشر

```bash
npx wrangler login
npx wrangler deploy
```

بعد التأكد من `/health`، اربط `api.abdomedi.com` كـ Custom Domain من Cloudflare Workers. لا تضف DNS عشوائيًا قبل أن يعرض Cloudflare طريقة الربط المناسبة للحساب.

## المسارات الحالية

- `GET /health`
- `POST /api/bosta/verify`
- `GET /api/bosta/cities`
- `POST /api/turbo/verify`
- `GET /api/turbo/governorates`

الاستجابة دائمًا JSON، ولا توجد مفاتيح مضمّنة في JavaScript الواجهة. إنشاء الشحنات وWebhooks متوقفان عمدًا حتى يتم ربط قاعدة البيانات والتحقق من توقيعات الأحداث.
