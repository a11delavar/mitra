---
title: Agendabestanden
description: "Open .ics-bestanden en webcal://-links met Mitra, en maak Mitra de agenda-app die je computer daarvoor gebruikt."
---

Agendabestanden (`.ics`) en abonnementslinks (`webcal://`) zijn de manier waarop afspraken op het web worden gedeeld: een uitnodiging als bijlage bij een e-mail, een knop ‘Toevoegen aan agenda’ op een boekingspagina, een link om je te abonneren op het speelschema van een team. Als Mitra is geïnstalleerd, kan het beide openen, en kun je instellen dat je computer er Mitra voor gebruikt.

> [!NOTE]
> Om bestanden en links te openen, moet Mitra [als app zijn geïnstalleerd](install-app.md) vanuit een op Chromium gebaseerde browser op een computer, zoals Chrome, Edge, Brave of Opera. In elke browser kun je een `.ics`-bestand wel naar Mitra slepen.

## Mitra als standaard instellen

Installeer eerst Mitra. De eerste keer dat een agendabestand of -link Mitra opent, kan je browser vragen of Mitra het mag afhandelen: kies **Toestaan**. Stel daarna in je systeem in dat `.ics`-bestanden met Mitra worden geopend.

Klik op Windows in Verkenner met rechts op een `.ics`-bestand en kies **Openen met → Een andere app kiezen**. Kies **Mitra** en daarna **Altijd**. Je kunt dit later ook wijzigen onder **Instellingen → Apps → Standaard-apps**.

Klik op macOS in de Finder met Control ingedrukt op een `.ics`-bestand en kies **Toon info**. Kies onder **Open met** voor **Mitra**, klik op **Wijzig alles…** en bevestig.

Klik op Linux in je bestandsbeheerder met rechts op een `.ics`-bestand en open **Eigenschappen → Openen met**. Kies **Mitra** en stel het in als standaard.

Is Mitra al open, dan gaat een bestand of link die je opent naar dat venster, in plaats van dat er een tweede venster opengaat.

## Een agendabestand toevoegen

Open een `.ics`-bestand met Mitra, of sleep het vanaf je bureaublad of uit je bestandsbeheerder naar Mitra. Slepen werkt ook in een gewoon browsertabblad, zonder iets te installeren. Meerdere bestanden worden na elkaar geopend.

Mitra vraagt aan welke agenda je de items wilt toevoegen. Voordat het iets toevoegt, laat het zien wat die agenda niet kan opslaan: de items die het zou overslaan, en de gegevens die sommige items zouden verliezen, zoals herinneringen in een agenda die geen herinneringen kent. Wil je doorgaan, klik dan op de knop die zegt hoeveel items er worden toegevoegd, zoals **12 items toevoegen**. Wil je een andere agenda kiezen, ga dan terug met de pijl. Het bestand zelf verandert nooit.

Elk item wordt als nieuwe kopie toegevoegd. Voeg je hetzelfde bestand twee keer toe, dan heb je elk item dus twee keer. Niets wat al in je agenda staat, wordt overschreven.

Subtaken en afhankelijkheden tussen items uit hetzelfde bestand blijven na het importeren gekoppeld. Herhalingen die uit een terugkerend item zijn verwijderd, blijven verwijderd. Een reeks met gewijzigde herhalingen, zoals één vergadering die naar een andere dag is verplaatst, wordt overgeslagen, omdat Mitra een reeks niet samen met de wijzigingen erin kan toevoegen.

Mislukt het toevoegen halverwege, dan verwijdert Mitra de items die het al had toegevoegd, zodat er niets half geïmporteerd achterblijft. Lukt het niet om een deel ervan te verwijderen, dan laat Mitra weten hoeveel items je zelf moet verwijderen.

## Abonneren via een webcal-link

Sites waarop je je op een agenda kunt abonneren, zoals sportwedstrijden, schoolvakanties of feestdagen, linken meestal naar een `webcal://`-adres. Klik erop, en Mitra opent het formulier **Agenda-abonnement** met het adres al ingevuld. Controleer het adres, vul **Gebruikersnaam (optioneel)** en **Wachtwoord (optioneel)** in als de feed dat vraagt, en klik op **Verbinden**. Schakel daarna de agenda in en klik op **Opslaan**.

Door op de link te klikken, word je nooit vanzelf geabonneerd: Mitra haalt de feed pas op als je op **Verbinden** klikt.

Een abonnement is één alleen-lezen agenda die Mitra actueel houdt vanuit de feed. Hoe dat werkt, lees je onder [Agenda-abonnementen](integrations/subscriptions.md).
