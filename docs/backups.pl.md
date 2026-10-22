---
title: Kopie zapasowe
description: Wszystko, co przechowuje Mitra, znajduje się w jednym folderze. Twórz jego kopię zapasową narzędziem, którego już używasz.
---

Mitra przechowuje wszystko w jednym folderze: `/app/data` w kontenerze, czyli `~/mitra` na hoście, jeśli instalujesz według strony [Pierwsze kroki](README.md#install-mitra). Kopia zapasowa tego folderu to kopia zapasowa całej instancji. Nie trzeba zrzucać danych z serwera bazy danych ani wybierać plików konfiguracyjnych.

> [!CAUTION]
> Dla części tego, co przechowujesz w aplikacji Mitra, ten folder jest jedyną kopią. Każdy wpis w [kalendarzu Mitra](integrations/mitra.md) znajduje się tutaj i nigdzie indziej. To samo dotyczy kont użytkowników i sesji logowania, danych logowania połączonych kont, ustawień, kolorów, kolejności i nazw kalendarzy, twojej [dostępności](availability.md), kolejności zadań, [plików załączonych](attachments.md) do wpisów, niektórych powiązań między wpisami oraz klucza, od którego zależą [przypomnienia](reminders.md) na twoich urządzeniach. Jeśli stracisz ten folder, dostawca może zwrócić ci swoje wydarzenia i zadania, ale nic poza tym.

## Tworzenie kopii zapasowej

Skieruj na ten folder narzędzie, którego już używasz: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, migawkę systemu plików lub maszyny wirtualnej albo zwykłe archiwum.

Najbezpieczniejsza jest kopia wykonana przy zatrzymanej aplikacji Mitra:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Jeśli nie możesz jej zatrzymać, kopiowanie folderu w trakcie działania aplikacji Mitra zwykle nie sprawia problemów, bo SQLite dobrze to znosi. Migawka systemu plików lub maszyny wirtualnej daje spójną kopię bez zatrzymywania czegokolwiek.

## Przywracanie

Zatrzymaj aplikację Mitra, przywróć folder i uruchom ją ponownie:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Przywracaj folder w całości. Jego pliki są ze sobą powiązane, a mieszanie plików z różnych dni może uszkodzić instancję. Kopię zapasową ze starszej wersji można bez problemu przywrócić w nowszym obrazie, ponieważ Mitra aktualizuje bazę danych przy uruchomieniu.

## Czego kopia zapasowa nie obejmuje

Wydarzenia i zadania z połączonych kont, takich jak serwer [CalDAV](integrations/caldav.md), [Kalendarz Google](integrations/google.md) czy [Notion](integrations/notion.md), są przechowywane u tych dostawców. Kopia zapasowa zawiera kopię tych danych w aplikacji Mitra, a po przywróceniu Mitra zsynchronizuje je ponownie.

Zmienne środowiskowe znajdują się w pliku `compose.yaml` lub `.env`, a nie w folderze danych. Je również przechowuj w bezpiecznym miejscu, w systemie kontroli wersji lub w magazynie sekretów.
