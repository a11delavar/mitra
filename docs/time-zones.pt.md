---
title: Fusos horários
description: Como o Mitra mostra o fuso horário próprio de uma entrada e como adicionar as horas de outros fusos horários à vista semanal.
---

O Mitra mostra os horários no seu fuso horário, aquele em que o seu dispositivo está configurado. Quando você viaja e o dispositivo muda de fuso, o Mitra acompanha. No editor, esse fuso é chamado de fuso horário **principal**.

Uma entrada também pode ter um fuso horário próprio, como um voo que parte às 9:00 em Nova York. E a vista semanal pode mostrar as horas de outros fusos horários ao lado das suas.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="O editor de uma nova entrada com o fuso horário definido como GMT+4 Dubai, mostrando 11:00 em Dubai, enquanto a entrada fica às 9:00 na semana de Berlim ao fundo" />
</picture>

## O fuso horário de uma entrada

Toda entrada com horários tem um fuso horário. As entradas que você cria usam o seu, e as entradas de outros aplicativos mantêm o fuso em que foram feitas.

Abra uma entrada para ver o seu fuso na linha com o globo, abaixo das suas datas, escrito como um deslocamento e uma cidade, como "GMT-4 New York". As entradas de dia todo não têm fuso horário nem essa linha, porque abrangem os mesmos dias para todos.

### Alterar o fuso horário de uma entrada

Clique no fuso e escolha outro. Digite uma cidade, o nome de um fuso ou um deslocamento para encontrá-lo. O seu próprio fuso encabeça a lista, marcado como **Principal**.

A entrada mantém os seus horários de relógio no novo fuso: uma reunião às 9:00 em Berlim se torna uma reunião às 9:00 em Nova York. Se apenas o fuso estava errado e a reunião em si não mudou, altere os seus horários depois.

### O seu horário ou o da entrada

Quando o fuso de uma entrada difere do seu, o editor mostra os horários dela no seu fuso, de modo que uma reunião às 9:00 em Nova York aparece como 15:00 se você está em Berlim. Um botão ao lado do fuso alterna para o horário próprio da entrada e de volta. Ele mostra uma casa enquanto você vê o seu horário e um globo enquanto vê o da entrada, e apontar para ele diz qual dos dois você está vendo.

Você pode editar os horários de qualquer uma das formas. Para alterar o fuso em si, mude primeiro para o horário da entrada.

### Horários de relógio de parede

Algumas entradas vêm de outros aplicativos sem nenhum fuso horário e mostram **Relógio de parede (sem fuso horário)**. Os seus horários não pertencem a lugar nenhum: um alarme às 7:00 vale para as 7:00 onde quer que você esteja, e o editor o mostra às 7:00 em todos os fusos horários. Os seus lembretes disparam nesse horário de relógio em cada dispositivo.

Escolher um fuso para uma entrada dessas lhe dá esse fuso e mantém os seus horários de relógio. Ela não pode voltar a ser uma entrada de relógio de parede.

### Que calendários suportam isto

- Os **calendários guardados no Mitra**, os [servidores de calendário](integrations/caldav.md) e o [Google Calendar](integrations/google.md) guardam o fuso horário de cada entrada, e os outros aplicativos o veem.
- O **[Notion](integrations/notion.md)** não tem fusos horários. Os seus horários aparecem no seu fuso, e o editor não tem linha de fuso horário.
- O **[Tempo](integrations/tempo.md)** lê os registros de trabalho no fuso horário do seu perfil do Jira, e o editor também não tem linha de fuso horário.
- As **[Assinaturas](integrations/subscriptions.md)** são somente leitura: você pode ver o fuso de uma entrada e alternar entre os dois horários, mas não alterá-lo.

## Fusos horários na vista semanal

A [vista semanal](views/week.md) pode mostrar as horas de outros fusos horários em colunas ao lado das suas, de modo que você vê que horas são lá a cada hora do seu dia.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="A vista semanal com uma coluna EDT de horas de Nova York ao lado da coluna GMT+2, de modo que 07:00 em Berlim corresponde a 01:00 em Nova York" />
</picture>

### Adicionar um fuso horário à semana

Aponte para o topo da coluna de horas e pressione **＋** (**Adicionar fuso horário**), depois escolha um fuso. A coluna dele aparece ao lado da sua, e o seu próprio fuso continua sendo a coluna junto aos dias.

Cada coluna é encabeçada por um nome curto, como "PDT" ou "GMT+2". Aponte para ele para ver o nome completo.

### Renomear ou remover um fuso horário

Clique no nome de um fuso e escolha **Renomear** para dar-lhe um rótulo próprio, como "NYC", ou **Remover** para retirar a sua coluna. Para voltar ao nome automático, renomeie-o para nada.

O seu próprio fuso pode ser renomeado, mas não removido.

### Recolher as colunas extras

As colunas extras tiram espaço dos dias. Para ocultá-las, aponte para o topo da coluna de horas e pressione a seta abaixo do **＋**. Pressione-a de novo para mostrá-las. Você também pode arrastar a coluna de horas em direção aos dias para abri-las, e de volta para fechá-las, que é a forma de fazer isso em uma tela sensível ao toque.

Em uma tela estreita, as colunas começam recolhidas até que você as abra ou feche por conta própria. Adicionar um fuso sempre as faz aparecer.

### Entre os seus dispositivos

Os fusos que você adiciona, e os seus nomes, pertencem à sua conta, por isso aparecem em todos os dispositivos que você usa. O nome que você dá ao seu próprio fuso, e se as colunas estão recolhidas, ficam em cada dispositivo, já que cada dispositivo pode estar em um fuso diferente.
