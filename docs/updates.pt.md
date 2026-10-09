---
title: Atualizações
description: Como o Mitra avisa sobre novas versões, o que essa verificação envia, como desativá-la e como atualizar.
---

O Mitra avisa quando existe uma versão mais nova do que a que você executa. Ele nunca se atualiza sozinho: baixar a nova versão fica por sua conta.

## O indicador de atualização

Quando existe algo mais novo, um pequeno ponto aparece no logotipo da barra lateral. Clique no nome da sua instância para abrir **Sobre**, que mostra a versão e o commit que você executa e traz links para as novidades. **Copiar** ali copia os detalhes da versão, que é o que um relatório de bug precisa.

**Novidades**, na [paleta de comandos](shortcuts.md#command-palette), lista as mudanças de cada versão. Depois que seu servidor é atualizado, o Mitra pede que você **Recarregue para concluir a atualização** em qualquer aba que estava aberta desde antes.

Se você executa uma versão estável (`latest`, `0.6` ou uma versão exata), ele indica a versão mais recente. Se você executa a imagem `dev`, ele indica os commits mais recentes em `main` e diz quantos à frente eles estão.

## O que a verificação envia

O servidor, nunca o seu navegador, pergunta ao GitHub algumas vezes por dia se existe algo mais novo. A requisição não leva nada sobre a sua instância além do que qualquer requisição leva: seu endereço IP e a versão em execução no user agent. Sem telemetria, sem identificadores, sem contagens.

Se o servidor não conseguir alcançar o GitHub, ele registra isso uma vez e depois fica em silêncio.

Para desativar a verificação por completo, defina `MITRA_UPDATE_CHECK` como `off` (`false`, `0` e `no` também funcionam):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Escolha uma tag de imagem

A tag decide o quanto você quer ir atrás das novas versões.

| Tag | O que você recebe |
| --- | --- |
| `latest` | A versão mais recente. |
| `0.6` | A versão `0.6.x` mais recente: correções, mas nenhuma versão menor nova. |
| `0.6.0` | Exatamente essa versão. |
| `dev` | O último commit em `main`, para experimentar antes do lançamento. |

Até a 1.0, uma nova versão menor (0.6 para 0.7) pode mudar coisas de que você depende. Se você prefere escolher quando isso acontece, use `0.6` e avance quando estiver pronto. Todas as tags estão listadas no [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Atualize o Mitra

Baixe a nova imagem e recrie o contêiner:

```bash
docker compose pull
docker compose up -d
```

Seus dados estão na pasta montada, então eles sobrevivem. Se a nova versão alterar o banco de dados, o Mitra o atualiza ao iniciar, e você nunca precisa mexer nele. Ferramentas como o [Watchtower](https://containrrr.dev/watchtower/) podem fazer isso por você em um horário programado.

A versão que você recebe depende da sua [tag de imagem](#choose-an-image-tag). Antes de passar para uma nova versão menor, vale a pena ler as [notas de versão](https://github.com/a11delavar/mitra/releases).
