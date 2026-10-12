# نظام رفع صور المنتجات

## النتيجة

يتم رفع صورة المنتج إلى Cloudflare R2، ثم يحفظ المنتج الرابط فقط بدل Base64 داخل Firestore:

```text
https://abdomedi.com/images/{storeId}/{productId}/{timestamp}-{random}-{filename}
```

مثال:

```text
https://abdomedi.com/images/store-123/prod-775/1720000000000-a1b2c3d4-drill.jpg
```

## مسارات API

### رفع الصور

```http
POST https://app.abdomedi.com/api/media/product-images
Authorization: Bearer <Supabase access token>
Content-Type: multipart/form-data
```

الحقول:

- `storeId`: معرّف المتجر.
- `productId`: معرّف المنتج، أو معرّف مؤقت للمنتج الجديد.
- `files`: صورة واحدة أو عدة صور.

الحدود الحالية:

- الحد الأقصى للصورة: 10 ميجابايت.
- الحد الأقصى للطلب: 20 صورة.
- الأنواع المسموحة: أي نوع يبدأ بـ `image/`، مع تطبيع امتدادات JPG/PNG/WebP/GIF/AVIF.

الاستجابة:

```json
{
  "success": true,
  "images": [
    {
      "key": "images/store-123/prod-775/1720000000000-a1b2c3d4-drill.jpg",
      "url": "https://abdomedi.com/images/store-123/prod-775/1720000000000-a1b2c3d4-drill.jpg"
    }
  ]
}
```

### عرض الصورة

```http
GET https://abdomedi.com/images/{key}
```

الصور ترجع بتخزين مؤقت طويل `immutable` لأنها تحمل اسمًا فريدًا.

## متطلبات Cloudflare

تم إنشاء مخزن R2 باسم:

```text
abdomedi-product-images
```

يجب نشر Worker باستخدام:

```bash
npm run build
npx wrangler deploy --config cloudflare-worker/wrangler.toml
```

وهو يحتوي على binding باسم `R2_IMAGES` ومسارات:

- `abdomedi.com/images/*`
- `app.abdomedi.com/api/media/*`

الإعداد `MEDIA_REQUIRE_AUTH=true` مقصود لمنع الرفع العام. الواجهة ترسل Supabase access token تلقائيًا عند توفر جلسة Supabase.
