---
title: Zeitzonen
description: Wie Mitra die eigene Zeitzone eines Eintrags zeigt und wie du die Stunden anderer Zeitzonen zur Wochenansicht hinzufügst.
---

Mitra zeigt Zeiten in deiner Zeitzone, der, auf die dein Gerät eingestellt ist. Wenn du reist und dein Gerät die Zone wechselt, folgt Mitra. Im Editor heißt diese Zone die **aktuelle** Zeitzone. Dein **Zuhause** ist die Zone, in die du gehörst, und bleibt auf Reisen neben der aktuellen stehen.

Ein Eintrag kann außerdem eine eigene Zeitzone haben, etwa ein Flug, der um 9:00 Uhr in New York startet. Und die Wochenansicht kann die Stunden anderer Zeitzonen neben deinen zeigen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="Der Editor eines neuen Eintrags mit der Zeitzone GMT+1 Lissabon, der 11:00 Uhr in Lissabon zeigt, während der Eintrag in der Berliner Woche dahinter um 12:00 Uhr liegt" />
</picture>

## Die Zeitzone eines Eintrags

Jeder Eintrag mit Uhrzeiten hat eine Zeitzone. Einträge, die du erstellst, übernehmen deine, und Einträge aus anderen Apps behalten die Zone, in der sie erstellt wurden.

Öffne einen Eintrag, um seine Zone in der Zeile mit dem Globus unter seinen Daten zu sehen, geschrieben als Abweichung und Stadt, etwa „GMT-4 New York“. Ganztägige Einträge haben keine Zeitzone und keine solche Zeile, weil sie für alle dieselben Tage umfassen.

### Die Zeitzone eines Eintrags ändern

