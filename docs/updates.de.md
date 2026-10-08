---
title: Updates
description: Wie Mitra dich über neue Versionen informiert, was diese Prüfung sendet, wie du sie ausschaltest und wie du aktualisierst.
---

Mitra sagt dir, wenn es eine neuere Version gibt als die, die du betreibst. Es aktualisiert sich nie selbst: Die neue Version zu ziehen liegt bei dir.

## Die Update-Anzeige

Wenn es etwas Neueres gibt, erscheint ein kleiner Punkt auf dem Logo in der Seitenleiste. Klick auf den Namen deiner Instanz, um **Über** zu öffnen. Der Dialog zeigt die Version und den Commit, die du betreibst, und verlinkt auf die Neuigkeiten. **Kopieren** dort kopiert die Versionsangaben, die ein Fehlerbericht braucht.

**Neuigkeiten** in der [Befehlspalette](shortcuts.md#command-palette) listet die Änderungen jeder Version auf. Nachdem dein Server aktualisiert wurde, bittet Mitra dich in jedem Tab, der von vorher offen war, **Neu laden, um das Update abzuschließen**.

Wenn du ein Release betreibst (`latest`, `0.6` oder eine genaue Version), verweist es auf das neueste Release. Wenn du das Image `dev` betreibst, verweist es auf die neuesten Commits auf `main` und sagt dir, wie weit sie voraus sind.

## Was die Prüfung sendet

Der Server, nie dein Browser, fragt mehrmals am Tag bei GitHub an, ob es etwas Neueres gibt. Die Anfrage enthält nichts über deine Instanz, was nicht jede Anfrage enthält: deine IP-Adresse und die laufende Version im User-Agent. Keine Telemetrie, keine Kennungen, keine Zähler.

Wenn der Server GitHub nicht erreicht, protokolliert er das einmal und schweigt danach.

Um die Prüfung ganz auszuschalten, setz `MITRA_UPDATE_CHECK` auf `off` (`false`, `0` und `no` gehen auch):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Ein Image-Tag wählen

Der Tag entscheidet, wie eifrig du zu neuen Versionen wechselst.

| Tag | Was du bekommst |
| --- | --- |
| `latest` | Das neueste Release. |
| `0.6` | Das neueste Release `0.6.x`: Fehlerbehebungen, aber keine neue Minor-Version. |
| `0.6.0` | Genau diese Version. |
| `dev` | Der neueste Commit auf `main`, um Dinge vor ihrer Veröffentlichung auszuprobieren. |

Bis 1.0 kann eine neue Minor-Version (0.6 auf 0.7) Dinge ändern, auf die du dich verlässt. Wenn du lieber selbst bestimmst, wann das passiert, nimm `0.6` und zieh weiter, wenn du bereit bist. Alle Tags stehen auf [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Mitra aktualisieren

Zieh das neue Image und erstelle den Container neu:

```bash
docker compose pull
docker compose up -d
```

Deine Daten liegen im eingebundenen Ordner und bleiben deshalb erhalten. Wenn die neue Version die Datenbank ändert, aktualisiert Mitra sie beim Start, und du musst nie selbst Hand anlegen. Werkzeuge wie [Watchtower](https://containrrr.dev/watchtower/) können das nach Zeitplan für dich erledigen.

Welche Version du bekommst, hängt von deinem [Image-Tag](#choose-an-image-tag) ab. Bevor du auf eine neue Minor-Version wechselst, lohnt sich ein Blick in die [Release Notes](https://github.com/a11delavar/mitra/releases).
