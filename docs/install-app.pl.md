---
title: Instalacja aplikacji
description: "Zainstaluj aplikację Mitra na komputerze, telefonie z Androidem, iPhonie lub iPadzie, aby otwierała się we własnym oknie."
---

Mitra działa w przeglądarce, ale możesz ją też zainstalować jako aplikację. Nic nie pobierasz ze sklepu z aplikacjami: przeglądarka daje aplikacji Mitra własne okno i ikonę, a ty otwierasz ją z Docka, paska zadań, menu Start lub ekranu głównego jak każdą inną aplikację.

Instalacja opłaca się z trzech powodów:

- Mitra otwiera się we własnym oknie, z dala od kart przeglądarki, a jej powiadomienia pojawiają się z jej własną nazwą i ikoną.
- Na iPhonie i iPadzie to jedyny sposób, aby dostawać [przypomnienia](reminders.md).
- Na komputerze Mitra może otwierać za ciebie pliki `.ics` i linki `webcal://`. Zobacz [Pliki kalendarza](calendar-files.md).

Zainstalowana aplikacja zawsze nazywa się Mitra i ma ikonę aplikacji Mitra, nawet jeśli twój serwer nadaje instancji [własną nazwę](configuration.md#name-your-instance).

## Na komputerze

W Chrome, Edge i innych przeglądarkach opartych na Chromium otwórz aplikację Mitra i kliknij ikonę instalacji na końcu paska adresu. Gdy przeglądarka proponuje instalację, na dole panelu bocznego pojawia się też przycisk **Zainstaluj jako aplikację**. Możesz też skorzystać z menu przeglądarki: w Chrome wybierz **Przesyłanie, zapisywanie i udostępnianie → Zainstaluj stronę jako aplikację**, a w Edge **Aplikacje → Zainstaluj tę witrynę jako aplikację**.

W Safari na Macu wybierz **Plik → Dodaj do Docka**.

Po instalacji Mitra otwiera się we własnym oknie. Jeśli to okno jest już otwarte, gdy otwierasz plik lub link kalendarza, Mitra przenosi je na wierzch, zamiast otwierać drugie.

## Na Androidzie

Otwórz aplikację Mitra w Chrome, otwórz menu przeglądarki (**⋮**) i wybierz **Zainstaluj aplikację** lub **Dodaj do ekranu głównego**. Mitra pojawi się wtedy wśród innych aplikacji.

Na Androidzie przypomnienia działają też w przeglądarce, więc instalacja jest opcjonalna.

## Na iPhonie i iPadzie

Otwórz aplikację Mitra w Safari, stuknij przycisk Udostępnij, a następnie **Do ekranu początkowego**. Od tej pory otwieraj aplikację Mitra za pomocą jej ikony na ekranie początkowym.

Na iPhonie i iPadzie powiadomienia działają tylko w zainstalowanej aplikacji, od iOS i iPadOS 16.4. Zezwól na nie w samej zainstalowanej aplikacji: Safari i aplikacja działają niezależnie od siebie i tylko aplikacja może dostawać przypomnienia.

> [!NOTE]
> Jeśli twój serwer stoi za odwrotnym serwerem proxy, który loguje cię za pomocą pliku cookie, instalacja nadal działa. Mitra pobiera swój opis aplikacji (manifest aplikacji internetowej) razem z twoimi plikami cookie, więc serwer proxy przepuszcza to żądanie.
