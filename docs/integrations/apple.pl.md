---
title: Kalendarz Apple
description: Połącz swoje kalendarze iCloud z aplikacją Mitra za pomocą hasła do aplikacji, bez żadnej konfiguracji na serwerze.
---

Mitra łączy się z twoimi kalendarzami iCloud przez CalDAV i synchronizuje ich wydarzenia w obie strony. Apple nie pozwala innym aplikacjom logować się twoim hasłem Apple, więc najpierw musisz utworzyć dla aplikacji Mitra hasło do aplikacji. Zajmuje to minutę, a na serwerze nie trzeba niczego konfigurować.

## Tworzenie hasła do aplikacji

1. Zaloguj się na stronie [appleid.apple.com](https://appleid.apple.com/).
2. W sekcji **Logowanie i bezpieczeństwo** wybierz **Hasła do aplikacji**.
3. Utwórz nowe hasło, nazwij je „Mitra”, aby później je rozpoznać, i skopiuj je.

Apple oferuje hasła do aplikacji dopiero wtedy, gdy na koncie jest włączone uwierzytelnianie dwupoziomowe.

## Łączenie konta

1. Wybierz **Dodaj integrację** na dole panelu bocznego, a następnie **Kalendarz Apple**.
2. W polu **Konto Apple** wpisz adres e-mail, którym logujesz się w Apple, a w polu **Hasło do aplikacji** hasło utworzone dla aplikacji Mitra.
3. Naciśnij **Połącz**. Mitra wyświetli listę twoich kalendarzy iCloud, wszystkie włączone.
4. Wyłącz te, których nie chcesz, a następnie naciśnij **Zapisz**.

Mitra zaimportuje pozostawione kalendarze i będzie je synchronizować co 10 sekund, dopóki masz ją otwartą (zobacz [jak działa synchronizacja](README.md#how-syncing-works)).

## Co jest synchronizowane

Wydarzenia są synchronizowane w obie strony, ze wszystkim, co obsługuje [CalDAV](caldav.md#what-syncs).

> [!NOTE]
> Z zadaniami jest inaczej. Zadania zapisane przez aplikację Mitra w kalendarzu iCloud są przechowywane w iCloud i mogą je odczytać inne aplikacje CalDAV, ale aplikacja Przypomnienia od Apple ich nie pokazuje. Przypomnienia przestały korzystać z CalDAV w iOS 13, a Apple nie daje aplikacjom takim jak Mitra żadnego innego dostępu.

[Dostępność](../availability.md) oznaczona w kalendarzu iCloud jako zajęta jest dodawana do tego kalendarza jako zajęte wydarzenia, więc ten czas jest widoczny jako zajęty na twoim iPhonie i dla każdego, kto cię zaprasza. Działa to tak samo jak w przypadku [CalDAV](caldav.md#busy-availability).

## Odłączanie konta

Wybierz **Usuń** w menu **⋯** konta w panelu bocznym, aby usunąć je z aplikacji Mitra. Aby odebrać aplikacji Mitra dostęp po stronie Apple, usuń hasło „Mitra” na stronie **Logowanie i bezpieczeństwo**, na której je utworzono. Nie ma to wpływu na twoje hasło Apple ani na inne aplikacje.

## Rozwiązywanie problemów

- Jeśli połączenie nie udaje się z powodu hasła, sprawdź, czy wpisujesz hasło do aplikacji, a nie swoje hasło Apple.
- Jeśli brakuje kalendarza, jest on wyłączony. Włącz go w menu **⋯ → Edytuj** konta i naciśnij **Zapisz**.
