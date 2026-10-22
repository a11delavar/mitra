---
title: Logboek
description: Kies met MITRA_LOG_LEVEL hoeveel Mitra vastlegt, en welk niveau bij welk probleem helpt.
---

Mitra schrijft zijn logboek naar de standaarduitvoer, dus `docker compose logs` laat alles zien:

```bash
docker compose logs -f mitra
```

Een gezonde server is bewust stil: standaard legt hij alleen vast wat ertoe doet. Zet het niveau hoger terwijl je een probleem opspoort, en weer lager als je klaar bent.

## Het niveau instellen

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Elk niveau bevat alles van de stillere niveaus:

| `MITRA_LOG_LEVEL` | Wat je krijgt |
| --- | --- |
| `error` | Alleen fouten. |
| `warn` | Daarnaast problemen waar Mitra omheen heeft gewerkt, zoals een herinnering die niet kon worden afgeleverd, een geocoder die niet antwoordde of een inlogprovider die niet bereikbaar was. |
| `info` *(standaard)* | Daarnaast wat er dagelijks toe doet: het opstarten, gebruikers die inloggen, verbonden accounts, wijzigingen die vanuit aanbieders zijn gesynchroniseerd en verstuurde herinneringen. |
| `debug` | Daarnaast elk verzoek met de status en de duur, elke synchronisatie, wanneer het synchroniseren versnelt of vertraagt doordat mensen Mitra openen en sluiten, sessies, wijzigingen aan items en de communicatie met CalDAV-servers. |
| `trace` | Daarnaast elke databasequery en de onbewerkte agendagegevens. Dat is heel veel. |

Bij het starten legt Mitra vast op welk niveau het draait.

> [!NOTE]
> Wachtwoorden, tokens en andere geheimen worden op geen enkel niveau vastgelegd. `debug` en `trace` kunnen wel titels van items en agendagegevens tonen, dus kijk een logboek door voordat je het deelt.

## Welk niveau je gebruikt

- Synchroniseert een agenda niet, dan toont `debug` elke synchronisatie en de verzoeken aan CalDAV en Notion.
- Komen herinneringen niet aan, dan legt `info` al elke verstuurde herinnering vast, en `debug` voegt daar elke afleverpoging en verwijderde apparaten aan toe.
- Zie je een foutpagina, dan staat die fout met een stacktrace in `error`, en ook in het standaardniveau `info`.
- Wil je precies zien wat een aanbieder heeft gestuurd, dan voegt `trace` de onbewerkte gegevens en de databasequery's toe. Laat dat niveau maar kort aanstaan.
