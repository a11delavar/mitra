---
title: Konektory AI
description: Połącz z aplikacją Mitra narzędzia AI, takie jak Claude czy Cursor, aby mogły odczytywać i zmieniać twoje kalendarze.
---

Mitra obsługuje protokół Model Context Protocol (MCP), więc narzędzia AI mogą pracować z twoimi kalendarzami: przejrzeć twój tydzień, znaleźć wpis, zaplanować zadanie albo przesunąć spotkanie. Każde narzędzie łączy się z tym samym adresem, `https://<your Mitra>/api/mcp`, który znajdziesz w **Ustawienia → AI** w sekcji **Konektory AI**. Claude nazywa takie połączenie konektorem, a Cursor i inne narzędzia serwerem MCP.

Połączone narzędzie widzi i zmienia dokładnie to samo co ty w aplikacji Mitra, we wszystkich połączonych kalendarzach, a wprowadzona przez nie zmiana trafia do dostawcy tak, jakby pochodziła od ciebie.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="Okno ustawień otwarte na stronie AI z adresem, z którym można się połączyć" />
</picture>

## Połącz narzędzie

Tam, gdzie użytkownicy [się logują](sso.md), narzędzie potrzebuje tokenu dostępu:

1. Otwórz **Ustawienia → AI** i w sekcji **Tokeny dostępu** wybierz **Nowy token**.
2. Nadaj mu nazwę mówiącą, do czego służy, na przykład „Laptop” albo „Claude”, i wybierz **Tylko odczyt** lub **Odczyt i zapis**.
3. Skopiuj token. Mitra przechowuje tylko jego odcisk, więc token jest pokazywany tylko ten jeden raz.

Token działa w twoim imieniu, dopóki nie unieważnisz go na tej samej liście, która pokazuje też, kiedy każdy z tokenów był ostatnio użyty. Token tylko do odczytu udostępnia narzędziu wyłącznie to, co służy do odczytu.

Bez logowania Mitra służy jednej osobie i nie wymaga tokenu: wystarczy sam adres. Wtedy jednak może z niego skorzystać każdy, kto ma do niego dostęp, więc nie udostępniaj takiego serwera publicznie.

Wiele narzędzi potrafi też skonfigurować się samodzielnie: poproś Claude Code albo Cursor, aby połączył się z tym adresem przy użyciu tokenu, a sam zapisze swoją konfigurację. Poniższe przykłady robią to samo ręcznie; tam, gdzie token nie jest potrzebny, pomiń nagłówek `Authorization`.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Dodaj aplikację Mitra do pliku `.cursor/mcp.json` w projekcie albo do `~/.cursor/mcp.json`, aby była dostępna we wszystkich projektach:

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

Claude Desktop łączy się z adresem wymagającym tokenu przez narzędzie `mcp-remote`, które wymaga Node.js. Dodaj je do pliku `claude_desktop_config.json`:

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

## Co może połączone narzędzie

Połączone narzędzie pracuje z twoimi kalendarzami tak, jak ty w aplikacji Mitra. Może:

- przejrzeć dzień albo tydzień razem z tym, co zaległe, i tym, co wciąż niezaplanowane
- znaleźć wpisy i odczytać je w całości
- tworzyć, zmieniać, kończyć i usuwać wpisy, w przypadku wpisu cyklicznego jedno wystąpienie albo wszystkie
- zapraszać osoby tam, gdzie kalendarz przechowuje [uczestników](participants.md); to, czy dostaną powiadomienie, zależy od dostawcy
- łączyć wpisy jako [zależności](dependencies.md) i [podzadania](subtasks.md)
- tworzyć i usuwać kalendarze, jeśli dostawca na to pozwala

Narzędzie odczytuje wszystkie twoje kalendarze, także te ukryte w panelu bocznym, i zna twoją strefę czasową oraz język i region wybrane w **Ustawienia → Ogólne**, więc podaje daty tak, jak ty je zapisujesz.

> [!CAUTION]
> Wpisy pochodzą z kalendarzy, w których mogą pisać także inni, na przykład z kalendarza udostępnionego albo z zaproszenia. Ich treść trafia do narzędzia tak samo jak wszystko inne, co ono odczytuje. Token z prawem zapisu dawaj więc tylko narzędziu, któremu możesz zaufać nawet wtedy, gdy ma przed sobą notatkę od obcej osoby.

## W przeglądarce

Tam, gdzie wbudowany asystent przeglądarki może korzystać z tego, co udostępnia strona (WebMCP, wczesna funkcja Chrome), otwarta aplikacja Mitra udostępnia mu to samo, bez żadnej konfiguracji.

## Wyłącz

Ustaw [`MITRA_MCP`](configuration.md) na `off`, a żadne narzędzie się nie połączy. [Wersja demonstracyjna](https://demo.mitracal.com) nigdy nie przyjmuje połączeń.
