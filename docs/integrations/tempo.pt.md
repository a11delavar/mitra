---
title: Tempo
description: Veja no seu calendário as horas que você registra no Tempo, e registre, mova, redimensione e exclua essas horas pelo Mitra.
---

O [Tempo](https://www.tempo.io/) é um aplicativo de controle de horas para o Jira. O Mitra mostra seus **worklogs**, as horas que você registrou em itens do Jira, como entradas com horário no seu calendário, ao lado das reuniões e tarefas em que o tempo foi gasto.

Os worklogs são sincronizados nos dois sentidos. Mova ou redimensione uma entrada para mudar quando e por quanto tempo você trabalhou, edite a descrição para mudar a nota do worklog, exclua-a para excluir o worklog ou crie uma para registrar um novo tempo.

Você conecta pelo aplicativo com dois tokens de API. Não há nada para configurar no servidor.

## Conectar sua planilha de horas

O Mitra precisa de um token do Tempo e de um da Atlassian: o Tempo guarda as horas, e o Jira conhece os itens e quem você é.

1. Crie um token de API do Tempo. No Jira, abra as **Settings** do Tempo (o ícone de engrenagem) → **Data Access** → **API integration**, escolha **New Token**, dê a ele o nome "Mitra" e copie o token.
2. Crie um token de API da Atlassian em [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) com **Create API token** e copie-o. Crie os dois tokens como o mesmo usuário do Jira.
3. No Mitra, escolha **Adicionar integração** no fim da barra lateral, depois **Tempo**, e preencha:
   - **URL do site**, seu endereço da Atlassian, como `https://your-company.atlassian.net`.
   - **Token de API do Tempo**, o token do passo 1.
   - **E-mail da conta Atlassian**, o endereço de e-mail da sua conta Atlassian.
   - **Token de API do Atlassian**, o token do passo 2.
4. Pressione **Conectar**. O Mitra lista um calendário, **My worklogs**.
5. Deixe-o ativado e pressione **Salvar**.

O Tempo limita a frequência com que aplicativos podem chamá-lo, então o Mitra o sincroniza cerca de uma vez por minuto (veja [como funciona a sincronização](README.md#how-syncing-works)).

## Como os worklogs aparecem

O título de uma entrada é o item do Jira em que o tempo foi registrado, com a chave e o resumo dele:

```text
ACME-1234 Code review for auth migration
```

A nota do worklog é a descrição da entrada. O aplicativo do próprio Tempo os mostra do mesmo jeito, porque o item diz para que o tempo foi usado, enquanto a nota costuma ser um rótulo de atividade como "Review", ou um texto que o Jira escreveu para você, como "Working on work item ACME-1234".

O título pertence ao item, então você não pode editá-lo num worklog salvo: o Mitra não renomeia um item do Jira porque você editou uma entrada do calendário. Edite a descrição para dizer o que você fez. Se o Jira não consegue nomear o item, porque ele foi excluído ou você não pode mais vê-lo, o título mostra `#` e o ID do item, e a entrada continua funcionando.

O Tempo guarda os worklogs como horários simples de relógio, sem fuso horário. O Mitra os lê no fuso horário do seu perfil do Jira, então eles aparecem nos mesmos horários que no Tempo.

Alguns sites do Tempo desativam os horários de início. Neles, todo worklog de um dia começa no mesmo horário, então eles se empilham, mas as durações estão certas.

## Registrar tempo pelo Mitra

Crie uma entrada com horário em **My worklogs** e coloque a chave do item do Jira em qualquer lugar do título:

| Você digita | Registrado em |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

O Mitra confere a chave com os projetos do Jira que você pode ver. Se o título não tem uma chave assim, ou o Jira não tem esse item, o Mitra não registra nada e diz por quê.

A nota do worklog é o que você escreveu na descrição ou, se a deixou vazia, o título inteiro como você digitou. Depois que o tempo é registrado, o título passa a ser a chave e o resumo do item. Essa troca acontece uma vez, quando você registra, e é por isso que você pode editar o título enquanto o escreve, mas não depois.

> [!TIP]
> Para registrar tempo num item em que você já registrou antes, duplique uma das entradas dele: segure <kbd>Alt</kbd> (<kbd>⌥</kbd> no Mac) enquanto a arrasta para o novo horário, ou escolha **Duplicar** no menu **⋯** do editor dela.

## Alterar um worklog

Mover, redimensionar, excluir e editar a descrição vão direto para o Tempo. Algumas coisas para saber:

- Um worklog fica no seu item. O Tempo não consegue mover um worklog para outro item, então, para registrar o tempo em outro lugar, exclua a entrada e crie uma nova com a chave certa.
- O Mitra mantém os detalhes próprios do Tempo de um worklog, como o tempo faturável e os atributos de trabalho, quando o altera.
- Quando um período da planilha de horas é fechado ou aprovado no Tempo, o Tempo se recusa a adicionar, alterar ou excluir worklogs nele.

Para abrir o item no Jira, escolha **Abrir no Jira** no menu **⋯** do editor.

## O que um worklog não consegue guardar

Um worklog é um intervalo de tempo num único dia, registrado em um item. Assim, um calendário do Tempo guarda apenas entradas com horário: sem entradas de dia todo, repetições, lembretes, local, participantes, relações, ocupado ou disponível, visibilidade nem [disponibilidade](../availability.md). O Mitra oculta esses campos nos worklogs.

## Solução de problemas

- Se o Mitra disser "Tempo rejected the API token", crie um novo token de API do Tempo e informe-o em **⋯ → Editar** da conta.
- Se o Mitra disser "Jira rejected the e-mail and API token", verifique se o endereço de e-mail pertence à conta Atlassian que criou o token de API.
- Se os worklogs aparecem no horário errado do dia, verifique o fuso horário do seu perfil do Jira (**Account settings** → **Time zone**). Depois de mudá-lo, use **Reimportar entradas** no menu **⋯** de **My worklogs**, para que os worklogs que você já tem também se movam.
- Se os worklogs se empilham no mesmo horário todo dia, o seu site do Tempo desativou os horários de início. As horas continuam certas.
