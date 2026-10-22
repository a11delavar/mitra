---
title: الإعداد
description: "كيف تضبط Mitra بمتغيرات البيئة، والمتغيرات التي تحتاجها معظم الخوادم، وكل متغير مع قيمته الافتراضية."
---

يُضبط Mitra بالكامل عبر متغيرات البيئة. لا يوجد ملف إعداد تربطه بالحاوية: تضبط المتغيرات على الحاوية، ويقرؤها Mitra عند تشغيله. كل المتغيرات اختيارية، والمتغير الذي لا تضبطه يأخذ القيمة الافتراضية المذكورة [أدناه](#all-variables).

مع Docker Compose، توضع المتغيرات في القسم `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

ويعمل ملف `.env` أو أسرار Docker بالقدر نفسه، إن كنت تفضل إبقاء الأسرار خارج ملف compose. يسري التغيير في المرة التالية التي يبدأ فيها Mitra:

```bash
docker compose up -d
```

## ما يلزم إعداده على الخادم

لا شيء تقريبًا. يضيف المستخدمون بأنفسهم، داخل التطبيق، [تقويمات Mitra](integrations/mitra.md) و[CalDAV](integrations/caldav.md) و[تقويم Apple](integrations/apple.md) و[الاشتراكات في التقويمات](integrations/subscriptions.md) و[Notion](integrations/notion.md) و[Todoist](integrations/todoist.md) و[Tempo](integrations/tempo.md).

أمران فقط يحتاجان إلى بيانات اعتماد تسجلها أولًا لدى جهة أخرى: [تقويم Google](integrations/google.md) (`MITRA_GOOGLE_*`) و[تسجيل الدخول](sso.md) (`MITRA_OIDC_*`).

## وضعه خلف HTTPS

حين يصبح الوصول إلى Mitra ممكنًا من أي مكان غير جهازك، ضعه خلف خادم وكيل عكسي مثل Caddy أو Traefik أو nginx، ودع الخادم الوكيل يتولى HTTPS. فـ Mitra نفسه يتحدث HTTP العادي داخل الحاوية. وبعض الميزات لا تعمل إلا عبر HTTPS:

- لا تسمح المتصفحات [بالتذكيرات](reminders.md) و[بتثبيت التطبيق](install-app.md) إلا على عناوين `https://` (وعلى `http://localhost`).
- لا تُعلَّم ملفات تعريف الارتباط الخاصة [بتسجيل الدخول](sso.md) بأنها آمنة إلا على `https://`، ومعظم مزوّدي الهوية يشترطون عنوان إعادة توجيه يبدأ بـ `https://`.
- يتطلب [تقويم Google](integrations/google.md) عنوان إعادة توجيه يبدأ بـ `https://`.

ثم اضبط [`MITRA_URL`](#set-the-public-url) على العنوان العام.

مع [Caddy](https://caddyserver.com/)، هذا كل ما يلزم:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

ومع [Traefik](https://traefik.io/)، وجّه الطلبات إلى Mitra بتسميات (labels) على الخدمة:

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

## تعيين العنوان العام

`MITRA_URL` هو العنوان الذي يكتبه المستخدمون في المتصفح للوصول إلى Mitra، لا العنوان الداخلي للحاوية:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

يبني Mitra منه عناوين العودة لتقويم Google ولتسجيل الدخول، ويعلّم ملفات تعريف الارتباط بأنها آمنة حين يبدأ بـ `https://`. يمكنك الاستغناء عنه ما دمت تجرب Mitra على `http://localhost`. اضبطه حالما يصبح لـ Mitra عنوان حقيقي، ولا بد من ضبطه لتفعيل تسجيل الدخول.

## تسمية نسختك

يحل `MITRA_NAME` محل «Mitra» في الشريط الجانبي وعلامة تبويب المتصفح:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

النقر على الاسم يفتح مربع الحوار **حول**، الذي يعرض الإصدار والإيداع (commit) اللذين تشغّلهما. ويحتفظ [التطبيق المثبت](install-app.md) بالاسم والرمز «Mitra»، لأنهما يُثبَّتان عند بناء التطبيق.

## كل المتغيرات

### الأساسية

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_URL` | *(غير مضبوط)* | [العنوان العام](#set-the-public-url) الذي يصل منه المستخدمون إلى Mitra، مثل `https://mitra.example.com`. منه تُبنى عناوين العودة لتسجيل الدخول ولتقويم Google، وعليه يتوقف كون ملفات تعريف الارتباط آمنة. اختياري ما دمت تجرب Mitra على localhost، ومطلوب [لتسجيل الدخول](sso.md)، ومستحسن [لتقويم Google](integrations/google.md) ولأي خادم عام. |
| `MITRA_NAME` | *(Mitra، بلغة كل مستخدم)* | [الاسم](#name-your-instance) الظاهر في الشريط الجانبي وعلامة تبويب المتصفح. ويبقى اسم [التطبيق المثبت](install-app.md) «Mitra». |
| `MITRA_PORT` | `3000` | المنفذ الذي يستمع إليه الخادم. مع Docker، غيّر جهة المضيف في ربط المنافذ بدلًا من ذلك؛ ولا تضبط هذا المتغير إلا إذا كان على العملية نفسها أن تستمع إلى منفذ آخر. ويتبعه فحص السلامة المدمج. |
| `MITRA_LOG_LEVEL` | `info` | [مقدار ما يسجله Mitra](logging.md): `error` أو `warn` أو `info` أو `debug` أو `trace`. يشمل كل مستوى كل ما هو أهدأ منه. |
| `MITRA_UPDATE_CHECK` | *(مفعّل)* | اضبطه على `off` (أو `false` أو `0` أو `no`) لإيقاف [التحقق من التحديثات](updates.md). |
| `MITRA_MCP` | *(مفعّل)* | اضبطه على `off` (أو `false` أو `0` أو `no`) لإغلاق [العنوان الذي تتصل به أدوات الذكاء الاصطناعي](ai-connectors.md). |

### التذكيرات

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | جهة الاتصال التي تراها خدمات الإشعارات الفورية [لتذكيرات](reminders.md) خادمك، وعادةً ما تكون عنوان `mailto:`. لا يراها أحد ممن يستخدمون Mitra. تُنشأ مفاتيح التوقيع تلقائيًا، فلا شيء آخر يلزم ضبطه. |

### الموقع

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | [خدمة الترميز الجغرافي Photon](location.md) التي يعتمد عليها حقل الموقع. وجّهه إلى نسخة Photon خاصة بك بدلًا من النسخة العامة التي تقدمها komoot. |

### المرفقات

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | أكبر حجم لملف يمكن [إرفاقه](attachments.md) بعنصر، بالبايت أو مع اللاحقة `k` أو `M` أو `G`. اضبطه على `0` لإيقاف إضافة الملفات. |
| `MITRA_FILE_QUOTA` | *(غير مضبوط)* | المساحة الإجمالية التي يمكن لكل مستخدم شغلها بالملفات المرفقة، وتُكتب بالطريقة نفسها. بدونه لا يوجد حد. |

### تقويم Google

اضبط المتغيرين كليهما ليتمكن المستخدمون من ربط [تقويم Google](integrations/google.md). وضبط المعرف وحده يمنع Mitra من البدء.

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(غير مضبوط)* | معرف عميل OAuth من وحدة تحكم Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(غير مضبوط)* | سر عميل OAuth. مطلوب كلما ضُبط `MITRA_GOOGLE_CLIENT_ID`. |

### تسجيل الدخول الموحد

ضبط `MITRA_OIDC_ISSUER` يفعّل [تسجيل الدخول](sso.md). وإن غابت المتغيرات التي يحتاجها، يرفض Mitra البدء.

| المتغير | القيمة الافتراضية | الوصف |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(غير مضبوط)* | عنوان URL للجهة المُصدِرة لدى مزوّد OIDC. يتطلب `MITRA_OIDC_CLIENT_ID` و`MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(غير مضبوط)* | معرف العميل المسجل لدى مزوّدك. |
| `MITRA_OIDC_CLIENT_SECRET` | *(غير مضبوط)* | سر العميل. لا تضبطه للعميل العام؛ فـ Mitra يستخدم PKCE دائمًا. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | النطاقات التي يطلبها Mitra، مفصولة بمسافات. `openid` مطلوب؛ و`profile` و`email` يعطيان Mitra اسم كل مستخدم وبريده الإلكتروني. |

### ما يضبطه البناء

لا تضبط هذه المتغيرات على الخادم. يضبطها البناء أو الصورة، أو هي مخصصة للعمل على تطوير Mitra نفسه.

| المتغير | يضبطه | الوصف |
| --- | --- | --- |
| `MITRA_VERSION` | البناء | الإصدار المضمّن في الصورة. |
| `MITRA_COMMIT` | البناء | الإيداع المضمّن في الصورة. |
| `MITRA_DEV` | التطوير | يتيح تكامل **عرض تجريبي**، وهو مجموعة من التقويمات التجريبية، أثناء العمل على Mitra. |
| `NODE_ENV` | الصورة | `production` في صورة الحاوية. |

### مثال

خادم مع تسجيل الدخول وتقويم Google وخدمة ترميز جغرافي خاصة به:

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
