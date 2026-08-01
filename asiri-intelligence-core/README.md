# Asiri Intelligence Core

النواة المركزية لمنظومة Asiri Intelligence Platform.

## الهدف

توحيد إدارة المشاريع والمهام والقرارات والذاكرة وسجل النشاط في خدمة واحدة قابلة للاستخدام من:

- Asiri Music OS
- Asiri Capital
- AGIP
- Personal Operations

## الإصدار الحالي

`v0.1.0-foundation`

## المعمارية

- `apps/web`: واجهة Next.js
- `services/api`: واجهة FastAPI
- `supabase/migrations`: قاعدة البيانات وسياسات الأمان
- `docs`: القرارات المعمارية والتوثيق
- `seed`: بيانات البداية

## أول سيناريو مسجل

المشروع: Asiri Music OS

القرار: إيقاف تشغيل Spotify داخل Safari.

السبب: عدم استقرار Spotify Web Playback SDK على iOS وظهور `Device not found`.

الحل الحالي: إدارة البحث والجلسات داخل Asiri Music، والتشغيل عبر تطبيق Spotify الأصلي.

الخطوة التالية: تطبيق iOS أصلي وربطه بـSpotify App Remote.

## حالة المرحلة صفر

- [x] هيكل المشروع
- [x] نموذج قاعدة البيانات
- [x] نقطة بدء FastAPI
- [x] واجهة Dashboard أولية
- [x] بيانات Asiri Music التجريبية
- [ ] ربط Supabase فعليًا
- [ ] المصادقة
- [ ] الاختبارات المتكاملة
