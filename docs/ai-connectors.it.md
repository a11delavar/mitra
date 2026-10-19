---
title: Connettori IA
description: Collega a Mitra strumenti di IA come Claude o Cursor, perché possano leggere e modificare i tuoi calendari.
---

Mitra parla il Model Context Protocol (MCP), così gli strumenti di IA possono lavorare con i tuoi calendari: guardare la tua settimana, trovare una voce, pianificare un'attività, spostare una riunione. Ogni strumento si collega allo stesso indirizzo, `https://<il tuo Mitra>/api/mcp`, che **Impostazioni → IA** mostra sotto **Connettori IA**. Claude chiama un collegamento del genere connettore, Cursor e altri server MCP.

Uno strumento collegato vede e modifica esattamente ciò che vedi e modifichi tu in Mitra, in tutti i tuoi calendari collegati, e una modifica che fa arriva al provider come ci arriverebbe una tua.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="La finestra delle impostazioni, aperta sulla pagina IA con l’indirizzo a cui collegarsi" />
</picture>

## Collegare uno strumento

Dove si [accede con un account](sso.md), uno strumento ha bisogno di un token di accesso:

1. Apri **Impostazioni → IA** e scegli **Nuovo token** sotto **Token di accesso**.
2. Dagli il nome di ciò a cui serve, come il portatile o Claude, e scegli **Sola lettura** o **Lettura e scrittura**.
3. Copia il token. Mitra ne conserva solo un'impronta, quindi viene mostrato solo questa volta.

Un token agisce a tuo nome finché non lo revochi nella stessa lista, che mostra anche quando ciascuno è stato usato l'ultima volta. Un token di sola lettura offre allo strumento solo ciò che legge.

Senza accesso con account, Mitra è per una sola persona e non chiede alcun token: basta l'indirizzo. Chiunque possa raggiungere quell'indirizzo può allora usarlo, quindi tieni privato un server del genere.

Molti strumenti sanno anche configurarsi da soli: chiedi a Claude Code o a Cursor di collegarsi all'indirizzo con il token, e scriverà la propria configurazione. Gli esempi qui sotto fanno lo stesso a mano, e tralasciano l'intestazione `Authorization` dove non serve un token.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Aggiungi Mitra a `.cursor/mcp.json` in un progetto, oppure a `~/.cursor/mcp.json` per tutti:

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

Claude Desktop raggiunge un indirizzo con un token tramite `mcp-remote`, che richiede Node.js. Aggiungilo a `claude_desktop_config.json`:

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

## Cosa può fare uno strumento collegato

Uno strumento collegato lavora con i tuoi calendari come faresti tu in Mitra. Può:

- guardare un giorno o una settimana, con ciò che è scaduto e ciò che è ancora non pianificato
- trovare voci e leggerle per intero
- creare, modificare, completare ed eliminare voci, una singola occorrenza di una voce ricorrente o tutte
- invitare persone dove il calendario accoglie [partecipanti](participants.md); se vengono avvisate dipende dal provider
- collegare voci come [dipendenze](dependencies.md) e [attività secondarie](subtasks.md)
- creare ed eliminare calendari dove il provider lo consente

Legge tutti i tuoi calendari, compresi quelli che hai nascosto nella barra laterale, e conosce il tuo fuso orario e la lingua e la regione che hai scelto in **Impostazioni → Generale**, così può esprimere le tue date come le scrivi tu.

> [!CAUTION]
> Le voci arrivano da calendari in cui possono scrivere anche altre persone, come un calendario condiviso o un invito. Il loro testo arriva allo strumento come qualsiasi altra cosa che legge, quindi dai un token che scrive solo a uno strumento di cui ti fideresti anche con il biglietto di uno sconosciuto davanti.

## Nel browser

Dove l'assistente del browser stesso può usare ciò che una pagina offre (WebMCP, una funzione ancora agli inizi di Chrome), un Mitra aperto offre lo stesso, senza nulla da configurare.

## Disattivarlo

Imposta [`MITRA_MCP`](configuration.md) su `off` e nessuno strumento può collegarsi. La [demo](https://demo.mitracal.com) non accetta mai collegamenti.
