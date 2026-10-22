---
title: Herinneringen
description: Voeg herinneringen toe aan afspraken en taken, kies met welke herinneringen nieuwe items beginnen, en beheer de apparaten die ze ontvangen.
---

Een herinnering laat je van tevoren weten dat er een afspraak of taak aankomt, met een melding van je systeem, ook als Mitra niet open is. De herinnering komt van je eigen Mitra-server, dus je hoeft je nergens anders voor aan te melden. Op een iPhone of iPad werken herinneringen alleen als Mitra [als app is geïnstalleerd](install-app.md). Overal anders is de browser genoeg.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="De instellingenpagina Meldingen, met de standaardherinneringen, de toestemming van de browser en de lijst met apparaten" />
</picture>

## Een herinnering toevoegen

Open een item en klik op **＋** in de rij met herinneringen, die met het belletje. Kies wanneer de herinnering moet afgaan: **Bij begin van de afspraak** (**Op het tijdstip van de taak** bij een taak), 5 of 10 minuten, een half uur, een uur of een dag van tevoren, of **Aangepast…** voor elk ander moment. Een item kan meerdere herinneringen hebben, en met het **✕** ernaast verwijder je er een.

Een herinnering telt terug vanaf het begin van het item, of bij een taak zonder begin vanaf de vervaldatum. De eerste keer dat je een herinnering toevoegt, vraagt je browser of Mitra meldingen mag tonen. Zeg je nee, dan wordt de herinnering toch bij het item bewaard.

Een terugkerend item herinnert je aan elke herhaling. Taken die je als klaar of geannuleerd hebt gemarkeerd, blijven stil, maar een agenda die je verbergt niet. Wil je geen herinneringen meer uit een agenda, schakel die dan uit via **⋯ → Bewerken** bij het account. Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) kunnen geen herinneringen bevatten.

## Standaardherinneringen

Onder **Instellingen → Meldingen** stel je in met welke herinneringen nieuwe items beginnen: 30 minuten van tevoren voor een afspraak en op het tijdstip van de taak voor een taak, tenzij je dat wijzigt of **Geen** kiest. Items voor de hele dag beginnen zonder herinneringen.

## Als een herinnering afgaat

De melding toont de titel van het item, wanneer het is en de locatie, in de taal en tijdzone van het apparaat. Ze blijft staan tot je haar sluit, en als je erop tikt, opent het item. Met **10 min uitstellen** komt ze later terug, en bij een taak markeer je met **Klaar** de taak als klaar zonder Mitra te openen. Safari en Firefox tonen deze knoppen niet.

Was een apparaat offline toen een herinnering werd verstuurd, dan vervalt ze daar vijf minuten na het begin van het item, zodat ze niet te laat verschijnt.

## Je apparaten

Elke browser of geïnstalleerde app waarin je meldingen toestaat, is een apparaat, en elk apparaat krijgt al je herinneringen. Onder **Instellingen → Meldingen** staan ze allemaal, met het apparaat dat je nu gebruikt gemarkeerd als **dit apparaat**. Geef een apparaat een andere naam met het potlood, verwijder er een met het **✕**, en stuur jezelf een voorbeeld met **Testafspraak** of **Testtaak**.

## Problemen oplossen

- Komt een herinnering niet aan, stuur dan een **Testafspraak**. Komt de test wel aan, dan staat het item waarschijnlijk in een agenda die is uitgeschakeld. Toestemming geldt per browser en per adres, dus als je Mitra op het ene adres toestaat, geldt dat niet voor een ander adres.
- Staat er geen rij **Meldingen voor herinneringen** onder **Instellingen → Meldingen**, dan kan deze browser geen meldingen van Mitra ontvangen. Open op een iPhone of iPad de [geïnstalleerde app](install-app.md) in plaats van Safari. Overal anders moet Mitra via HTTPS worden aangeboden.
- Staat er in de rij **Geblokkeerd**, sta dan meldingen voor Mitra toe in de site-instellingen van je browser.
- Komt er op Windows niets binnen terwijl Chrome gesloten is, schakel dan in de instellingen van Chrome **Apps op de achtergrond blijven uitvoeren als Google Chrome is gesloten** in, of installeer Mitra vanuit Edge.

## Op de server

Herinneringen hoef je niet in te stellen, je hebt alleen [HTTPS](configuration.md#put-it-behind-https) nodig. Mitra ondertekent zijn meldingen met een sleutel die het bij de eerste start aanmaakt en in de database bewaart. Zet de datamap daarom altijd in zijn geheel terug uit je [back-ups](backups.md): met een nieuwe database maakt Mitra een nieuwe sleutel aan, en apparaten die met de oude sleutel zijn geregistreerd, krijgen dan geen herinneringen meer. In de [logboeken](logging.md) wordt elke herinnering vastgelegd zodra ze wordt verstuurd.
