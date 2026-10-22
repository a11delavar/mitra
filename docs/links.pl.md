---
title: Linki
description: "Jak Mitra pokazuje linki we wpisie: spotkanie, do którego możesz dołączyć, notatkę do otwarcia, stronę do przeczytania."
---

Linki we wpisie pokazują, dokąd prowadzą, a nie swój surowy adres. Link do spotkania wyświetla się jako **Dołącz do spotkania (Google Meet)**, link do notatki w Obsidianie pokazuje nazwę notatki, a link do strony internetowej pokazuje witrynę i ścieżkę, na przykład `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="Edytor wpisu z wierszem linków nad opisem, w którym jest link do notatki w Obsidianie" />
</picture>

## W edytorze

Gdy opis wpisu zawiera linki, edytor zbiera je w wierszu **Linki** tuż nad opisem, więc możesz je otworzyć bez przeszukiwania tekstu. Kliknij link, aby go otworzyć: strona internetowa otwiera się w nowej karcie, a każdy inny link w swojej aplikacji. Gdy linki zajmują więcej niż dwa wiersze, można je przewijać.

Wiersz niczego nie przechowuje: pokazuje tylko to, co zawiera opis. Aby dodać lub usunąć link, edytuj opis, a wiersz się dostosuje. Każda inna aplikacja kalendarza, której używasz, widzi te same linki w opisie.

## W opisie

Linki w opisie zaczynają się małą ikoną, która pokazuje, co otwierają. Sam adres, na przykład wklejony z przeglądarki, jest skracany do witryny i ścieżki. Link opisany twoimi własnymi słowami zachowuje te słowa.

Mitra rozpoznaje też linki do aplikacji, takie jak `obsidian://open?vault=…`, które większość aplikacji kalendarza zostawia jako zwykły tekst. Linki, które uruchamiałyby kod, takie jak `javascript:`, są wyświetlane jako zwykły tekst i nigdy jako linki.

## Linki do spotkań i aplikacji w lokalizacji

Lokalizacja, która jest pojedynczym linkiem, jest traktowana jak link, a nie jak miejsce. Link do spotkania w Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime lub Skype wyświetla się jako **Dołącz do spotkania** z nazwą usługi w edytorze, w kalendarzu i w tabeli. Nie ma przy nim przycisku mapy. Kliknij obok linku, aby go edytować.

## Linki do aplikacji

Mitra rozpoznaje po adresie, do której aplikacji należy link. Zna te aplikacje: Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor i Spotify. Każdy link do aplikacji, znanej lub nie, ma tę samą ikonę otwierania w innej aplikacji.

> [!NOTE]
> Strona internetowa nie może sprawdzić, czy aplikacja jest zainstalowana. Gdy po raz pierwszy otworzysz link do aplikacji, przeglądarka zapyta, czy ją otworzyć. Jeśli aplikacji nie ma, nic się nie stanie.
