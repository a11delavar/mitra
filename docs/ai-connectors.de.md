---
title: KI-Konnektoren
description: Verbinde KI-Werkzeuge wie Claude oder Cursor mit Mitra, damit sie deine Kalender lesen und ändern können.
---

Mitra spricht das Model Context Protocol (MCP), sodass KI-Werkzeuge mit deinen Kalendern arbeiten können: deine Woche ansehen, einen Eintrag finden, eine Aufgabe planen, ein Treffen verschieben. Jedes Werkzeug verbindet sich mit derselben Adresse, `https://<dein Mitra>/api/mcp`, die **Einstellungen → KI** unter **KI-Konnektoren** anzeigt. Claude nennt eine solche Verbindung einen Konnektor, Cursor und andere einen MCP-Server.

Ein verbundenes Werkzeug sieht und ändert genau das, was du in Mitra siehst und änderst, über alle deine verbundenen Kalender hinweg, und eine Änderung, die es vornimmt, erreicht den Anbieter so, wie deine es täte.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="Der Einstellungsdialog, geöffnet auf der Seite KI mit der Adresse zum Verbinden" />
</picture>

## Ein Werkzeug verbinden

Wo man sich [anmeldet](sso.md), braucht ein Werkzeug ein Zugriffstoken:

1. Öffne **Einstellungen → KI** und wähl **Neues Token** unter **Zugriffstoken**.
2. Benenne es nach seinem Zweck, etwa nach dem Laptop oder nach Claude, und wähl **Nur lesen** oder **Lesen und schreiben**.
3. Kopiere das Token. Mitra behält davon nur einen Fingerabdruck, deshalb wird es nur dieses eine Mal angezeigt.

Ein Token steht für dich, bis du es in derselben Liste widerrufst, die auch zeigt, wann jedes zuletzt benutzt wurde. Ein Token, das nur lesen darf, bietet dem Werkzeug nur an, was liest.

Ohne Anmeldung ist Mitra für eine Person gedacht und fragt nach keinem Token: Die Adresse genügt. Dann kann aber jeder, der diese Adresse erreicht, sie benutzen, halte einen solchen Server also privat.

Viele Werkzeuge können sich auch selbst einrichten: Sag Claude Code oder Cursor, es soll sich mit dem Token mit der Adresse verbinden, und es schreibt seine Konfiguration selbst. Die Beispiele unten tun dasselbe von Hand und lassen den Header `Authorization` weg, wo kein Token nötig ist.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Füge Mitra zu `.cursor/mcp.json` in einem Projekt hinzu, oder zu `~/.cursor/mcp.json` für alle Projekte:

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

Claude Desktop erreicht eine Adresse mit Token über `mcp-remote`, das Node.js braucht. Füge es zu `claude_desktop_config.json` hinzu:

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

## Was ein verbundenes Werkzeug kann

Ein verbundenes Werkzeug arbeitet mit deinen Kalendern, wie du es in Mitra tun würdest. Es kann:

- einen Tag oder eine Woche ansehen, samt dem, was überfällig ist und was noch ohne Termin ist
- Einträge finden und vollständig lesen
- Einträge anlegen, ändern, erledigen und löschen, bei einem wiederkehrenden Eintrag eine einzelne Wiederholung oder alle
- Leute einladen, wo der Kalender [Teilnehmende](participants.md) aufnimmt; ob sie davon erfahren, hängt vom Anbieter ab
- Einträge als [Abhängigkeiten](dependencies.md) und [Teilaufgaben](subtasks.md) verknüpfen
- Kalender anlegen und löschen, wo der Anbieter es zulässt

Es liest alle deine Kalender, auch die, die du in der Seitenleiste ausgeblendet hast, und kennt deine Zeitzone sowie die Sprache und das Land, die du unter **Einstellungen → Allgemein** gewählt hast. So kann es Datumsangaben so ausdrücken, wie du sie schreibst.

> [!CAUTION]
> Einträge stammen aus Kalendern, in die auch andere schreiben können, etwa aus einem geteilten Kalender oder einer Einladung. Ihr Text erreicht das Werkzeug wie alles andere, was es liest. Gib ein Token, das schreiben darf, also nur einem Werkzeug, dem du auch dann trauen würdest, wenn es die Notiz eines Fremden vor sich hat.

## Im Browser

Wo der eigene Assistent des Browsers nutzen kann, was eine Seite anbietet (WebMCP, eine frühe Funktion von Chrome), bietet ein geöffnetes Mitra dasselbe an, ohne dass du etwas einrichten musst.

## Ausschalten

Setz [`MITRA_MCP`](configuration.md) auf `off`, dann kann sich kein Werkzeug mehr verbinden. Die [Demo](https://demo.mitracal.com) nimmt nie Verbindungen an.
