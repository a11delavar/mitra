---
title: Tempo
description: Zie de uren die je in Tempo boekt in je agenda, en boek, verplaats, verleng, verkort en verwijder ze vanuit Mitra.
---

[Tempo](https://www.tempo.io/) is een app voor tijdregistratie in Jira. Mitra toont je **worklogs**, de uren die je op Jira-issues hebt geboekt, als items met een tijd in je agenda, naast de vergaderingen en taken waar die tijd in zat.

Worklogs synchroniseren in beide richtingen. Verplaats een item of wijzig de lengte ervan om aan te passen wanneer en hoe lang je hebt gewerkt, bewerk de beschrijving om de notitie van de worklog te wijzigen, verwijder het item om de worklog te verwijderen, of maak er een aan om nieuwe tijd te boeken.

Je verbindt Tempo vanuit de app met twee API-tokens. Op de server hoef je niets in te stellen.

## Je urenstaat verbinden

Mitra heeft een token van Tempo en een van Atlassian nodig: Tempo bewaart de uren, en Jira kent de issues en weet wie je bent.

1. Maak een Tempo-API-token aan. Open in Jira de **Settings** van Tempo (het tandwiel) → **Data Access** → **API integration**, kies **New Token**, noem het ‘Mitra’ en kopieer het token.
2. Maak een Atlassian-API-token aan op [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) met **Create API token**, en kopieer het. Maak beide tokens aan als dezelfde Jira-gebruiker.
3. Kies in Mitra onder in de zijbalk **Integratie toevoegen** en daarna **Tempo**, en vul in:
   - **Site-URL**: je Atlassian-adres, zoals `https://your-company.atlassian.net`.
   - **Tempo-API-token**: het token uit stap 1.
   - **E-mailadres van Atlassian-account**: het e-mailadres van je Atlassian-account.
   - **Atlassian-API-token**: het token uit stap 2.
4. Klik op **Verbinden**. Mitra toont één agenda, **My worklogs**.
5. Laat die aanstaan en klik op **Opslaan**.

Tempo beperkt hoe vaak apps het mogen aanroepen, daarom synchroniseert Mitra ongeveer één keer per minuut (zie [hoe synchroniseren werkt](README.md#how-syncing-works)).

## Hoe worklogs eruitzien

De titel van een item is het Jira-issue waarop de tijd is geboekt, met de sleutel en de samenvatting ervan:

```text
ACME-1234 Code review for auth migration
```

De notitie van de worklog is de beschrijving van het item. De app van Tempo zelf toont ze op dezelfde manier: het issue zegt waar de tijd over ging, terwijl de notitie vaak een activiteitenlabel is, zoals ‘Review’, of tekst die Jira voor je heeft geschreven, zoals ‘Working on work item ACME-1234’.

De titel hoort bij het issue, dus bij een opgeslagen worklog kun je hem niet bewerken: Mitra geeft een Jira-issue geen andere naam omdat jij een agenda-item hebt bewerkt. Bewerk de beschrijving om te zeggen wat je hebt gedaan. Kan Jira het issue niet noemen, omdat het is verwijderd of je het niet meer mag zien, dan toont de titel `#` en de ID van het issue, en blijft het item gewoon werken.

Tempo slaat worklogs op als kale kloktijden, zonder tijdzone. Mitra leest ze in de tijdzone van je Jira-profiel, zodat ze op dezelfde tijden staan als in Tempo.

Sommige Tempo-omgevingen hebben begintijden uitgezet. Daar begint elke worklog van een dag op hetzelfde tijdstip, zodat ze op elkaar stapelen, maar hun lengte klopt wel.

## Tijd boeken vanuit Mitra

Maak een item met een tijd aan in **My worklogs** en zet de sleutel van het Jira-issue ergens in de titel:

| Je typt | Geboekt op |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra controleert de sleutel aan de hand van de Jira-projecten die je kunt zien. Staat er geen geldige sleutel in de titel, of bestaat het issue niet in Jira, dan boekt Mitra niets en vertelt het je waarom.

De notitie van de worklog is wat je in de beschrijving hebt geschreven, of, als je die leeg hebt gelaten, de hele titel zoals je hem hebt getypt. Zodra de tijd is geboekt, wordt de titel de sleutel en samenvatting van het issue. Die wissel gebeurt één keer, bij het boeken. Daarom kun je de titel bewerken terwijl je hem schrijft, maar niet meer daarna.

> [!TIP]
> Wil je tijd boeken op een issue waarop je al eerder hebt geboekt, dupliceer dan een van de items ervan: houd <kbd>Alt</kbd> (<kbd>⌥</kbd> op een Mac) ingedrukt terwijl je het naar de nieuwe tijd sleept, of kies **Dupliceren** in het **⋯**-menu van de editor.

## Een worklog wijzigen

Verplaatsen, de lengte wijzigen, verwijderen en de beschrijving bewerken gaan rechtstreeks naar Tempo. Goed om te weten:

- Een worklog blijft bij zijn issue. Tempo kan een worklog niet naar een ander issue verplaatsen. Wil je de tijd ergens anders boeken, verwijder dan het item en maak een nieuw item met de juiste sleutel aan.
- Mitra behoudt de eigen gegevens die Tempo bij een worklog bijhoudt, zoals de declarabele tijd en de werkkenmerken, als het de worklog wijzigt.
- Is een urenstaatperiode in Tempo afgesloten of goedgekeurd, dan weigert Tempo om in die periode worklogs toe te voegen, te wijzigen of te verwijderen.

Wil je het issue in Jira openen, kies dan **Openen in Jira** in het **⋯**-menu van de editor.

## Wat een worklog niet kan bevatten

Een worklog is een tijdsblok op één dag, geboekt op één issue. Een Tempo-agenda bevat daarom alleen items met een tijd: geen items voor de hele dag, herhalingen, herinneringen, locatie, deelnemers, [bijlagen](../attachments.md), relaties, keuze tussen bezet en vrij, zichtbaarheid of [beschikbaarheid](../availability.md). Mitra verbergt deze velden bij worklogs.

## Probleemoplossing

- Meldt Mitra ‘Tempo rejected the API token’, maak dan een nieuw Tempo-API-token aan en vul het in via **⋯ → Bewerken** bij het account.
- Meldt Mitra ‘Jira rejected the e-mail and API token’, controleer dan of het e-mailadres hoort bij het Atlassian-account waarmee het API-token is aangemaakt.
- Staan worklogs op het verkeerde tijdstip van de dag, controleer dan de tijdzone in je Jira-profiel (**Account settings** → **Time zone**). Gebruik na het wijzigen **Items opnieuw importeren** in het **⋯**-menu van **My worklogs**, zodat ook de worklogs die je al hebt meeschuiven.
- Stapelen worklogs elke dag op hetzelfde tijdstip, dan heeft je Tempo-omgeving begintijden uitgezet. De uren kloppen nog steeds.
