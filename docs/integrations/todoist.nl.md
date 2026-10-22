---
title: Todoist
description: Haal je Todoist-projecten naar Mitra, als agenda's met taken die in beide richtingen synchroniseren.
---

Mitra maakt verbinding met Todoist voor taken. Elk van je Todoist-projecten wordt in Mitra een agenda met de taken van dat project. De titel, beschrijving, datums en afronding van een taak synchroniseren in beide richtingen.

Je verbindt Todoist vanuit de app met je API-token. Op de server hoef je niets in te stellen.

## Een account verbinden

1. Open in Todoist **Instellingen** → **Integraties** → **Ontwikkelaar** en kopieer je API-token.
2. Kies in Mitra onder in de zijbalk **Integratie toevoegen** en daarna **Todoist**, en plak het token in **Todoist-API-token**.
3. Klik op **Verbinden**. Mitra toont je projecten, elk in zijn kleur uit Todoist. Een project binnen een ander project krijgt de naam van allebei, zoals ‘Werk · Lancering’.
4. Kies de projecten die je wilt en klik op **Opslaan**.

Je kunt meer dan één Todoist-account verbinden. Gearchiveerde projecten staan niet in de lijst.

## Wat er synchroniseert

De titel, de beschrijving en de afronding synchroniseren in beide richtingen, en de datums ook:

| In Todoist | In Mitra |
| --- | --- |
| Datum | Het tijdvak van de taak: een dag of een tijd |
| Duur | Hoe lang de taak is ingepland, of zijn [geschatte duur](../planning.md#set-an-estimate) zolang hij geen datum heeft |
| Deadline | Zijn [vervaldatum](../planning.md#set-a-due-date) |
| Subtaak | Een [subtaak](../subtasks.md) |

Een taak zonder datum wacht in de lijst **Niet ingepland** op het [tabblad Planning](../planning.md#the-planning-tab). Taken die je de afgelopen twaalf weken hebt afgerond, komen mee als je verbinding maakt, en daarna elke taak die je afrondt.

Todoist houdt een tijd zwevend, op elke klok hetzelfde waar je ook bent, of vast in een tijdzone. Mitra laat beide zoals ze zijn: een zwevende tijd blijft [overal dezelfde tijd](../time-zones.md#same-time-everywhere), en een vaste tijd houdt zijn tijdzone.

Deadlines en duur horen bij de abonnementen Pro en Business van Todoist. Met een gratis account hebben Todoist-taken in Mitra geen vervaldatum, einde of geschatte duur: een taak met een tijd is een moment, en een taak op een dag beslaat alleen die dag. Verandert je abonnement, bijvoorbeeld als een proefperiode begint of afloopt, dan leest Mitra alle taken opnieuw in. Een deadline is een dag, dus een vervaldatum waaraan je in Mitra een tijd geeft, houdt alleen zijn dag.

Mitra toont de prioriteit, labels, sectie, opmerkingen en herinneringen van een taak niet, en laat ze in Todoist zoals ze zijn. Verplaats je een taak naar een andere Todoist-agenda, dan verhuist hij in Todoist naar dat project, met dat alles erbij.

Wil je een taak in Todoist openen, kies dan **Openen in Todoist** in het **⋯**-menu van de editor. Verwijder je een taak in Mitra, dan wordt hij ook in Todoist verwijderd.

Todoist beperkt hoe vaak apps het mogen aanroepen, daarom synchroniseert Mitra ongeveer één keer per minuut (zie [hoe synchroniseren werkt](README.md#how-syncing-works)).

## Terugkerende taken

Een taak die in Todoist terugkeert, staat op zijn volgende datum, zoals Todoist hem bewaart, zonder zijn regel. Rond je hem af in Mitra, dan wordt hij ook in Todoist afgerond, en Todoist schuift hem zoals altijd door naar de datum daarna. Verplaats je hem naar een andere dag, dan verandert alleen zijn volgende datum en blijft de regel zoals hij is. Wil je de regel zelf wijzigen, bewerk de taak dan in Todoist.

## Wat in Mitra blijft

Todoist kent geen afhankelijkheden, dus de [afhankelijkheden](../dependencies.md) tussen Todoist-taken worden alleen in Mitra bewaard. Ze gaan verloren als je de verbinding met het account verbreekt of [een agenda opnieuw importeert](../calendars.md#re-import-a-calendar). De bovenliggende taak van een subtaak wordt op beide plekken bewaard, zolang die een taak van hetzelfde Todoist-account is. Todoist verplaatst de subtaak dan naar het project van zijn bovenliggende taak.

## Wat Todoist niet kan bevatten

- Alleen taken, dus geen afspraken en geen [beschikbaarheid](../availability.md).
- Een taak is open of afgerond, dus er is geen status **Bezig** of **Geannuleerd**. Een taak die elders bezig is, gaat terug naar **Te doen** als je hem naar Todoist verplaatst.
- Je kunt een taak vanuit Mitra niet laten terugkeren.
- Een taak heeft in Mitra geen herinneringen, locatie, deelnemers, bijlagen, voortgang, keuze tussen bezet en vrij of zichtbaarheid.

Mitra verbergt deze velden bij Todoist-taken, zodat niets wat je daar invult bij de volgende synchronisatie verdwijnt. Wil je items die deze velden gebruiken naar Todoist verplaatsen, lees dan [Alle items naar een andere agenda verplaatsen of kopiëren](../calendars.md#move-or-copy-every-entry-to-another-calendar). Daar zie je eerst wat niet mee zou komen.

## Probleemoplossing

- Meldt Mitra dat Todoist het API-token heeft geweigerd, kopieer het dan opnieuw via **Instellingen** → **Integraties** → **Ontwikkelaar**. Heb je het token in Todoist gereset, open dan in Mitra **⋯ → Bewerken** bij het account en plak het nieuwe.
- Ontbreekt een project, dan is het misschien gearchiveerd. Haal het in Todoist uit het archief, open daarna in Mitra **⋯ → Bewerken** bij het account en klik op **Vernieuwen**.
