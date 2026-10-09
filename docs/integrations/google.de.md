---
title: Google Calendar
description: Richte die Google-Anmeldung einmal für deinen Mitra-Server ein, verbinde dann Google-Konten in der App und synchronisiere ihre Kalender in beide Richtungen.
---

Mitra verbindet sich mit Google Calendar über CalDAV, wie mit jedem Kalenderserver. Der Unterschied ist die Anmeldung: Google nimmt kein Passwort, sondern bittet dich, den Zugriff auf seiner eigenen Seite zu erteilen. Dafür muss Google deinen Mitra-Server kennen, also registriert, wer den Server betreibt, ihn einmal bei Google und gibt Mitra die Client-ID und das Secret, die Google ausstellt.

Danach verbindet jeder, der Mitra nutzt, sein Google-Konto in der App, jeweils mit eigener Freigabe. Die Einrichtung besteht aus drei Schritten:

1. [Mitra bei Google registrieren](#register-mitra-with-google).
2. [Mitra die Client-ID und das Secret geben](#give-mitra-the-client-id-and-secret).
3. [Ein Konto verbinden](#connect-an-account).

Die ersten beiden machst du einmal pro Mitra-Server.

## Mitra bei Google registrieren

1. Lege in der [Google Cloud console](https://console.cloud.google.com) ein Projekt an und aktiviere unter **APIs & Services** die **CalDAV API**.
2. Richte den **OAuth consent screen** ein. Füge dich und alle anderen, die ein Konto verbinden werden, entweder als **test user** hinzu, oder veröffentliche die App.
3. Lege einen **OAuth client** vom Typ **Web application** an. Als **authorized redirect URI** gibst du die Adresse deines Mitra-Servers gefolgt von `/api/integrations/google/callback` an:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Kopiere die **client ID** und das **client secret**, die Google dir anzeigt.

> [!CAUTION]
> Solange sich der Consent Screen im Test befindet, beendet Google jede Freigabe nach 7 Tagen, und alle müssen ihr Konto jede Woche neu verbinden. Veröffentliche die App, um Freigaben dauerhaft zu behalten.

## Mitra die Client-ID und das Secret geben

Setze sie als Umgebungsvariablen, zusammen mit `MITRA_URL`, der Adresse deines Servers:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Starte Mitra dann neu:

```bash
docker compose up -d
```

Setze beide Variablen oder keine. Mitra startet nicht mit einer Client-ID ohne Secret, damit eine halbfertige Einrichtung nicht unbemerkt bleibt.

`MITRA_URL` muss zur Adresse in deiner Redirect-URI passen. Ohne sie nutzt Mitra die Adresse, unter der du es geöffnet hast, was zum Ausprobieren auf `localhost` reicht. Google akzeptiert für alles außer `localhost` nur `https://`-Redirect-Adressen, ein echter Server braucht also [HTTPS](../configuration.md#put-it-behind-https) und `MITRA_URL`. Alle Variablen stehen in der [Konfiguration](../configuration.md#all-variables).

## Ein Konto verbinden

1. Wähle unten in der Seitenleiste **Integration hinzufügen** und dann **Google Kalender**.
2. Drück auf **Mit Google fortfahren**. Google bittet dich, ein Konto zu wählen und Mitra zu erlauben, deine Kalender zu sehen und zu ändern.
3. Zurück in Mitra werden die Kalender des Kontos aufgelistet, alle eingeschaltet. Schalte die aus, die du nicht willst, und drück dann auf **Speichern**.

Wenn du dasselbe Google-Konto erneut verbindest, wird seine Freigabe erneuert, statt es ein zweites Mal hinzuzufügen.

Google begrenzt, wie oft Apps es aufrufen dürfen, deshalb synchronisiert Mitra Google-Konten etwa einmal pro Minute (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)).

## Mit dir geteilte Kalender

Kalender, die dir gehören, erscheinen, sobald du verbindest. Kalender, die andere mit dir geteilt haben, etwa ein Teamkalender oder der eines Kollegen, erreichen andere Apps erst, wenn du es in deinen Google-Einstellungen erlaubst:

1. Öffne, in Google angemeldet, [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Hake unter **Shared Calendars** jeden Kalender an, den du in Mitra haben willst, und drück auf **Save**.
3. Öffne in Mitra das **⋯**-Menü des Kontos in der Seitenleiste, wähle **Bearbeiten** und drück auf **Aktualisieren**.
4. Schalte die Kalender ein, die erscheinen, und drück dann auf **Speichern**.

Ein Kalender, der mit dir als **See all event details** geteilt wurde, ist in Mitra schreibgeschützt: Du siehst alles darin, kannst aber keine Termine hinzufügen, ändern oder löschen. Wenn der Besitzer dir später **Make changes to events** gibt, wird das Bearbeiten bei der nächsten Synchronisierung eingeschaltet. Siehe [Schreibgeschützte Kalender](../calendars.md#read-only-calendars).

## Was synchronisiert wird

Alles wird synchronisiert wie bei [CalDAV](caldav.md#what-syncs), außer den Beziehungen zwischen Einträgen. Google verwirft sie aus seiner Kopie eines Termins, deshalb bietet Mitra sie in Google-Kalendern nicht an.

[Verfügbarkeit](../availability.md), die du in einem Google-Kalender als beschäftigt markierst, wird diesem Kalender als Beschäftigt-Termin hinzugefügt, sodass andere die Zeit als belegt sehen. Das funktioniert wie bei [CalDAV](caldav.md#busy-availability) beschrieben.

## Dein Google-Token

Das Token, das Google ausstellt, verlässt den Server nie. Dein Browser durchläuft nur Googles Seite, um den Zugriff zu erteilen. Mitra bewahrt das Token beim Konto auf und holt sich damit bei jeder Synchronisierung kurzlebigen Zugriff.

## Ein Konto trennen

Wähle **Löschen** im **⋯**-Menü des Kontos, um es und sein Token aus Mitra zu entfernen. Um Mitras Zugriff auch auf Googles Seite zu entziehen, entferne Mitra aus den [Verbindungen zu Drittanbietern deines Google-Kontos](https://myaccount.google.com/permissions). Nur das zu tun, beendet ebenfalls die Synchronisierung: Das Konto bleibt in Mitra, aber jede Synchronisierung schlägt fehl, bis du es erneut verbindest.

## Fehlerbehebung

- Wenn die Wahl von **Google Kalender** statt der Schaltfläche **Mit Google fortfahren** einen Hinweis zeigt, dass es auf diesem Server nicht eingerichtet ist, sind `MITRA_GOOGLE_CLIENT_ID` und `MITRA_GOOGLE_CLIENT_SECRET` nicht gesetzt, oder Mitra wurde seit dem Setzen nicht neu gestartet.
- Wenn Google mit `redirect_uri_mismatch` antwortet, passt die Redirect-URI in der Google Cloud console nicht zu `MITRA_URL` gefolgt von `/api/integrations/google/callback`. Sie muss genau übereinstimmen, mit `https://` und ohne abschließenden Schrägstrich.
- Wenn Konten nach 7 Tagen nicht mehr synchronisieren, befindet sich dein Consent Screen noch im Test. Veröffentliche die App und verbinde die Konten dann erneut.
