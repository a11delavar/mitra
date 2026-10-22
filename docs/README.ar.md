---
title: البدء
description: ثبّت Mitra باستخدام Docker Compose، وأضف تقويمك الأول، وجرّب بعض الأشياء.
sidebar:
  label: البدء
---

Mitra تقويم مستضاف ذاتيًا لأحداثك ومهامك. إذا أردت إلقاء نظرة أولًا، [فجرّب العرض التجريبي](https://demo.mitracal.com).

## تثبيت Mitra

إذا كان لديك [Docker](https://docs.docker.com/get-docker/) مع إضافة Compose، فأنشئ ملف `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

شغّل `docker compose up -d` وافتح [http://localhost:3000](http://localhost:3000).

قبل أن تعتمد عليه، [احتفظ بنسخة احتياطية](backups.md) من `~/mitra` و[ضعه خلف HTTPS](configuration.md#put-it-behind-https). وإذا كان سيستخدمه آخرون، ففعّل [تسجيل الدخول](sso.md) أولًا، لأن تفعيله لاحقًا يمنح كل شخص حسابًا جديدًا فارغًا.

## الحصول على تقويم

يعرض عليك Mitra إضافة تقويم عند فتحه أول مرة: [تقويم Mitra](integrations/mitra.md) محفوظ على خادمك، أو حساب لديك بالفعل، مثل [CalDAV](integrations/caldav.md) أو [تقويم Google](integrations/google.md).

## أشياء تستحق التجربة

- اسحب عبر ساعة فارغة في [عرض الأسبوع](views/week.md) لإنشاء حدث.
- انقر على **إضافة مهمة** في علامة التبويب [التخطيط](planning.md) في الشريط الجانبي، واسحب المهمة إلى أسبوعك لاحقًا.
- اضغط <kbd>/</kbd> وشغّل **إضافة توفر** لتظليل [ساعات عملك](availability.md).
- [ثبّت Mitra على هاتفك](install-app.md) لتصلك [التذكيرات](reminders.md).
- اضغط <kbd>?</kbd> لترى كل [اختصارات لوحة المفاتيح](shortcuts.md).
