---
title: Rotinas
description: "Como o Mitra conta o que você faz com frequência, como um remédio diário ou a academia, e mostra isso como pequenas marcas nas visualizações de mês e ano."
---

Algumas coisas acontecem com tanta frequência que uma barra para cada uma encheria o mês de cópias: um treino diário, seu remédio, uma reunião rápida nos dias úteis. Nas vistas de mês e de ano, o Mitra as desenha como uma **rotina**: uma linha fina sob os dias, com uma marca em cada dia em que a rotina acontece. A aba **Rotinas** na barra lateral conta como cada rotina foi.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/month-detail-dark.webp">
  <img src="../assets/screenshots/month-detail-light.webp" alt="A vista de mês, com rotinas mostradas como pequenas marcas sob cada dia" />
</picture>

Na vista de ano, em que cada dia é pequeno, as rotinas são o que mais aparece: cada linha colorida é uma rotina que atravessa os meses.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/year-detail-dark.webp">
  <img src="../assets/screenshots/year-detail-light.webp" alt="A vista de ano, com rotinas como linhas coloridas finas sob os dias de cada mês" />
</picture>

## O que vira rotina

As entradas formam uma rotina quando estão no mesmo calendário e têm o mesmo título. O Mitra reconhece uma rotina quando as entradas são salvas ou sincronizadas, e a mantém.

- Uma entrada recorrente é uma rotina desde o início, não importa com que frequência se repita, desde que tenha pelo menos quatro datas.
- Entradas que não se repetem formam uma assim que houver pelo menos quatro delas e elas aparecerem mais ou menos a cada cinco semanas ou com mais frequência, ou mantiverem um ritmo regular, como uma vez por ano. Assim, entradas separadas chamadas "Corrida" formam uma rotina como uma série diária formaria.

Calendários que você só pode ler, como as assinaturas, não formam rotinas.

Depois que uma entrada pertence a uma rotina, ela continua nela: quando você a renomeia, a marca como concluída, move uma das suas ocorrências ou a move para outro calendário. Entradas posteriores com o mesmo título se juntam a ela, por mais distantes que estejam umas das outras. Uma cópia em outro calendário passa a fazer parte da rotina daquele calendário com o seu título. Uma entrada sem título nunca se junta a outras; se for recorrente, ela é uma rotina por si só.

A frequência de uma rotina decide como as vistas a mostram:

- Na vista de mês, uma rotina que aparece mais de uma vez por semana é mostrada como marcas. Algo semanal continua sendo uma barra.
- Na vista de ano, uma rotina que aparece mais ou menos a cada cinco semanas ou com mais frequência é mostrada como marcas, então as semanais e mensais também. Uma mais rara, como um aniversário, continua sendo uma barra.

## A aba Rotinas

Abra **Rotinas** na barra lateral, ao lado de Calendários e Planeamento, ou digite o nome na paleta de comandos. **Hoje** mostra as rotinas de hoje, pela hora, e **Mais tarde** as restantes, pela próxima data. Cada linha mostra o nome da rotina, quando ela acontece e uma faixa das suas últimas 14 ocorrências, com quantas você cumpriu.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/routines-detail-dark.webp">
  <img src="../assets/screenshots/routines-detail-light.webp" alt="A aba Rotinas na barra lateral, cada rotina com as suas últimas ocorrências e quantas foram cumpridas" />
</picture>

Cada célula da faixa é uma ocorrência:

- Uma célula cheia foi cumprida: um evento que aconteceu, ou uma tarefa que você marcou.
- Uma célula vazia foi perdida: uma tarefa que ficou em aberto depois do seu dia.
- Um traço foi cancelado, e conta como não cumprida, como uma perdida.
- Uma célula contornada é a de hoje, ainda em aberto.
- Uma célula ténue é um dia em que ela não acontece.

O Mitra só conta o que está no seu calendário. Uma ocorrência que você exclui desaparece e não conta, então para manter uma sessão pulada no histórico, cancele-a em vez de excluí-la; veja [Estado do evento](entries.md#event-status). Eventos não têm nada para marcar: um evento aconteceu, a menos que tenha sido cancelado.

O estado de hoje fica no fim da linha de uma rotina: a caixa de seleção de uma tarefa, que a marca como a do calendário, e o de um evento depois de o cancelar, para o poder mudar de novo. O selo da aba conta as tarefas de rotina ainda em aberto hoje. Um calendário que você oculta tira as suas rotinas da aba.

## O detalhe de uma rotina

Clique em uma linha para ver mais: desde quando a rotina existe, as suas últimas semanas como uma grade de dias, quantas das últimas e do último ano você cumpriu, e o dia da semana em que ela mais falha. O seu menu **⋯** oferece **Feito hoje** para uma tarefa, **Cancelado** para cancelar a ocorrência de hoje e **Mostrar no calendário** para abrir a próxima.

## Usar uma rotina

Aponte para uma rotina para ver o título e, se for uma entrada recorrente, com que frequência ela se repete. Clique nela para abrir a primeira entrada dessa linha: a semana na vista de mês, ou o mês na vista de ano.

A vista de semana sempre mostra cada entrada por inteiro, com seus horários.