Klick auf die Zone und wähle eine andere. Die Liste beginnt mit den Zonen des Landes, für das deine [Sprache](settings.md#general) eingestellt ist, dann folgen alle Zonen, und dein Zuhause trägt dort, wo es steht, ein Haus, deine aktuelle Zone eine Stecknadel, solange du unterwegs bist. Zonen, die das ganze Jahr denselben Namen und dieselbe Uhrzeit haben, teilen sich eine Zeile, die für eine ihrer Städte steht, die deiner eigenen Zone oder deines Landes, wenn es eine hat, etwa Mitteleuropäische Zeit für Berlin in Deutschland. Der Pfeil am Ende der Zeile klappt die anderen Städte auf, etwa Paris und Amsterdam, und eine Suche klappt die Zeilen auf, in denen sie fündig wird. Tipp eine Stadt, ein Land, den Namen einer Zone oder eine Abweichung, um eine zu finden.

Der Eintrag behält seine Uhrzeiten in der neuen Zone: Ein Meeting um 9:00 Uhr in Berlin wird zu einem Meeting um 9:00 Uhr in New York. Wenn nur die Zone falsch war und das Meeting selbst sich nicht verschoben hat, ändere danach seine Zeiten.

### Deine Zeit oder die des Eintrags

Weicht die Zone eines Eintrags von deiner ab, zeigt der Editor seine Zeiten in deiner Zone, ein Meeting um 9:00 Uhr in New York steht also als 15:00 Uhr da, wenn du in Berlin bist. Eine Schaltfläche neben der Zone wechselt zur Zeit des Eintrags und zurück. Sie zeigt eine Stecknadel, solange du deine Zeit siehst, und einen Globus, solange du die Zeit des Eintrags siehst, und wenn du darauf zeigst, steht dort, welche du gerade ansiehst.

Du kannst die Zeiten auf beide Arten bearbeiten. Um die Zone selbst zu ändern, wechsle zuerst zur Zeit des Eintrags.

### Überall dieselbe Uhrzeit

Manche Einträge kommen ohne Zeitzone aus anderen Apps und zeigen **Überall dieselbe Uhrzeit**. Ihre Zeiten gehören zu keinem Ort: Ein Wecker um 7:00 Uhr ist überall um 7:00 Uhr gemeint, und der Editor zeigt ihn in jeder Zeitzone um 7:00 Uhr. Seine Erinnerungen gehen auf jedem Gerät zu dieser Uhrzeit los.

Wählst du für so einen Eintrag eine Zone, bekommt er diese Zone und behält seine Uhrzeiten. In einem Kalender, der solche Zeiten behält, kann jeder Eintrag eine bekommen: Wähle oben in der Liste **Überall dieselbe Uhrzeit**, und auch dann bleiben seine Uhrzeiten.

### Welche Kalender das unterstützen

- **In Mitra gespeicherte Kalender**, [Kalenderserver](integrations/caldav.md) und [Google Calendar](integrations/google.md) behalten die Zeitzone jedes Eintrags, und andere Apps sehen sie. Mitra und Kalenderserver behalten auch Zeiten, die überall dieselben sind; Google Calendar kennt keine, deshalb bekommt so ein Eintrag dort eine feste Zone.
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

Zeig auf den oberen Rand der Zeitspalte und drück **＋** (**Zeitzone hinzufügen**). Die Liste hakt die Zonen ab, die du schon hast, dein Zuhause trägt ein Haus und deine aktuelle Zone eine Stecknadel, solange du unterwegs bist. Wähl eine Zone, um ihre Spalte hinzuzufügen, oder eine abgehakte, um ihre Spalte wegzunehmen. Die Liste bleibt dafür offen. Deine aktuelle Zone bleibt die Spalte neben den Tagen, und dein Zuhause bleibt auch.

Jede Spalte hat einen Kurznamen als Überschrift: die Abkürzung, die man für die Zone verwendet, etwa „PDT“ oder „BST“, oder, wo keine üblich ist, ihren Ort, etwa „Iran“. Die Abkürzung folgt deiner [Sprache](settings.md#general): Berlin heißt auf Englisch „CEST“ und auf Deutsch „MESZ“, und wo deine Region für eine Zone keine kennt, leiht die Region der Zone ihre. Zeig auf einen Namen, um den vollen zu sehen.

### Eine Zeitzone umbenennen oder entfernen

Klick auf den Namen einer Zone und wähle **Umbenennen**, um ihr eine eigene Bezeichnung zu geben, etwa „Mama“, **Als Zuhause festlegen**, um sie zu deinem Zuhause zu machen, oder **Entfernen**, um ihre Spalte wegzunehmen. Um zum automatischen Namen zurückzukehren, benenne sie in nichts um.

Deine aktuelle Zone und dein Zuhause lassen sich umbenennen, aber nicht entfernen. Um dein Zuhause zu ersetzen, leg eine andere Zone als Zuhause fest.

### Die zusätzlichen Spalten einklappen

Die zusätzlichen Spalten nehmen den Tagen Platz weg. Um sie auszublenden, zeig auf den oberen Rand der Zeitspalte und drück den Pfeil unter dem **＋**. Drück ihn noch einmal, um sie wieder einzublenden. Du kannst die Zeitspalte auch zu den Tagen hin ziehen, um sie zu öffnen, und zurück, um sie zu schließen, so geht es auf einem Touchscreen.

Auf einem schmalen Bildschirm sind die Spalten zunächst eingeklappt, bis du sie selbst öffnest oder schließt. Eine Zone hinzuzufügen holt sie immer hervor.

### Auf allen deinen Geräten

Dein Zuhause, die Zonen, die du hinzufügst, und jeder Name, den du einer gibst, gehören zu deinem Konto, sie erscheinen also auf jedem Gerät, das du nutzt. Ob die Spalten eingeklappt sind, bleibt auf jedem Gerät für sich.

Dein Zuhause ist die Zone des ersten Geräts, auf dem du Mitra öffnest. Auf Reisen wird die Zone, in der du bist, zur Spalte neben den Tagen, und dein Zuhause bleibt daneben, ohne dass etwas zu deiner Liste hinzukommt, zurück zu Hause ist es also wieder eine Spalte. Benennst du die Zone, in der du bist, bleibt sie auf deiner Liste. Ziehst du um, wähle bei der Zone, in der du jetzt lebst, **Als Zuhause festlegen**, und dein altes Zuhause bleibt als Spalte, bis du es entfernst.
