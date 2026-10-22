---
title: Apple Agenda
description: Verbind je iCloud-agenda's met Mitra via een app-specifiek wachtwoord, zonder iets op de server in te stellen.
---

Mitra maakt via CalDAV verbinding met je iCloud-agenda's en synchroniseert de afspraken daarin in twee richtingen. Apple laat andere apps niet inloggen met je Apple-wachtwoord, dus je maakt eerst een app-specifiek wachtwoord voor Mitra aan. Dat kost een minuutje, en op de server hoef je niets in te stellen.

## Een app-specifiek wachtwoord aanmaken

1. Log in op [appleid.apple.com](https://appleid.apple.com/).
2. Kies onder **Inloggen en beveiliging** voor **App-specifieke wachtwoorden**.
3. Maak een nieuw wachtwoord aan, noem het ‘Mitra’ zodat je het later herkent, en kopieer het.

Apple biedt app-specifieke wachtwoorden pas aan als twee-factor-authenticatie voor je account is ingeschakeld.

## Je account verbinden

1. Kies **Integratie toevoegen** onderaan de zijbalk en daarna **Apple Agenda**.
2. Vul je **Apple ID** in, het e-mailadres waarmee je bij Apple inlogt, en het **App-specifiek wachtwoord** dat je voor Mitra hebt aangemaakt.
3. Klik op **Verbinden**. Mitra toont je iCloud-agenda's, allemaal ingeschakeld.
4. Schakel de agenda's uit die je niet wilt en klik op **Opslaan**.

Mitra importeert de agenda's die je hebt laten staan en synchroniseert ze elke 10 seconden zolang je Mitra open hebt (zie [hoe synchroniseren werkt](README.md#how-syncing-works)).

## Wat er wordt gesynchroniseerd

Afspraken worden in twee richtingen gesynchroniseerd, met alles wat [CalDAV](caldav.md#what-syncs) meeneemt.

> [!NOTE]
> Bij taken ligt dat anders. Taken die Mitra in een iCloud-agenda opslaat, worden in iCloud bewaard en andere CalDAV-apps kunnen ze lezen, maar de app Herinneringen van Apple toont ze niet. Herinneringen gebruikt sinds iOS 13 geen CalDAV meer, en Apple biedt apps zoals Mitra geen andere toegang.

[Beschikbaarheid](../availability.md) die je in een iCloud-agenda als bezet markeert, wordt als bezette afspraken aan die agenda toegevoegd. Zo staat de tijd als bezet op je iPhone en bij iedereen die je uitnodigt. Het werkt zoals beschreven bij [CalDAV](caldav.md#busy-availability).

## De verbinding met je account verbreken

Kies **Verwijderen** in het **⋯**-menu van het account in de zijbalk om het uit Mitra te verwijderen. Wil je de toegang van Mitra ook bij Apple intrekken, verwijder dan het wachtwoord ‘Mitra’ op de pagina **Inloggen en beveiliging** waar je het hebt aangemaakt. Je Apple-wachtwoord en je andere apps blijven ongemoeid.

## Problemen oplossen

- Mislukt het verbinden vanwege het wachtwoord, controleer dan of je het app-specifieke wachtwoord hebt ingevuld en niet je Apple-wachtwoord.
- Ontbreekt er een agenda, dan is die uitgeschakeld. Schakel hem in via **⋯ → Bewerken** bij het account en klik op **Opslaan**.
