---
title: Verificações de integridade
description: O endpoint que informa a orquestradores, balanceadores de carga e monitores de disponibilidade se o Mitra está atendendo, e a verificação de integridade do Docker construída sobre ele.
---

O Mitra responde a uma pergunta para tudo o que o monitora: esta instância está atendendo? Pergunte neste endereço, que não exige login:

```text
GET /api/health
```

Ele verifica a única coisa sem a qual o Mitra não funciona, o banco de dados:

| Resposta | Significado |
| --- | --- |
| `200` `{"status":"ok"}` | Atendendo. O banco de dados responde. |
| `503` `{"status":"error"}` | Não está atendendo. O banco de dados não respondeu ou demorou demais. |

A resposta é propositalmente enxuta. Ela não traz versão nem detalhes de build que contariam a um desconhecido o que você executa, e nunca é guardada em cache, então cada verificação vê o estado atual.

Os serviços conectados, como um servidor CalDAV, o Notion, o Google, seu provedor de login ou o geocodificador, não fazem parte da verificação. Uma breve queda em um deles não deve marcar o próprio Mitra como não saudável.

## Docker

A imagem já traz uma verificação de integridade do Docker que usa esse endpoint, então `docker ps` e `docker inspect` mostram a integridade real do Mitra sem nada para configurar. Um contêiner novo mostra `starting` e depois `healthy` quando o banco de dados está no ar. Ela acompanha [`MITRA_PORT`](configuration.md) se você a alterou.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Aponte tanto a sonda de liveness quanto a de readiness para o endpoint:

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 10
```

## Monitores de disponibilidade

Qualquer monitor HTTP, como o Uptime Kuma, o Healthchecks.io ou a verificação do próprio balanceador de carga, pode consultar `/api/health` e tratar qualquer resposta diferente de `200` como fora do ar. Funciona do mesmo jeito com e sem [login](sso.md).
