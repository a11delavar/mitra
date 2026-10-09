---
title: Single Sign-on
description: Teile einen Mitra-Server mit Familie oder Team. Alle melden sich über einen OpenID-Connect-Anbieter mit einem Konto an, das sie schon haben.
---

Von Haus aus ist Mitra für eine Person gedacht und hat keine Anmeldung, was in Ordnung ist, solange nur du darauf zugreifen kannst. Um einen Server mit Familie oder Team zu teilen, verbinde ihn mit einem OpenID-Connect-Anbieter (OIDC). Alle melden sich dann mit einem Konto an, das sie schon haben, und bekommen eigene Kalender, die sonst niemand sieht.

Mitra funktioniert mit jedem Standard-OIDC-Anbieter. Genutzt wird es unter anderem mit Pocket ID, Authelia, Authentik, Keycloak und Google.

> [!CAUTION]
> Wenn du die Anmeldung einschaltest, bekommt jede Person ein neues, leeres Konto, auch du. Alles, was du eingerichtet hast, als Mitra noch für eine Person war, bleibt beim alten Konto und wird nicht mitgenommen: deine verbundenen Konten, deine Einstellungen und jeder Eintrag in deinen [Mitra-Kalendern](integrations/mitra.md). Verbundene Konten sind schnell wieder hinzugefügt, aber Einträge in Mitra-Kalendern können dir nicht folgen. Schalte die Anmeldung ein, bevor du anfängst, Mitra zu füllen, oder verschiebe diese Einträge zuerst in einen verbundenen Kalender (**Einträge verschieben nach…** im Menü **⋯** des Kalenders) und verbinde dieses Konto danach erneut.

## Anmeldung einschalten

Setz die OIDC-Variablen am Container:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

Registriere bei deinem Anbieter `MITRA_URL` gefolgt von `/auth/callback` als Weiterleitungsadresse:

```text
https://mitra.example.com/auth/callback
```

Mehr braucht der Anbieter nicht. Starte Mitra mit `docker compose up -d` neu, und es fordert alle zur Anmeldung auf.

Das Setzen von `MITRA_OIDC_ISSUER` schaltet die Anmeldung ein, und dazu brauchst du auch `MITRA_OIDC_CLIENT_ID` und `MITRA_URL`. Fehlt eine davon, weigert sich Mitra zu starten. Stillschweigend ohne Anmeldung zu laufen wäre viel schlimmer.

## Client-Secret und Scopes

Wenn du bei deinem Anbieter ein Client-Secret registriert hast, setz `MITRA_OIDC_CLIENT_SECRET`. Wenn du einen öffentlichen Client registriert hast, lass es weg; das wird voll unterstützt, da Mitra immer PKCE nutzt.

Mitra fordert die Scopes `openid profile email` an. `openid` ist erforderlich, und die anderen beiden geben Mitra Namen und E-Mail-Adresse jeder Person. Ändere sie mit `MITRA_OIDC_SCOPES` nur, wenn dein Anbieter etwas anderes braucht.

## Wer sich anmelden darf

Wen dein Anbieter durchlässt, bekommt beim ersten Anmelden ein Mitra-Konto. In Mitra gibt es keine Benutzerliste zu pflegen. Entscheide also bei deinem Anbieter, wer sich anmelden darf, per Gruppe, App-Zuweisung oder wie er den Zugriff sonst regelt. Name und E-Mail-Adresse jeder Person werden bei jeder Anmeldung vom Anbieter aktualisiert.

## Wie die Anmeldung funktioniert

Die Anmeldung selbst läuft auf dem Server ab (der Authorization-Code-Flow mit PKCE). Dein Browser bekommt nur ein Cookie, und in seinem Speicher werden keine Tokens abgelegt, sodass ein bösartiges Skript auf der Seite nichts zu stehlen hat.

Eine Sitzung dauert 30 Tage ab dem letzten Mal, dass du Mitra benutzt hast. Das Cookie wird als sicher markiert, wenn `MITRA_URL` mit `https://` beginnt, und ein `http://`-Issuer ist erlaubt für Anbieter in deinem eigenen Netzwerk ohne HTTPS. Wenn dein Anbieter es unterstützt, meldet dich das Abmelden von Mitra auch dort ab.

## Fehlerbehebung

- **Mitra startet nicht und nennt eine fehlende Variable.** Wenn `MITRA_OIDC_ISSUER` gesetzt ist, müssen auch `MITRA_OIDC_CLIENT_ID` und `MITRA_URL` gesetzt sein.
- **Der Anbieter beanstandet die Weiterleitungsadresse.** Sie muss genau `MITRA_URL` gefolgt von `/auth/callback` sein.
- **Das Log sagt, die Discovery sei fehlgeschlagen.** Mitra schlägt deinen Anbieter bei der ersten Anmeldung nach und versucht es bei der nächsten erneut, ein Anbieter, der nach Mitra startet, regelt sich also von selbst. Wenn es weiter scheitert, prüf die Issuer-URL und ob Mitra sie erreichen kann, mit dem [Log-Level](logging.md) auf `debug`.
- **Meine Kalender sind nach dem Einschalten der Anmeldung weg.** Das ist zu erwarten: Alle fangen mit einem neuen Konto an. Verbinde deine Konten erneut.
