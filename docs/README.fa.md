---
title: شروع کار
description: میترا را با Docker Compose نصب کنید، اولین تقویمتان را بگیرید و چند چیز را امتحان کنید.
sidebar:
  label: شروع کار
---

میترا یک تقویم خودمیزبان برای رویدادها و کارهای شماست. برای نگاهی اولیه، [دمو را امتحان کنید](https://demo.mitracal.com).

## نصب میترا

با [Docker](https://docs.docker.com/get-docker/) و افزونه Compose آن، فایل `compose.yaml` را بسازید:

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

دستور `docker compose up -d` را اجرا کنید و [http://localhost:3000](http://localhost:3000) را باز کنید.

پیش از آنکه به آن تکیه کنید، از `~/mitra` [نسخه پشتیبان بگیرید](backups.md) و [آن را پشت HTTPS قرار دهید](configuration.md#put-it-behind-https). اگر دیگران هم از آن استفاده می‌کنند، اول [ورود به حساب](sso.md) را روشن کنید، چون روشن کردن آن در زمانی دیگر، همه را با یک حساب خالی از نو شروع می‌کند.

## گرفتن یک تقویم

میترا هنگام اولین باز کردن پیشنهاد می‌دهد یکی اضافه کنید: یک [تقویم میترا](integrations/mitra.md) که روی سرور شما نگه‌داری می‌شود، یا حسابی که از پیش دارید، مانند [CalDAV](integrations/caldav.md) یا [Google Calendar](integrations/google.md).

## چیزهایی برای امتحان کردن

- در [نمای هفته](views/week.md) روی یک ساعت خالی بکشید تا رویدادی بسازید.
- در زبانه [برنامه‌ریزی](planning.md) نوار کناری روی **افزودن کار** بزنید و بعداً کار را به هفته‌تان بکشید.
- <kbd>/</kbd> را بزنید و **افزودن زمان در دسترس** را اجرا کنید تا [ساعت‌های کاری](availability.md) شما سایه بخورند.
- برای دریافت [یادآورها](reminders.md)، [میترا را روی تلفن خود نصب کنید](install-app.md).
- <kbd>?</kbd> را بزنید تا همه [کلیدهای میانبر](shortcuts.md) را ببینید.
