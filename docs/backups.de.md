---
title: Backups
description: Alles, was Mitra speichert, liegt in einem Ordner. Sichere ihn mit jedem Werkzeug, das du schon nutzt.
---

Mitra hält alles in einem Ordner: `/app/data` im Container, auf dem Host `~/mitra`, wenn du den [Ersten Schritten](README.md#install-mitra) gefolgt bist. Sichere diesen Ordner, und du hast die ganze Instanz gesichert. Es gibt keinen Datenbankserver zu dumpen und keine Konfigurationsdateien herauszusuchen.

> [!CAUTION]
> Für einen Teil dessen, was du in Mitra aufbewahrst, ist dieser Ordner die einzige Kopie. Jeder Eintrag in einem [Mitra-Kalender](integrations/mitra.md) liegt nur hier. Ebenso deine Konten und Anmeldesitzungen, die Zugangsdaten verbundener Konten, deine Einstellungen, Farben, Reihenfolge und Namen deiner Kalender, deine [Verfügbarkeit](availability.md), die Reihenfolge deiner Aufgaben, einige Verknüpfungen zwischen Einträgen und der Schlüssel, von dem die [Erinnerungen](reminders.md) deiner Geräte abhängen. Wenn du den Ordner verlierst, kann dir ein Anbieter seine Termine und Aufgaben zurückgeben, aber sonst nichts.

## Sichern

Richte dein vorhandenes Werkzeug auf den Ordner: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, einen Dateisystem- oder VM-Snapshot oder ein einfaches Archiv.

Die sicherste Kopie entsteht, während Mitra gestoppt ist:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Wenn du nicht stoppen kannst, ist das Kopieren des Ordners bei laufendem Mitra meist in Ordnung, denn SQLite kommt gut damit zurecht. Ein Dateisystem- oder VM-Snapshot liefert dir eine konsistente Kopie, ohne etwas zu stoppen.

## Wiederherstellen

Stopp Mitra, spiel den Ordner zurück und starte es wieder:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Stell den Ordner als Ganzes wieder her. Seine Dateien gehören zusammen, und Dateien von verschiedenen Tagen zu mischen kann die Instanz beschädigen. Ein Backup einer älteren Version lässt sich problemlos auf ein neueres Image zurückspielen, da Mitra seine Datenbank beim Start aktualisiert.

## Was ein Backup nicht abdeckt

Termine und Aufgaben in verbundenen Konten, etwa einem [CalDAV](integrations/caldav.md)-Server, [Google Calendar](integrations/google.md) oder [Notion](integrations/notion.md), liegen bei diesen Anbietern. Ein Backup enthält Mitras Kopie davon, und nach einer Wiederherstellung synchronisiert Mitra sie erneut.

Deine Umgebungsvariablen stehen in deiner `compose.yaml` oder `.env`-Datei, nicht im Datenordner. Bewahre sie ebenfalls sicher auf, in der Versionsverwaltung oder in deinem Secret Store.
