-- =================================================================
-- ||                  DATABASE SCHEMA FOR WUILT CLONE            ||
-- =================================================================
-- هذا التطبيق يستخدم Supabase كمخزن بيانات (Document Store)
-- يتم حفظ بيانات كل متجر كملف JSON واحد داخل جدول 'documents'
-- هذا يسهل عملية المزامنة والعمل بدون تعقيدات العلاقات (Joins) في الواجهة الأمامية

-- 1. إنشاء جدول المستندات (Documents Table)
create table if not exists public.documents (
  id text primary key, -- معرف المتجر أو 'global'
  content jsonb not null, -- البيانات الكاملة للمتجر (منتجات، طلبات، إعدادات)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. تفعيل الحماية (Row Level Security)
alter table public.documents enable row level security;

-- 3. إنشاء سياسة الوصول (Access Policy)
-- تحذير: هذه السياسة تسمح للجميع بالقراءة والكتابة لتسهيل التجربة والتطوير.
-- للإنتاج الحقيقي، يجب تغييرها للتحقق من هوية المستخدم (auth.uid()).
create policy "Enable read/write access for all users"
on public.documents
for all
using (true)
with check (true);

-- 4. إعداد التحديث التلقائي للتوقيت
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.documents
  for each row execute procedure moddatetime (updated_at);
