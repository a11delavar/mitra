---
title: Assinaturas de calendário
description: Assine o link de um calendário publicado, como um endereço webcal:// ou um feed .ics, e veja as entradas dele no Mitra, somente leitura.
---

Muitos calendários são publicados em vez de compartilhados: feriados públicos, jogos de um campeonato, períodos escolares, o feed de uma ferramenta do trabalho ou o endereço privado do seu próprio calendário do Google ou do Outlook. Você não faz login nesses. Você os assina com um link.

Uma **assinatura de calendário** traz um desses links para o Mitra como um calendário próprio, com os eventos dele e as tarefas, se ele tiver.

As assinaturas são somente leitura. O feed fica em outro servidor, que não aceita alterações, então o Mitra mostra o que ele publica e nunca grava de volta. Você ainda pode renomear, mudar a cor, reordenar e ocultar o calendário; veja [Calendários somente leitura](../calendars.md#read-only-calendars). Para manter uma cópia editável das entradas dele, use **Copiar as entradas para…** no menu **⋯** do calendário.

## Assinar um calendário

1. Escolha **Adicionar integração** no fim da barra lateral e depois **Subscrição de calendário**.
2. Cole o link em **URL do calendário**. Ele é um endereço `webcal://`, como os botões "Assinar" costumam dar, ou um endereço `https://`, geralmente terminado em `.ics`.
3. Deixe **Usuário (opcional)** e **Senha (opcional)** vazios, a menos que o feed peça (veja [feeds com senha](#feeds-with-a-password)).
4. Pressione **Conectar**. O Mitra lê o feed e lista o calendário dele.
5. Deixe-o ativado e pressione **Salvar**.

Um link é um calendário. Para assinar vários, adicione uma assinatura para cada um.

O calendário recebe o nome do feed e também a cor dele, se o feed tiver uma. Você pode renomeá-lo na barra lateral, e o seu nome permanece até que o próprio feed renomeie o calendário.

Se você [tornou o Mitra seu aplicativo de calendário padrão](../calendar-files.md), clicar num link `webcal://` numa página da web abre este formulário com o link preenchido.

### Onde encontrar o link de um calendário

| Provedor | Onde procurar |
| --- | --- |
| Google Calendar | Nas configurações do calendário, **Integrate calendar** → **Secret address in iCal format** |
| Outlook e Microsoft 365 | **Share** → **Publish a calendar**, depois copie o link ICS |
| iCloud | Clique com o botão direito no calendário → **Share Calendar** → **Public Calendar** |
| Nextcloud | Menu **⋯** do calendário → **Copy subscription link** |
| Calendários públicos | A maioria dos sites de feriados, esportes e escolas oferece um link `.ics` |

> [!CAUTION]
> Um endereço secreto é uma senha em forma de link: quem o tiver pode ler o calendário. Mantenha-o só para você e redefina-o nas configurações do seu provedor se ele vazar.

### Feeds com senha

A maioria dos feeds publicados leva a chave de acesso no próprio link e não precisa de mais nada. Se um feed, como um num servidor da empresa ou auto-hospedado, pedir um nome de usuário e uma senha (autenticação HTTP Basic), informe-os ao assinar. O Mitra guarda a senha no servidor e nunca a envia de volta ao seu navegador.

## Como ele se mantém atualizado

O Mitra sincroniza cada assinatura a cada 15 minutos, com o Mitra aberto ou não, então abrir o Mitra não busca um feed mais cedo (veja [como funciona a sincronização](README.md#how-syncing-works)). Uma sincronização custa pouco: o Mitra pergunta ao servidor do feed se algo mudou e só baixa o calendário quando mudou.

O calendário espelha o feed. As entradas adicionadas ao feed aparecem no Mitra, e as removidas dele desaparecem.

Se o calendário parecer errado, **Reimportar entradas** no menu **⋯** dele lê o feed de novo desde o início. O feed em si nunca é tocado. Veja [Reimportar um calendário](../calendars.md#re-import-a-calendar).

## Solução de problemas

- Se o Mitra disser "The calendar requires a username and password", o feed está protegido. Informe o nome de usuário e a senha de que ele precisa.
- Se o Mitra disser "No calendar was found at that address", verifique se o link tem erros de digitação. Um endereço secreto também deixa de funcionar quando o dono o redefine.
- Se o Mitra disser "The address did not return a calendar", o link leva a uma página da web em vez do feed. Procure um link chamado iCal, ICS ou Assinar.
- Se o Mitra disser "The calendar is too large to subscribe to", o feed tem mais de 20 MB, que o Mitra não lê.
