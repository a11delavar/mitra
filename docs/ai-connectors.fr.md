---
title: Connecteurs IA
description: Connectez des outils d'IA comme Claude ou Cursor à Mitra, pour qu'ils puissent lire et modifier vos agendas.
---

Mitra parle le Model Context Protocol (MCP), si bien que les outils d'IA peuvent travailler avec vos agendas : regarder votre semaine, trouver une entrée, planifier une tâche, déplacer une réunion. Chaque outil se connecte à la même adresse, `https://<votre Mitra>/api/mcp`, que **Paramètres → IA** affiche sous **Connecteurs IA**. Claude appelle une telle connexion un connecteur, Cursor et d'autres un serveur MCP.

Un outil connecté voit et modifie exactement ce que vous voyez et modifiez dans Mitra, dans tous vos agendas connectés, et une modification qu'il fait parvient au fournisseur comme la vôtre y parviendrait.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="La boîte de dialogue des paramètres, ouverte sur la page IA avec l’adresse à laquelle se connecter" />
</picture>

## Connecter un outil

Là où l'on [se connecte](sso.md), un outil a besoin d'un jeton d'accès :

1. Ouvrez **Paramètres → IA** et choisissez **Nouveau jeton** sous **Jetons d'accès**.
2. Nommez-le d'après son usage, comme l'ordinateur portable ou Claude, et choisissez **Lecture seule** ou **Lecture et écriture**.
3. Copiez le jeton. Mitra n'en garde qu'une empreinte, il n'est donc affiché que cette fois.

Un jeton agit en votre nom jusqu'à ce que vous le révoquiez dans la même liste, qui indique aussi quand chacun a servi pour la dernière fois. Un jeton en lecture seule n'offre à l'outil que ce qui lit.

Sans connexion, Mitra est pour une seule personne et ne demande aucun jeton : l'adresse suffit. Toute personne qui peut atteindre cette adresse peut alors s'en servir, gardez donc un tel serveur privé.

Beaucoup d'outils savent aussi se configurer eux-mêmes : dites à Claude Code ou à Cursor de se connecter à l'adresse avec le jeton, et il écrit sa propre configuration. Les exemples ci-dessous font la même chose à la main, et omettent l'en-tête `Authorization` là où aucun jeton n'est nécessaire.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Ajoutez Mitra à `.cursor/mcp.json` dans un projet, ou à `~/.cursor/mcp.json` pour tous :

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

Claude Desktop atteint une adresse avec un jeton via `mcp-remote`, qui nécessite Node.js. Ajoutez-le à `claude_desktop_config.json` :

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

## Ce qu'un outil connecté peut faire

Un outil connecté travaille avec vos agendas comme vous le feriez dans Mitra. Il peut :

- regarder un jour ou une semaine, avec ce qui est en retard et ce qui n'est pas encore planifié
- trouver des entrées et les lire en entier
- créer, modifier, terminer et supprimer des entrées, une seule occurrence d'une entrée récurrente ou toutes
- inviter des personnes là où l'agenda accepte des [participants](participants.md) ; qu'elles soient prévenues dépend du fournisseur
- relier des entrées en [dépendances](dependencies.md) et en [sous-tâches](subtasks.md)
- créer et supprimer des agendas là où le fournisseur le permet

Il lit tous vos agendas, y compris ceux que vous avez masqués dans la barre latérale, et connaît votre fuseau horaire ainsi que la langue et la région choisies dans **Paramètres → Général**, pour exprimer vos dates comme vous les écrivez.

> [!CAUTION]
> Les entrées viennent d'agendas où d'autres personnes peuvent écrire, comme un agenda partagé ou une invitation. Leur texte parvient à l'outil comme tout ce qu'il lit, ne donnez donc un jeton qui écrit qu'à un outil auquel vous feriez confiance même avec le mot d'un inconnu sous les yeux.

## Dans le navigateur

Là où l'assistant du navigateur lui-même peut utiliser ce qu'une page propose (WebMCP, une fonctionnalité naissante de Chrome), un Mitra ouvert propose la même chose, sans rien à configurer.

## Le désactiver

Réglez [`MITRA_MCP`](configuration.md) sur `off` et aucun outil ne peut se connecter. La [démo](https://demo.mitracal.com) n'accepte jamais de connexions.
