---
title: Logs
description: Escolha quanto o Mitra registra com MITRA_LOG_LEVEL e qual nível ajuda em cada problema.
---

O Mitra escreve os logs na saída padrão, então `docker compose logs` mostra tudo:

```bash
docker compose logs -f mitra
```

Um servidor saudável é quieto de propósito: por padrão ele só registra o que importa. Aumente o nível enquanto investiga algo e volte a reduzi-lo quando terminar.

## Defina o nível

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Cada nível inclui tudo o que é mais silencioso do que ele:

| `MITRA_LOG_LEVEL` | O que você recebe |
| --- | --- |
| `error` | Apenas falhas. |
| `warn` | Também problemas que o Mitra contornou, como um lembrete que não pôde ser entregue, um geocodificador que não respondeu ou um provedor de login que ele não conseguiu alcançar. |
| `info` *(padrão)* | Também o que importa no dia a dia: inicialização, logins, contas conectadas, mudanças sincronizadas dos provedores e lembretes enviados. |
| `debug` | Também cada requisição com seu status e tempo, cada sincronização, quando a sincronização acelera ou desacelera conforme as pessoas abrem e fecham o Mitra, sessões, edições de entradas e as conversas com servidores CalDAV. |
| `trace` | Também cada consulta ao banco de dados e os dados brutos do calendário. É muita coisa. |

O Mitra registra o nível em que está executando quando inicia.

> [!NOTE]
> Senhas, tokens e outros segredos nunca são registrados, em nenhum nível. `debug` e `trace` ainda podem mostrar títulos de entradas e dados do calendário, então leia o log antes de compartilhá-lo.

## Qual nível usar

- Quando um calendário não sincroniza, `debug` mostra cada sincronização e as requisições ao CalDAV e ao Notion.
- Quando os lembretes não chegam, `info` já registra cada lembrete ao sair, e `debug` acrescenta cada tentativa de entrega e os dispositivos que foram descartados.
- Quando você vê uma página de erro, `error` a traz com um stack trace, e o padrão `info` a inclui.
- Quando você precisa ver exatamente o que um provedor enviou, `trace` acrescenta os dados brutos e as consultas ao banco de dados. Deixe-o ativado só por pouco tempo.
