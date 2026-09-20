# مخطط صندوق وارد واتساب في Supabase

## الهدف

يضيف هذا التصميم طبقة رسائل مستقلة عن جدول `orders`. يظل الطلب مصدر بيانات الطلب التجاري، بينما يصبح جدول `whatsapp_messages` المصدر canonical لسجل المحادثة. هذا يمنع فقدان الرسائل عند تحديث الطلب أو استبدال حقول `whatsappLogs`، ويجعل تشغيل Supabase Realtime والبحث والعدادات أكثر موثوقية.

## الجداول

| الجدول | الوظيفة |
|---|---|
| `whatsapp_conversations` | سجل صندوق الوارد: العميل، الطلب المرتبط، آخر رسالة، العداد، التثبيت والأرشفة والكتم. |
| `whatsapp_messages` | رسالة واحدة لكل إرسال أو استقبال أو حدث نظامي، مع الحالة والـ provider والمعرّف الخارجي. |
| `whatsapp_message_events` | تاريخ حالات الرسالة مثل `sent` و`delivered` و`read` و`failed`. |

العلاقة الأساسية هي `whatsapp_conversations.id -> whatsapp_messages.conversation_id`. ويوجد ربط اختياري بالطلب عبر `order_id`. يستخدم التصميم `ON DELETE SET NULL` للطلب حتى لا تختفي المحادثة إذا حُذف الطلب، بينما يؤدي حذف المتجر إلى حذف بياناته التابعة.

## السلوك الآلي

عند إدخال رسالة جديدة، يقوم Trigger بتحديث `last_message_preview` و`last_message_at` و`last_message_direction` في المحادثة، ويزيد `unread_count` عند استقبال رسالة من العميل. وتوفر الدالة `mark_whatsapp_conversation_read` طريقة واحدة لتصفير العداد وتسجيل وقت القراءة.

يوجد فهرس فريد على `(provider, provider_message_id)` لمنع تكرار رسالة Meta أو UltraMsg إذا أعاد مزود الخدمة إرسال نفس webhook. يجب تمرير `provider_message_id` في كل webhook عندما يكون متاحًا.

## Realtime وRLS

تضيف migration جدولَي `whatsapp_conversations` و`whatsapp_messages` إلى publication المسماة `supabase_realtime` بطريقة آمنة عند إعادة التشغيل. يتم تفعيل RLS، لكن لا تُضاف سياسات anon عامة؛ لأن المشروع الحالي يستخدم نموذج مستخدمين ومتاجر مخصصًا وليس Supabase Auth. يجب إنشاء سياسة عضوية المتجر قبل قراءة هذه الجداول مباشرة من المتصفح بمفتاح anon. أما Edge Functions التي تستخدم service role فتتجاوز RLS وفق إعدادات Supabase المعتادة.

## التطبيق

طبّق الملف التالي من Supabase SQL Editor أو عبر نظام migrations:

[ملف migration الجاهز](../supabase/migrations/20260920033000_whatsapp_inbox.sql)

بعد التطبيق، ينبغي تعديل webhook ومسار الإرسال ليقوما بالخطوات التالية:

1. إيجاد أو إنشاء المحادثة باستخدام `store_id` و`order_id` و`customer_phone`.
2. إدخال الرسالة في `whatsapp_messages` مع `provider_message_id`.
3. إدخال أحداث التسليم والقراءة في `whatsapp_message_events`.
4. جعل واجهة لوحة التحكم تشترك في `whatsapp_messages` و`whatsapp_conversations` عبر Realtime.
5. إبقاء `orders.whatsappLogs` كطبقة توافق مؤقتة أثناء نقل الواجهة بالكامل إلى الجداول الجديدة.

> ملاحظة: هذه migration تنشئ البنية وتفعيل Realtime، لكنها لا تنقل السجلات التاريخية الموجودة داخل `orders.whatsappLogs` تلقائيًا، ولا تغيّر webhook أو الواجهة قبل ربطهما بالجداول الجديدة.
