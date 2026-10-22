---
title: CalDAV
description: Verbind elke CalDAV-server, zoals Nextcloud, Radicale, Fastmail of mailbox.org, en synchroniseer de afspraken en taken in beide richtingen.
---

CalDAV is de open standaard die de meeste agendaservers spreken. Je verbindt een CalDAV-account vanuit de app, zonder iets op de server in te stellen, en Mitra synchroniseert de afspraken en taken in beide richtingen.

Je agenda's blijven op je eigen server, dus elke andere CalDAV-app die je gebruikt, zoals de agenda op je telefoon, ziet dezelfde items. Dat is het verschil met [Mitra-agenda's](mitra.md), die alleen Mitra kan openen.

## Een account verbinden

1. Kies **Integratie toevoegen** onderaan de zijbalk en daarna **CalDAV**.
2. Vul het formulier in:
   - **Server-URL** is het CalDAV-adres van je server, zoals `https://caldav.example.com`. In de [tabel hieronder](#server-urls-for-common-providers) staat het voor bekende aanbieders.
   - **Gebruikersnaam** is meestal je accountnaam of e-mailadres.
   - **Wachtwoord** is het wachtwoord van je account, of een app-wachtwoord als je aanbieder je er een geeft.
3. Druk op **Verbinden**. Mitra toont de agenda's van het account, allemaal ingeschakeld, en vermeldt wat er in elke agenda staat, zoals ‘Afspraken · Taken’.
4. Schakel de agenda's uit die je niet wilt en druk op **Opslaan**.

Mitra importeert de agenda's die je hebt laten staan en synchroniseert ze daarna elke 10 seconden zolang je Mitra open hebt (zie [hoe synchroniseren werkt](README.md#how-syncing-works)).

Wil je later het wachtwoord wijzigen, open dan het **⋯**-menu van het account in de zijbalk, kies **Bewerken**, typ het nieuwe wachtwoord en druk op **Opslaan**. De server-URL en de gebruikersnaam blijven zoals ze zijn; een ander account verbind je apart.

## Server-URL's van bekende aanbieders

Geef Mitra het CalDAV-adres van de aanbieder, dan vindt het de agenda's van daaruit.

Noemt het adres een gebruiker, zoals `https://<your-radicale>/<user>/`, dan toont Mitra de agenda's van die gebruiker in plaats van je eigen agenda's, voor zover de server ze met je deelt. Verbind elk adres apart.

| Aanbieder | Server-URL |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (of `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Agenda en iCloud spreken ook CalDAV, maar accepteren je gewone wachtwoord niet: bij Google log je in via een eigen pagina van Google, en Apple vraagt om een app-specifiek wachtwoord. Gebruik daarvoor hun eigen tegels, zoals beschreven in [Google Agenda](google.md) en [Apple Agenda](apple.md).

## Wat er wordt gesynchroniseerd

Elke agenda op de server is één agenda in Mitra. Die bevat afspraken, taken of allebei, afhankelijk van wat de server toestaat. De meeste servers staan allebei toe; in een agenda die maar één soort accepteert, zijn nieuwe items altijd van die soort.

Alles wat Mitra over een item bewaart, wordt gesynchroniseerd, voor zover je server het bijhoudt:

- Items voor de hele dag en items over meerdere dagen, locaties, beschrijvingen, kleuren en herinneringen.
- Of een item als bezet of vrij wordt weergegeven, en de zichtbaarheid.
- De status en de voortgang van een taak.
- [Deelnemers](../participants.md). Je server verstuurt de uitnodigingen en verzamelt de antwoorden.
- [Subtaken](../subtasks.md) en [afhankelijkheden](../dependencies.md).
- [Bijlagen](../attachments.md). Andere apps op dezelfde agenda zien de bestanden, en Mitra toont de bestanden die zij hebben toegevoegd.

Een terugkerend item blijft op de server één reeks. Als je één herhaling wijzigt, vraagt Mitra of je **Dit item**, **Dit en volgende items** of **Alle items** bedoelt, en past de reeks daarop aan.

Een taak houdt zijn tijdvak, zijn [vervaldatum en zijn geschatte duur](../planning.md#schedule-constraints-and-planning). Op de server worden ze zo opgeslagen:

- Het begin als `DTSTART`.
- De lengte als `ESTIMATED-DURATION`: hoe lang het tijdvak van de taak is, of de geschatte duur zolang hij geen begin heeft.
- De vervaldatum als `DUE`.

Een taak met een begin maar zonder lengte is een moment.

Agenda's die alleen ter inzage met je zijn gedeeld, worden gemarkeerd als alleen-lezen. Je kunt ze nog steeds een andere naam, kleur of volgorde geven en ze verbergen; zie [Alleen-lezen agenda's](../calendars.md#read-only-calendars).

## Bezette beschikbaarheid

[Beschikbaarheid](../availability.md) die je als **Bezet** markeert, wordt als bezette afspraken aan de agenda toegevoegd, zodat de tijd als bezet verschijnt op je telefoon en voor iedereen die je uitnodigt. Je hoeft er niets voor in te stellen.

- Elke bezette beschikbaarheid wordt een terugkerende afspraak met dezelfde tijden en herhalingsregel, gemarkeerd als bezet. Die krijgt de naam van de beschikbaarheid, of ‘Busy’ als die geen naam heeft, en ook de locatie en de zichtbaarheid, zoals **Privé**.
- In Mitra zelf zie je de beschikbaarheid in plaats van deze afspraken, zodat de tijd niet dubbel verschijnt.
- Mitra houdt de afspraken gelijk met je beschikbaarheid. Wordt er een in een andere app gewijzigd, verplaatst of verwijderd, dan zet Mitra hem bij de volgende synchronisatie terug.
- Markeer je de beschikbaarheid weer als **Vrij**, verwijder je haar, schakel je haar agenda uit of verwijder je het account, dan verdwijnen de afspraken. Verplaats je de beschikbaarheid naar een andere agenda, dan gaan de afspraken mee.
- Een agenda die alleen taken bevat, of waarin je niet mag schrijven, krijgt geen afspraken.

> [!NOTE]
> Wijzigingen aan één dag van een bezette beschikbaarheid worden niet overgenomen. De afspraak blijft de herhalingsregel volgen, dus een dag die je hebt verschoven of ingekort, toont anderen nog steeds de gebruikelijke tijd.

Dit werkt hetzelfde voor [Google Agenda](google.md) en [Apple Agenda](apple.md), waarmee Mitra ook via CalDAV verbinding maakt.

## Problemen oplossen

- Ontbreekt er een agenda, dan is die uitgeschakeld. Dat gebeurt met agenda's die je bij het verbinden hebt uitgeschakeld, en met agenda's die later op de server zijn gemaakt, want die voegt Mitra uitgeschakeld toe. Schakel hem in via **⋯ → Bewerken** bij het account en druk op **Opslaan**. Met **Vernieuwen** in dat venster verschijnen ook de agenda's die sinds de laatste synchronisatie op de server zijn gemaakt.
- Meldt Mitra ‘This account is already connected’, dan staat het account al in je zijbalk. Wijzig het dan via **⋯ → Bewerken**, bijvoorbeeld om een nieuw wachtwoord in te voeren.
- Lukt het verbinden niet, controleer dan of de server-URL met `https://` begint en naar het CalDAV-adres wijst, niet naar de webpagina waar je inlogt. Wil je elke aanvraag zien die Mitra naar de server stuurt, zet het [logniveau](../logging.md) dan op `debug`.
- Ziet een agenda er na een update van Mitra verkeerd uit, gebruik dan **Items opnieuw importeren** in het **⋯**-menu ervan. Bij synchroniseren haalt Mitra alleen op wat er op de server is veranderd, dus items die niet zijn veranderd, worden nooit opnieuw gelezen; opnieuw importeren leest ze allemaal. Zie [Een agenda opnieuw importeren](../calendars.md#re-import-a-calendar).
