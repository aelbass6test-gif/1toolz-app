# منصة عبدو ميديا لإدارة المتاجر الإلكترونية والعمليات السحابية (AbdoMedia E-Commerce Engine)

نظام تشغيل متكامل لإدارة المتاجر الإلكترونية، تتبع الشحنات، الربط مع شركات الشحن، واتساب والرسائل، والنطاقات المخصصة عبر Cloudflare for SaaS.

---

## 🚀 نظرة عامة على البنية التحتية

1. **الواجهة الأمامية واللوحة الإدارية (Dashboard & Storefront):**
   - مبنية باستخدام React 18، TypeScript، Tailwind CSS، و Lucide Icons.
   - تدعم التبديل اللحظي بين وضع اللوحة الإدارية ووضع واجهة المتجر المستقلة (Standalone Storefront) بالاعتماد على الـ Hostname أو المعايير المختارة.
   - معاينة مباشرة للمتجر مع أولوية النطاق المخصص (`customDomain`) يليه النطاق الفرعي السحابي (`subdomain.abdomedi.com`).

2. **الخادم السحابي (Node.js & Express Server):**
   - خادم سريع متصل بقاعدة بيانات Supabase السحابية وIndexedDB المحلية.
   - يدعم مصادقة وتوثيق النطاقات المخصصة عبر Cloudflare for SaaS API.
   - يوفر خوادم وكيلة (Proxies) لشركات الشحن (بوسطة، أوتو، فاسلو، أرامكس، سبل، فاستلو، بريد مصر، طرود، أودرجي).

3. **Cloudflare Worker (Edge Gateway & Multi-Origin Proxy):**
   - يعمل عند حافة الشبكة العالمية (Edge) لتوجيه الطلبات وتسريع التجاوب (< 50ms).
   - يدعم CORS الديناميكي لكل من:
     - النطاق الرئيسي: `https://app.abdomedi.com`
     - النطاقات السحابية للمعاينة: `https://ais-dev-...` و `https://ais-pre-...` و `https://*.run.app`
     - نطاقات المتاجر الفرعية والمخصصة للمستخدمين.
   - يستقبل Webhooks الخاصة بشركات الشحن وتأكيد الواتساب من Meta فورياً.

---

## 🌐 المتغيرات البيئية (Environment Variables)

| المتغير | الوصف | إلزامي؟ |
| :--- | :--- | :--- |
| `CLOUDFLARE_ZONE_ID` | معرّف نطاق abdomedi.com في حساب Cloudflare | نعم (لإدارة النطاقات المخصصة آلياً) |
| `CLOUDFLARE_API_TOKEN` | توكن Cloudflare بصلاحيات `Zone:Read`, `SSL and Certificates:Edit`, `Custom Hostnames:Edit` | نعم |
| `VITE_SUPABASE_URL` | رابط مشروع Supabase السحابي | اختياري (يدعم التشغيل المحلي) |
| `VITE_SUPABASE_ANON_KEY` | المفتاح العام لمشروع Supabase | اختياري |
| `GEMINI_API_KEY` | مفتاح Google Gemini للذكاء الاصطناعي والمساعد التسويقي | نعم للميزات الذكية |

---

## 📡 قائمة مسارات الخادم والـ API (Routes Documentation)

### 1. النطاقات المخصصة و Cloudflare for SaaS
- `GET /api/cloudflare/saas-status`
  - فحص حالة تفعيل ميزة SSL for SaaS، وقراءة الـ Fallback Origin الحالي وحالته (`active` / `pending`).
- `POST /api/cloudflare/set-fallback-origin`
  - ضبط الـ Fallback Origin تلقائياً إلى `fallback.abdomedi.com` أو النطاق المحدد.
- `GET /api/cloudflare/verify-domain?domain=example.com`
  - الاستعلام عن حالة توثيق نطاق مخصص وشهادة SSL وسجلات DNS المطلوبة (Ownership TXT & SSL TXT).
- `POST /api/cloudflare/create-hostname`
  - تسجيل دومين مخصص جديد عبر Cloudflare Custom Hostnames API وإرجاع سجلات الـ DNS المطلوبة للربط.
- `DELETE /api/cloudflare/delete-hostname?domain=example.com`
  - إزالة النطاق المخصص من Cloudflare عند حذفه من المتجر.

### 2. تتبع الشحنات واللوجستيات (Shipping & Logistics Proxy)
- `POST /api/shipping/bosta/track`
  - تتبع شحنات بوسطة (Bosta) برقم التتبع أو رقم البوليصة.
- `POST /api/shipping/oto/track`
  - تتبع شحنات شركة أوتو (OTO).
- `POST /api/shipping/aramex/track`
  - تتبع شحنات أرامكس (Aramex).
- `POST /api/shipping/fastlo/track`
  - تتبع شحنات فاستلو (Fastlo).
- `POST /api/shipping/spl/track`
  - تتبع شحنات سبل (البريد السعودي).
- `POST /api/shipping/egyptpost/track`
  - تتبع شحنات البريد المصري.
- `POST /api/shipping/torod/track`
  - تتبع الشحنات عبر منصة طرود (Torod).
- `POST /api/shipping/odergy/track`
  - تتبع الشحنات عبر منصة أودرجي (Odergy).

### 3. إشعارات الويب وهواتف الميتا (Webhooks & WhatsApp)
- `GET /api/webhooks/whatsapp`
  - التحقق من Webhook الخاص بشركة Meta (WhatsApp Cloud API Verification).
- `POST /api/webhooks/whatsapp`
  - استقبال الرسائل وتحديثات تسليم الإشعارات عبر الواتساب.
- `POST /api/webhooks/shipping/:carrier`
  - استقبال تحديثات حالة الشحنات من شركات الشحن المختلفة وتحديث حالة الطلب تلقائياً في المتجر.

---

## 🛠️ خطوات ضبط Cloudflare for SaaS يدوياً (Fallback Origin)

1. ادخل على **[Cloudflare Dashboard](https://dash.cloudflare.com)** واختر نطاقك الأساسي **`abdomedi.com`**.
2. من القائمة الجانبية، توجه إلى **SSL/TLS** ⬅️ **Custom Hostnames**.
3. اضغط على زر **Enable Cloudflare for SaaS**.
4. في خانة **Fallback Origin**، أدخل:
   ```text
   fallback.abdomedi.com
   ```
5. في قسم **DNS Records** داخل حساب Cloudflare لنطاق `abdomedi.com`:
   - أضف سجل من نوع **CNAME**:
     - **Name:** `fallback`
     - **Target:** رابط الخادم السحابي للتطبيق
     - **Proxy status:** Proxied (السحابة البرتقالية 🟠)
6. الآن، أي تاجر يربط دومينه الخاص (مثل `mystore.com`) بتوجيهه عبر CNAME إلى `fallback.abdomedi.com` سيتصل متجره فوراً وتصدر له شهادة SSL تلقائية ومجانية.

---

## 💻 التشغيل المحلي (Run Locally)

1. تثبيت الاعتماديات:
   ```bash
   npm install
   ```
2. بدء خادم التطوير:
   ```bash
   npm run dev
   ```
3. البناء للإنتاج:
   ```bash
   npm run build
   ```
