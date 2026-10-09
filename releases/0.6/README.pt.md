---
title: Calendários no Mitra, vista de tabela, datas de vencimento
---
Esta versão dá ao Mitra calendários próprios, dispõe suas entradas em uma tabela e dá às tarefas as restrições que lhes faltavam: uma data de vencimento, uma estimativa e as horas que você mantém livres. Ele também fala persa, calendário incluído.

## Calendários do Mitra
Um calendário pode viver no próprio Mitra, sem conta por trás e sem nada em que entrar. Instale o Mitra, adicione um calendário e comece a planejar. Ele aparece em todos os dispositivos que você usa, e as entradas dele podem passar para uma conta conectada sempre que você conectar uma.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="calendars-detail-dark.webp">
	<img src="calendars-detail-light.webp" alt="Calendários na barra lateral">
</picture>

Documentação: [Calendários do Mitra](../../docs/integrations/mitra.md)

## Vista de tabela
Cada entrada como uma linha. Escolha os dias a listar, do último mês até tudo o que você tem, pesquise em títulos, locais e descrições, ordene por várias colunas ao mesmo tempo e filtre por estado, calendário, tipo ou repetição. Selecione linhas para alterar muitas de uma vez. O título é o mesmo chip que o calendário desenha, então uma entrada abre ali mesmo.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="table-detail-dark.webp">
	<img src="table-detail-light.webp" alt="A vista de tabela, com uma coluna para quando, calendário, estado e participantes">
</picture>

Documentação: [Vista de tabela](../../docs/views/table.md)

## Datas de vencimento e estimativas
Uma tarefa pode ter uma data de vencimento e uma estimativa antes de ter uma hora. As tarefas sem agendamento se alinham no Planeamento pelo que vence primeiro, e quando você arrasta uma para a semana, a estimativa vira a duração dela. As tarefas que passaram do seu dia se reúnem em uma seção Em atraso acima delas.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="Uma tarefa arrastada do Planeamento para a semana, onde a estimativa vira a duração">
</picture>

Documentação: [Planeamento](../../docs/planning.md)

## Listas de verificação nas descrições
A descrição de uma tarefa pode ter uma lista de verificação, escrita em Markdown, e as caixas são de verdade: marque uma no editor e o Mitra a grava de volta no texto, de modo que todos os outros aplicativos desse calendário também a veem. Caixas e subtarefas contam juntas, cada uma um passo: uma tarefa com três caixas e uma subtarefa tem quatro, e com uma caixa marcada e a subtarefa concluída o menu de estado dela mostra 2 de 4 passos concluídos, enquanto o anel do chip se preenche até a metade.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="checklist-dark.webp">
	<img src="checklist-light.webp" alt="A lista de verificação de uma tarefa e sua subtarefa, contadas juntas como 2 de 4 passos no menu de estado">
</picture>

Documentação: [Subtarefas](../../docs/subtasks.md)

## Disponibilidade
Desenhe as horas em que você trabalha, treina ou mantém livres, em qualquer calendário. Elas sombreiam a vista semanal para que as horas livres se destaquem. As ocupadas aparecem como ocupadas para as pessoas com quem você divide um calendário, e as livres continuam só suas.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="availability-detail-dark.webp">
	<img src="availability-detail-light.webp" alt="Janelas de disponibilidade sombreando uma semana">
</picture>

Documentação: [Disponibilidade](../../docs/availability.md)

## Calendário persa
O Mitra fala persa, e junto com o idioma vem o seu calendário: meses e semanas persas nos cabeçalhos e nos seletores, e datas digitadas do jeito que o persa as escreve. Suas entradas continuam onde estão. Só muda a forma como elas se leem.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="persian-calendar-detail-dark.webp">
	<img src="persian-calendar-detail-light.webp" alt="O editor de entradas em persa, com o seletor de datas aberto em um mês persa">
</picture>

Documentação: [Configurações](../../docs/settings.md)

## Links em uma só linha
Todo link na descrição ou no local de uma entrada se reúne em uma linha Links do editor, nomeado por onde leva: uma página pelo seu site, uma reunião pelo seu serviço, uma nota pelo seu aplicativo. Um local que é um link aparece como esse link.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="links-detail-dark.webp">
	<img src="links-detail-light.webp" alt="A linha Links de uma entrada">
</picture>

Documentação: [Links](../../docs/links.md)

## Colaboradores
- [@a11delavar](https://github.com/a11delavar)
