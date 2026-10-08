---
title: پیکربندی
description: چگونه میترا را با متغیرهای محیطی پیکربندی کنید، متغیرهایی که بیشتر سرورها لازم دارند، و هر متغیر با مقدار پیش‌فرضش.
---

میترا کاملاً با متغیرهای محیطی پیکربندی می‌شود. فایل پیکربندی‌ای برای mount کردن نیست: متغیرها را روی container تنظیم می‌کنید و میترا هنگام شروع آن‌ها را می‌خواند. هر متغیر اختیاری است و متغیری که تنظیم نکنید از مقدار پیش‌فرضی که [در ادامه](#all-variables) آمده استفاده می‌کند.

با Docker Compose، آن‌ها در بلوک `environment` قرار می‌گیرند:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

اگر ترجیح می‌دهید رمزها در فایل compose نباشند، یک فایل `.env` یا Docker secrets هم به همان اندازه خوب کار می‌کند. تغییر با شروع بعدی میترا اعمال می‌شود:

```bash
docker compose up -d
```

## چه چیزی باید روی سرور راه‌اندازی شود

تقریباً هیچ چیز. افراد [تقویم‌های میترا](integrations/mitra.md)، [CalDAV](integrations/caldav.md)، [تقویم اپل](integrations/apple.md)، [اشتراک‌های تقویم](integrations/subscriptions.md)، [Notion](integrations/notion.md) و [Tempo](integrations/tempo.md) را خودشان در برنامه اضافه می‌کنند.

دو چیز به اعتبارنامه‌هایی نیاز دارند که ابتدا باید نزد کس دیگری ثبت کنید: [تقویم گوگل](integrations/google.md) (`MITRA_GOOGLE_*`) و [ورود به حساب](sso.md) (`MITRA_OIDC_*`).

## پشت HTTPS بگذارید

به محض اینکه میترا از جایی غیر از دستگاه خودتان در دسترس است، آن را پشت یک reverse proxy مثل Caddy، Traefik یا nginx بگذارید و اجازه دهید پروکسی HTTPS را مدیریت کند. خود میترا داخل container با HTTP ساده کار می‌کند. بعضی قابلیت‌ها فقط روی HTTPS کار می‌کنند:

- مرورگرها [یادآورها](reminders.md) و [نصب برنامه](install-app.md) را فقط روی نشانی‌های `https://` (و `http://localhost`) اجازه می‌دهند.
- کوکی‌های [ورود به حساب](sso.md) فقط روی `https://` امن علامت می‌خورند و بیشتر ارائه‌دهندگان هویت بر نشانی redirect با `https://` پافشاری می‌کنند.
- [تقویم گوگل](integrations/google.md) نشانی redirect با `https://` می‌خواهد.

سپس [`MITRA_URL`](#set-the-public-url) را روی نشانی عمومی تنظیم کنید.

با [Caddy](https://caddyserver.com/)، همین کافی است:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

با [Traefik](https://traefik.io/)، با label روی سرویس به میترا مسیر بدهید:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## تنظیم نشانی عمومی

`MITRA_URL` نشانی‌ای است که افراد در مرورگر می‌نویسند تا به میترا برسند، نه نشانی داخلی container:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

میترا نشانی‌های بازگشت برای تقویم گوگل و ورود به حساب را از آن می‌سازد و اگر با `https://` شروع شود کوکی‌هایش را امن علامت می‌زند. تا وقتی میترا را روی `http://localhost` امتحان می‌کنید می‌توانید آن را نگذارید. به محض اینکه میترا نشانی واقعی پیدا کرد تنظیمش کنید، و برای روشن کردن ورود به حساب باید تنظیمش کنید.

## نام‌گذاری نمونه شما

`MITRA_NAME` «میترا» را در نوار کناری و زبانه مرورگر عوض می‌کند:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

کلیک روی نام، گفتگوی **درباره** را باز می‌کند که نسخه و commit در حال اجرا را نشان می‌دهد. [برنامه نصب‌شده](install-app.md) نام و آیکون «میترا» را نگه می‌دارد، چون این‌ها هنگام ساخت برنامه ثابت می‌شوند.

## همه متغیرها

### هسته

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `MITRA_URL` | *(تنظیم‌نشده)* | [نشانی عمومی](#set-the-public-url) که افراد با آن به میترا می‌رسند، مثل `https://mitra.example.com`. نشانی‌های بازگشت برای ورود به حساب و تقویم گوگل، و امن بودن کوکی‌ها، از آن می‌آیند. تا وقتی میترا را روی localhost امتحان می‌کنید اختیاری است، برای [ورود به حساب](sso.md) الزامی است، و برای [تقویم گوگل](integrations/google.md) و هر سرور عمومی توصیه می‌شود. |
| `MITRA_NAME` | *(میترا، به زبان هر فرد)* | [نامی](#name-your-instance) که در نوار کناری و زبانه مرورگر نشان داده می‌شود. [برنامه نصب‌شده](install-app.md) «میترا» می‌ماند. |
| `MITRA_PORT` | `3000` | پورتی که سرور روی آن گوش می‌دهد. با Docker، به جای آن سمت میزبانِ نگاشت پورت را عوض کنید؛ این را فقط وقتی تنظیم کنید که خود فرایند باید جای دیگری گوش دهد. بررسی سلامت داخلی از آن پیروی می‌کند. |
| `MITRA_LOG_LEVEL` | `info` | [میزان گزارش میترا](logging.md): `error`، `warn`، `info`، `debug` یا `trace`. هر سطح شامل همه سطح‌های آرام‌تر از خودش است. |
| `MITRA_UPDATE_CHECK` | *(روشن)* | برای خاموش کردن [بررسی به‌روزرسانی](updates.md) آن را روی `off` (یا `false`، `0`، `no`) بگذارید. |

### یادآورها

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | تماسی که سرویس‌های push برای [یادآورهای](reminders.md) سرور شما می‌بینند، معمولاً یک نشانی `mailto:`. هیچ‌یک از کاربران میترا آن را نمی‌بیند. کلیدهای امضا خودکار ساخته می‌شوند، پس چیز دیگری برای تنظیم نیست. |

### مکان

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | [geocoder Photon](location.md) پشت فیلد مکان. به جای نمونه عمومی komoot، آن را به نمونه Photon خودتان اشاره دهید. |

### تقویم گوگل

هر دو را تنظیم کنید تا افراد بتوانند [تقویم گوگل](integrations/google.md) را وصل کنند. تنظیم فقط شناسه، میترا را از شروع شدن بازمی‌دارد.

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(تنظیم‌نشده)* | شناسه کلاینت OAuth از Google Cloud console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(تنظیم‌نشده)* | رمز محرمانه کلاینت OAuth. هر وقت `MITRA_GOOGLE_CLIENT_ID` تنظیم شده باشد الزامی است. |

### ورود یکپارچه (single sign-on)

تنظیم `MITRA_OIDC_ISSUER` [ورود به حساب](sso.md) را روشن می‌کند. اگر متغیرهایی که نیاز دارد نباشند، میترا از شروع شدن امتناع می‌کند.

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(تنظیم‌نشده)* | نشانی issuer ارائه‌دهنده OIDC شما. به `MITRA_OIDC_CLIENT_ID` و `MITRA_URL` نیاز دارد. |
| `MITRA_OIDC_CLIENT_ID` | *(تنظیم‌نشده)* | شناسه کلاینتی که نزد ارائه‌دهنده‌تان ثبت شده. |
| `MITRA_OIDC_CLIENT_SECRET` | *(تنظیم‌نشده)* | رمز محرمانه کلاینت. برای کلاینت عمومی کنارش بگذارید؛ میترا همیشه از PKCE استفاده می‌کند. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | scopeهایی که میترا می‌خواهد، با فاصله جدا شده‌اند. `openid` الزامی است؛ `profile` و `email` نام و ایمیل هر فرد را به میترا می‌دهند. |

### تنظیم‌شده توسط build

این‌ها را روی سرور تنظیم نمی‌کنید. build یا image آن‌ها را می‌گذارد، یا برای کار روی خود میترا هستند.

| متغیر | تنظیم‌کننده | توضیح |
| --- | --- | --- |
| `MITRA_VERSION` | Build | نسخه‌ای که در image ساخته شده است. |
| `MITRA_COMMIT` | Build | commit ای که در image ساخته شده است. |
| `MITRA_DEV` | توسعه | هنگام کار روی میترا یکپارچه‌سازی **Demo**، مجموعه‌ای از تقویم‌های نمونه، را پیشنهاد می‌دهد. |
| `NODE_ENV` | Image | در image کانتینر `production` است. |

### نمونه

سروری با ورود به حساب، تقویم گوگل و geocoder مخصوص خودش:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
