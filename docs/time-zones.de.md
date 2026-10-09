---
title: Zeitzonen
description: Wie Mitra die eigene Zeitzone eines Eintrags zeigt und wie du die Stunden anderer Zeitzonen zur Wochenansicht hinzufügst.
---

Mitra zeigt Zeiten in deiner Zeitzone, der, auf die dein Gerät eingestellt ist. Wenn du reist und dein Gerät die Zone wechselt, folgt Mitra. Im Editor heißt diese Zone die **primäre** Zeitzone.

Ein Eintrag kann außerdem eine eigene Zeitzone haben, etwa ein Flug, der um 9:00 Uhr in New York startet. Und die Wochenansicht kann die Stunden anderer Zeitzonen neben deinen zeigen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="Der Editor eines neuen Eintrags mit der Zeitzone GMT+4 Dubai, der 11:00 Uhr in Dubai zeigt, während der Eintrag in der Berliner Woche dahinter um 9:00 Uhr liegt" />
</picture>

## Die Zeitzone eines Eintrags

Jeder Eintrag mit Uhrzeiten hat eine Zeitzone. Einträge, die du erstellst, übernehmen deine, und Einträge aus anderen Apps behalten die Zone, in der sie erstellt wurden.

Öffne einen Eintrag, um seine Zone in der Zeile mit dem Globus unter seinen Daten zu sehen, geschrieben als Abweichung und Stadt, etwa „GMT-4 New York“. Ganztägige Einträge haben keine Zeitzone und keine solche Zeile, weil sie für alle dieselben Tage umfassen.

### Die Zeitzone eines Eintrags ändern

Klick auf die Zone und wähle eine andere. Tipp eine Stadt, den Namen einer Zone oder eine Abweichung, um sie zu finden. Deine eigene Zone steht oben in der Liste, markiert mit **Primär**.

Der Eintrag behält seine Uhrzeiten in der neuen Zone: Ein Meeting um 9:00 Uhr in Berlin wird zu einem Meeting um 9:00 Uhr in New York. Wenn nur die Zone falsch war und das Meeting selbst sich nicht verschoben hat, ändere danach seine Zeiten.

### Deine Zeit oder die des Eintrags

Weicht die Zone eines Eintrags von deiner ab, zeigt der Editor seine Zeiten in deiner Zone, ein Meeting um 9:00 Uhr in New York steht also als 15:00 Uhr da, wenn du in Berlin bist. Eine Schaltfläche neben der Zone wechselt zur Zeit des Eintrags und zurück. Sie zeigt ein Haus, solange du deine Zeit siehst, und einen Globus, solange du die Zeit des Eintrags siehst, und wenn du darauf zeigst, steht dort, welche du gerade ansiehst.

Du kannst die Zeiten auf beide Arten bearbeiten. Um die Zone selbst zu ändern, wechsle zuerst zur Zeit des Eintrags.

### Wanduhrzeiten

Manche Einträge kommen ohne Zeitzone aus anderen Apps und zeigen **Wanduhrzeit (keine Zeitzone)**. Ihre Zeiten gehören zu keinem Ort: Ein Wecker um 7:00 Uhr ist überall um 7:00 Uhr gemeint, und der Editor zeigt ihn in jeder Zeitzone um 7:00 Uhr. Seine Erinnerungen gehen auf jedem Gerät zu dieser Uhrzeit los.

Wählst du für so einen Eintrag eine Zone, bekommt er diese Zone und behält seine Uhrzeiten. Er kann nicht wieder zu einem Eintrag mit Wanduhrzeit werden.

### Welche Kalender das unterstützen

- **In Mitra gespeicherte Kalender**, [Kalenderserver](integrations/caldav.md) und [Google Calendar](integrations/google.md) behalten die Zeitzone jedes Eintrags, und andere Apps sehen sie.
- **[Notion](integrations/notion.md)** kennt keine Zeitzonen. Seine Zeiten erscheinen in deiner, und der Editor hat keine Zeile für die Zeitzone.
- **[Tempo](integrations/tempo.md)** liest Arbeitszeiten in der Zeitzone deines Jira-Profils, und der Editor hat ebenfalls keine Zeile für die Zeitzone.
- **[Abonnements](integrations/subscriptions.md)** sind schreibgeschützt: Du kannst die Zone eines Eintrags sehen und zwischen den beiden Zeiten wechseln, aber sie nicht ändern.

## Zeitzonen in der Wochenansicht

Die [Wochenansicht](views/week.md) kann die Stunden anderer Zeitzonen in Spalten neben deinen zeigen, so siehst du zu jeder Stunde deines Tages, wie spät es dort ist.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="Die Wochenansicht mit einer Spalte EDT mit New Yorker Stunden neben der Spalte GMT+2, sodass 07:00 Uhr in Berlin 01:00 Uhr in New York entspricht" />
</picture>

### Der Woche eine Zeitzone hinzufügen

Zeig auf den oberen Rand der Zeitspalte und drück **＋** (**Zeitzone hinzufügen**), dann wähle eine Zone. Ihre Spalte erscheint neben deiner, und deine eigene Zone bleibt die Spalte neben den Tagen.

Jede Spalte hat einen Kurznamen als Überschrift, etwa „PDT“ oder „GMT+2“. Zeig darauf, um den vollen Namen zu sehen.

### Eine Zeitzone umbenennen oder entfernen

Klick auf den Namen einer Zone und wähle **Umbenennen**, um ihr eine eigene Bezeichnung zu geben, etwa „NYC“, oder **Entfernen**, um ihre Spalte wegzunehmen. Um zum automatischen Namen zurückzukehren, benenne sie in nichts um.

Deine eigene Zone lässt sich umbenennen, aber nicht entfernen.

### Die zusätzlichen Spalten einklappen

Die zusätzlichen Spalten nehmen den Tagen Platz weg. Um sie auszublenden, zeig auf den oberen Rand der Zeitspalte und drück den Pfeil unter dem **＋**. Drück ihn noch einmal, um sie wieder einzublenden. Du kannst die Zeitspalte auch zu den Tagen hin ziehen, um sie zu öffnen, und zurück, um sie zu schließen, so geht es auf einem Touchscreen.

Auf einem schmalen Bildschirm sind die Spalten zunächst eingeklappt, bis du sie selbst öffnest oder schließt. Eine Zone hinzuzufügen holt sie immer hervor.

### Auf allen deinen Geräten

Die Zonen, die du hinzufügst, und ihre Namen gehören zu deinem Konto, sie erscheinen also auf jedem Gerät, das du nutzt. Der Name, den du deiner eigenen Zone gibst, und ob die Spalten eingeklappt sind, bleiben auf jedem Gerät für sich, da jedes Gerät in einer anderen Zone sein kann.
