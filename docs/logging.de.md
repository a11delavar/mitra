---
title: Protokollierung
description: Lege mit MITRA_LOG_LEVEL fest, wie viel Mitra protokolliert, und welche Stufe bei welchem Problem hilft.
---

Mitra schreibt sein Log auf die Standardausgabe, sodass `docker compose logs` alles zeigt:

```bash
docker compose logs -f mitra
```

Ein gesunder Server ist absichtlich still: Standardmäßig protokolliert er nur, was zählt. Dreh die Stufe hoch, während du etwas aufspürst, und wieder herunter, wenn du fertig bist.

## Die Stufe festlegen

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Jede Stufe enthält alles, was leiser ist:

| `MITRA_LOG_LEVEL` | Was du bekommst |
| --- | --- |
| `error` | Nur Fehler. |
| `warn` | Auch Probleme, die Mitra umgangen hat, etwa eine Erinnerung, die nicht zugestellt werden konnte, ein Geocoder, der nicht geantwortet hat, oder ein Anmeldeanbieter, den es nicht erreichen konnte. |
| `info` *(Standard)* | Auch das, was im Alltag zählt: Start, Anmeldungen, verbundene Konten, von Anbietern synchronisierte Änderungen und gesendete Erinnerungen. |
| `debug` | Auch jede Anfrage mit Status und Dauer, jede Synchronisierung, wann das Synchronisieren schneller oder langsamer wird, wenn Leute Mitra öffnen und schließen, Sitzungen, Eintragsänderungen und die Kommunikation mit CalDAV-Servern. |
| `trace` | Auch jede Datenbankabfrage und die rohen Kalenderdaten. Das ist sehr viel. |

Mitra protokolliert beim Start die Stufe, auf der es läuft.

> [!NOTE]
> Passwörter, Tokens und andere Geheimnisse werden auf keiner Stufe protokolliert. `debug` und `trace` können aber Eintragstitel und Kalenderdaten zeigen, sieh also ein Log durch, bevor du es weitergibst.

## Welche Stufe wofür

- Wenn ein Kalender nicht synchronisiert, zeigt `debug` jede Synchronisierung und die Anfragen an CalDAV und Notion.
- Wenn Erinnerungen nicht ankommen, protokolliert `info` bereits jede Erinnerung beim Versand, und `debug` ergänzt jeden Zustellversuch und verworfene Geräte.
- Wenn du eine Fehlerseite siehst, hat `error` sie samt Stack-Trace, und das Standard-`info` enthält sie.
- Wenn du genau sehen musst, was ein Anbieter gesendet hat, ergänzt `trace` die Rohdaten und die Datenbankabfragen. Lass es nur kurz an.
