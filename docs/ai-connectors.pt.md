---
title: Conectores de IA
description: Conecte ferramentas de IA como Claude ou Cursor ao Mitra, para que possam ler e alterar seus calendários.
---

O Mitra fala o Model Context Protocol (MCP), então ferramentas de IA podem trabalhar com seus calendários: olhar sua semana, encontrar uma entrada, planejar uma tarefa, mover uma reunião. Toda ferramenta se conecta ao mesmo endereço, `https://<seu Mitra>/api/mcp`, que **Configurações → IA** mostra em **Conectores de IA**. O Claude chama uma conexão assim de conector, o Cursor e outros de servidor MCP.

Uma ferramenta conectada vê e altera exatamente o que você vê e altera no Mitra, em todos os seus calendários conectados, e uma alteração que ela faz chega ao provedor como uma sua chegaria.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="O diálogo de configurações, aberto na página IA com o endereço para conectar" />
</picture>

## Conectar uma ferramenta

Onde as pessoas [entram com uma conta](sso.md), uma ferramenta precisa de um token de acesso:

1. Abra **Configurações → IA** e escolha **Novo token** em **Tokens de acesso**.
2. Dê a ele o nome do seu uso, como o notebook ou o Claude, e escolha **Só leitura** ou **Leitura e escrita**.
3. Copie o token. O Mitra guarda só uma impressão digital dele, por isso ele é mostrado só desta vez.

Um token age em seu nome até você revogá-lo na mesma lista, que também mostra quando cada um foi usado pela última vez. Um token só de leitura oferece à ferramenta só o que lê.

Sem login, o Mitra é para uma pessoa e não pede token nenhum: o endereço basta. Qualquer pessoa que consiga chegar a esse endereço pode então usá-lo, por isso mantenha um servidor assim privado.

Muitas ferramentas também sabem se configurar sozinhas: peça ao Claude Code ou ao Cursor para se conectar ao endereço com o token, e ele escreve a própria configuração. Os exemplos abaixo fazem o mesmo à mão e deixam de fora o cabeçalho `Authorization` onde não é preciso token.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Adicione o Mitra a `.cursor/mcp.json` em um projeto, ou a `~/.cursor/mcp.json` para todos:

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

O Claude Desktop chega a um endereço com token por meio do `mcp-remote`, que precisa do Node.js. Adicione-o a `claude_desktop_config.json`:

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

## O que uma ferramenta conectada pode fazer

Uma ferramenta conectada trabalha com seus calendários como você faria no Mitra. Ela pode:

- olhar um dia ou uma semana, com o que está em atraso e o que ainda está sem agendamento
- encontrar entradas e lê-las por inteiro
- criar, alterar, concluir e excluir entradas, uma só ocorrência de uma entrada recorrente ou todas
- convidar pessoas onde o calendário guarda [participantes](participants.md); se elas são avisadas depende do provedor
- relacionar entradas como [dependências](dependencies.md) e [subtarefas](subtasks.md)
- criar e excluir calendários onde o provedor permite

Ela lê todos os seus calendários, inclusive os que você ocultou na barra lateral, e conhece seu fuso horário e o idioma e a região que você escolheu em **Configurações → Geral**, então consegue dizer suas datas do jeito que você as escreve.

> [!CAUTION]
> As entradas vêm de calendários em que outras pessoas podem escrever, como um calendário compartilhado ou um convite. O texto delas chega à ferramenta como qualquer outra coisa que ela lê, então só dê um token que escreve a uma ferramenta em que você confiaria mesmo com o bilhete de um desconhecido à frente.

## No navegador

Onde o próprio assistente do navegador pode usar o que uma página oferece (WebMCP, um recurso ainda inicial do Chrome), um Mitra aberto oferece o mesmo, sem nada para configurar.

## Desativar

Defina [`MITRA_MCP`](configuration.md) como `off` e nenhuma ferramenta consegue se conectar. A [demo](https://demo.mitracal.com) nunca aceita conexões.
