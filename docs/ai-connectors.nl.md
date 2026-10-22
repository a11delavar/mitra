---
title: AI-connectors
description: Verbind AI-tools zoals Claude of Cursor met Mitra, zodat ze je agenda's kunnen lezen en wijzigen.
---

Mitra spreekt het Model Context Protocol (MCP), zodat AI-tools met je agenda's kunnen werken: je week bekijken, een item opzoeken, een taak inplannen, een vergadering verplaatsen. Elke tool maakt verbinding met hetzelfde adres, `https://<your Mitra>/api/mcp`, dat je in **Instellingen → AI** onder **AI-connectors** vindt. Claude noemt zo'n verbinding een connector, Cursor en andere tools een MCP-server.

Een verbonden tool ziet en wijzigt precies wat jij in Mitra ziet en wijzigt, in al je verbonden agenda's, en een wijziging die de tool maakt, komt bij de aanbieder aan alsof jij hem had gemaakt.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="Het instellingenvenster, geopend op de pagina AI met het adres om verbinding mee te maken" />
</picture>

## Een tool verbinden

Waar mensen [inloggen](sso.md), heeft een tool een toegangstoken nodig:

1. Open **Instellingen → AI** en kies **Nieuw token** onder **Toegangstokens**.
2. Geef het een naam naar waarvoor het dient, zoals je laptop of Claude, en kies **Alleen lezen** of **Lezen en schrijven**.
3. Kopieer het token. Mitra bewaart er alleen een vingerafdruk van, dus je ziet het maar deze ene keer.

Een token treedt namens jou op tot je het intrekt in dezelfde lijst, die ook laat zien wanneer elk token voor het laatst is gebruikt. Met een token dat alleen mag lezen, krijgt de tool alleen de functies die iets lezen.

Zonder inloggen is Mitra voor één persoon en vraagt het om geen token: het adres is genoeg. Iedereen die dat adres kan bereiken, kan het dan gebruiken, dus houd zo'n server privé.

Veel tools kunnen zichzelf ook instellen: vraag Claude Code of Cursor om met het token verbinding te maken met het adres, en de tool schrijft zijn eigen configuratie. De voorbeelden hieronder doen hetzelfde met de hand. Laat de header `Authorization` weg waar geen token nodig is.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Voeg Mitra toe aan `.cursor/mcp.json` in een project, of aan `~/.cursor/mcp.json` voor al je projecten:

```json
{
  "mcpServers": {
    "mitra": {
      "url": "https://mitra.example.com/api/mcp",
      "headers": { "Authorization": "Bearer mitra_…" }
    }
  }
}
```

### Claude Desktop

Claude Desktop bereikt een adres met een token via `mcp-remote`, waarvoor Node.js nodig is. Voeg het toe aan `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mitra": {
      "command": "npx",
      "args": ["mcp-remote", "https://mitra.example.com/api/mcp", "--header", "Authorization:${MITRA_TOKEN}"],
      "env": { "MITRA_TOKEN": "Bearer mitra_…" }
    }
  }
}
```

## Wat een verbonden tool kan

Een verbonden tool werkt met je agenda's zoals jij dat in Mitra doet. De tool kan:

- een dag of een week bekijken, met wat achterstallig is en wat nog niet is ingepland
- items opzoeken en ze volledig lezen
- items maken, wijzigen, afronden en verwijderen, en bij een terugkerend item één herhaling of alle herhalingen
- mensen uitnodigen in agenda's die [deelnemers](participants.md) bijhouden; of ze daarvan bericht krijgen, hangt af van de aanbieder
- items aan elkaar koppelen als [afhankelijkheden](dependencies.md) en [subtaken](subtasks.md)
- agenda's maken en verwijderen waar de aanbieder dat toestaat

De tool leest al je agenda's, ook de agenda's die je in de zijbalk hebt verborgen, en kent je tijdzone en de taal en regio die je in **Instellingen → Algemeen** hebt gekozen, zodat hij datums schrijft zoals jij ze schrijft.

> [!CAUTION]
> Items komen uit agenda's waarin ook anderen kunnen schrijven, zoals een gedeelde agenda of een uitnodiging. Hun tekst bereikt de tool net als al het andere wat hij leest. Geef een token dat mag schrijven dus alleen aan een tool die je zou vertrouwen met een briefje van een onbekende voor zijn neus.

## In de browser

Waar de eigen assistent van de browser kan gebruiken wat een pagina aanbiedt (WebMCP, een vroege functie van Chrome), biedt een geopende Mitra hetzelfde aan, zonder dat je iets hoeft in te stellen.

## Uitschakelen

Stel [`MITRA_MCP`](configuration.md) in op `off`, dan kan geen enkele tool nog verbinding maken. De [demo](https://demo.mitracal.com) accepteert nooit verbindingen.
