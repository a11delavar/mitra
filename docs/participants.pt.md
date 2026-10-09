---
title: Participantes
description: "Adicione as pessoas envolvidas em uma entrada e acompanhe as respostas delas. Se elas recebem um convite depende do calendário."
---

Uma entrada pode ter **participantes**: as pessoas envolvidas nela. O Mitra os salva com a entrada no formato padrão de calendário, então todos os outros aplicativos que usam o mesmo calendário veem a mesma lista, e as respostas dadas no Apple Calendar, no Thunderbird ou em um webmail também aparecem no Mitra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Uma entrada com três participantes, com as respostas deles mostradas como emblemas nos avatares" />
</picture>

## Quem envia os convites

O Mitra nunca envia e-mail por conta própria. O que acontece quando você adiciona alguém depende do calendário em que a entrada está.

Quando a entrada está em um calendário de um [servidor de calendário](integrations/caldav.md), do [Google Calendar](integrations/google.md) ou do [Apple Calendar](integrations/apple.md), é esse servidor que faz o envio: o convite, uma atualização quando a entrada muda e um cancelamento quando você remove alguém ou exclui a entrada. Ele também recolhe as respostas, e é assim que elas chegam ao Mitra. A maioria dos servidores faz isso, incluindo Google, iCloud, Nextcloud, Fastmail, mailbox.org e Zimbra. Um servidor que só guarda calendários não envia nada, então ninguém fica sabendo da entrada e toda resposta continua pendente.

Em um [calendário do Mitra](integrations/mitra.md), não há servidor por trás do calendário, então a lista é apenas um registro de quem está envolvido. Ninguém é convidado e nenhuma resposta chega.

Os calendários do [Notion](integrations/notion.md) e do [Tempo](integrations/tempo.md) não guardam participantes, então as entradas deles não têm a linha de participantes. Em uma [subscrição de calendário](integrations/subscriptions.md), você pode ver os participantes, mas não alterá-los, já que o calendário é somente leitura.

## Adicionar pessoas

Abra a entrada, digite um endereço de e-mail em **Adicionar participantes** e pressione Enter. Você pode adicionar vários de uma vez, separados por vírgulas, ponto e vírgulas ou espaços. Para adicionar mais depois, pressione **＋** ao lado da contagem de participantes.

Em um calendário com uma conta por trás, a primeira pessoa que você adiciona faz de você o **organizador**: seu próprio endereço entra na lista, marcado como **Organizador**, como aceito. Um calendário do Mitra não tem endereço seu para usar, então as listas dele não têm organizador.

Cada pessoa aparece com a inicial, o e-mail, o nome se o calendário o conhecer, e **Organizador** ou **Opcional** quando for o caso. Os e-mails são selecionáveis, então você pode copiar um único endereço da linha dele. Quando a lista tem mais de cinco pessoas, ela mostra as quatro primeiras e recolhe o resto atrás de uma linha de "mais".

Aponte para uma pessoa para alterá-la. Um botão a marca como opcional, ou obrigatória de novo, e o **✕** a remove. Em uma tela de toque, esses botões ficam sempre visíveis.

## Respostas

Um emblema na inicial de cada pessoa mostra a resposta: um visto verde para aceito, uma cruz vermelha para recusado e um traço amarelo para provisório. Sem emblema, ainda não há resposta. Uma linha sob a contagem as resume, como "2 sim, 1 não, 3 aguardando".

As respostas chegam ao Mitra pelo servidor de calendário, então uma nova aparece na próxima sincronização, não instantaneamente.

O Mitra mostra a resposta de todos, mas não envia a sua. Para aceitar ou recusar um convite que outra pessoa enviou, responda no seu aplicativo de e-mail ou em outro aplicativo de calendário, e sua resposta é sincronizada de volta com o Mitra.

## Agir sobre todos

O menu **⋯** ao lado da contagem age sobre a lista inteira:

- **Enviar e-mail aos participantes** abre seu aplicativo de e-mail com uma mensagem para todos os outros.
- **Copiar e-mails dos participantes** copia todos os endereços.
- **Marcar todos como obrigatórios** e **Marcar todos como opcionais** mudam o papel de todos de uma vez.
- **Remover todos** esvazia a lista.

## Só o organizador altera a lista

Em uma entrada organizada por outra pessoa, você não pode adicionar, remover nem alterar pessoas: o **＋** fica oculto e o menu só envia e-mail e copia. Essa é a regra do padrão de agendamento que os aplicativos de calendário seguem, e o servidor do Mitra também recusa uma alteração assim. Você ainda pode editar o resto da entrada, como o título, o horário e a descrição.

> [!CAUTION]
> Mover uma entrada com participantes para outro calendário a exclui do primeiro, e alguns servidores então avisam aos participantes que ela foi cancelada. [Copie-a](calendars.md#move-or-copy-every-entry-to-another-calendar) em vez disso se eles não devem ficar sabendo.

## Solução de problemas

- Se todos continuam aguardando e nenhum convite chegou, a entrada está em um calendário do Mitra, ou o servidor de calendário dela não envia convites. Para verificar o servidor, convide as mesmas pessoas pelo aplicativo do próprio provedor.
- Se uma resposta chegou mas o emblema não mudou, espere a próxima sincronização do Mitra, já que as respostas chegam pelo servidor de calendário.
- Se não há como adicionar pessoas, outra pessoa organiza a entrada, ou o calendário é somente leitura.
- Se a entrada não tem a linha de participantes, o calendário dela não guarda participantes, como no Notion e no Tempo.
- Se uma sala de reunião não aparece na lista, é de propósito: salas e equipamentos não são pessoas, então o Mitra os deixa de fora.
