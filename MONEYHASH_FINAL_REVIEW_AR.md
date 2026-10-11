# تقرير المراجعة النهائية لتكامل MoneyHash

## النتيجة

تمت مراجعة الحالة الحالية للمشروع وإجراء إصلاحات مركزة فقط، دون refactor كبير أو تغيير UI غير مطلوب.

## الملفات التي تمت مراجعتها أو تعديلها

- `server.ts`: إنشاء intent من بيانات المتجر على الخادم، حساب السعر والإجمالي على الخادم، مفاتيح idempotency، retrieve intent، webhook موقّع ومعزول بـ`store_id`، ومنع رجوع الحالة بعد الدفع.
- `utils/moneyHashService.ts`: إزالة إرسال أو قراءة credentials من المتصفح، والتحقق من نطاق `embed_url` الرسمي.
- `utils/moneyHashSecurity.ts`: تحقق MoneyHash HMAC-SHA256 v3، allowlist للروابط، وتصنيف حالات الدفع monotonic.
- `components/CheckoutPage.tsx` و`components/OrderDetailsModal.tsx`: إرسال `storeId/orderId/items` فقط إلى الخادم، وعدم اعتماد redirect كإثبات نجاح.
- `components/PaymentSettingsPage.tsx` و`types.ts`: إزالة حقول المفاتيح السرية من إعدادات الواجهة والنوع العام.
- `App.tsx`: تمرير معرف المتجر إلى checkout.
- `supabase/migrations/20261011070000_moneyhash_payments.sql`: جداول payments وwebhook inbox مع unique constraints وRLS.
- `tests/moneyhash-security.test.ts` و`package.json`: إضافة اختبارات أمنية وأمر `npm test`.
- `.env.example`: إضافة أسماء متغيرات الخادم فقط دون قيم.

## التحقق الأمني المنفذ

- مفاتيح MoneyHash السرية ومفتاح توقيع المنظمة تُقرأ من متغيرات الخادم فقط.
- حساب كل متجر يُحدد من خريطة الخادم أو معرف الحساب غير السري المخزن للمتجر.
- السعر، العملة، الشحن، الخصم، والإجمالي تُعاد قراءتها من إعدادات المتجر ومنتجاته على الخادم. لا يُقبل `amount` أو `currency` من العميل.
- intent وpayment وwebhook queries مقيّدة بـ`store_id`.
- إنشاء intent يستخدم `X-Idempotency-Key` ثابتاً لكل متجر وطلب.
- webhook يستخدم `MoneyHash-Signature` الرسمي، HMAC-SHA256 v3، timestamp tolerance، وraw payload.
- الحدث المكتمل سابقاً يعيد 200 duplicate، والحدث قيد المعالجة يعيد 503.
- الحالة المدفوعة لا يمكن أن ترجع إلى pending/failed بواسطة حدث متأخر.
- redirect لا يثبت نجاح الدفع؛ النجاح يتطلب webhook أو retrieve من الخادم.
- `embed_url` مقبول فقط عبر HTTPS ومن نطاقات MoneyHash الرسمية.

## نتائج الأوامر

- `npm test`: **ناجح** — 4 اختبارات ناجحة.
- `npx tsc --noEmit`: **ناجح**.
- `npm run build`: **ناجح** — Vite وserver bundle وCloudflare worker bundle.

## متطلبات تشغيل قبل تفعيل الإنتاج

1. تطبيق migration `20261011070000_moneyhash_payments.sql`.
2. ضبط متغيرات الخادم فقط: `MONEYHASH_API_KEY` و`MONEYHASH_ORGANIZATION_KEY` و`SUPABASE_SERVICE_ROLE_KEY` و`MONEYHASH_ACCOUNT_MAP_JSON`.
3. ربط كل `store_id` بحساب MoneyHash مستقل في `MONEYHASH_ACCOUNT_MAP_JSON` أو عبر معرف الحساب غير السري المخزن للمتجر.
4. ضبط webhook في MoneyHash على `/api/webhooks/moneyhash`.

## مخاطر أو TODO متبقية

- لم أغيّر نظام المصادقة العام للمشروع. لذلك يجب أن تمر مسارات إعدادات بوابة الدفع في طبقة التطبيق الحالية عبر owner/admin قبل النشر، وألا تُعتمد حماية الواجهة وحدها.
- migration تقفل جداول MoneyHash الجديدة عن `anon/authenticated` وتعتمد على `SUPABASE_SERVICE_ROLE_KEY` في الخادم؛ يجب التأكد من توفره في بيئة الإنتاج.
- يلزم اختبار webhook فعلي في بيئة staging بعد تطبيق migration، خصوصاً مطابقة أسماء جدول الطلبات وحقول `paymentStatus` في مخطط الإنتاج.
- لم تُطبع أي مفاتيح أو أسرار في هذا التقرير أو السجلات.

مرجع التوقيع الرسمي: https://docs.moneyhash.io/docs/webhooks-signature
