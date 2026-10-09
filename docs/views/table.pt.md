---
title: Vista de tabela
sidebar:
  label: Tabela
description: As suas entradas em linhas. Escolha os dias a listar, ordene e filtre, e altere várias de uma vez.
---

A vista **Tabela** lista as suas entradas em linhas em vez de desenhá-las numa grade. Abra-a com <kbd>S</kbd> ou no seletor de vistas.

Cada linha é uma entrada, e cada ocorrência de uma entrada recorrente ganha uma linha própria. O seu título é o mesmo chip que o calendário desenha: clique nele para abrir o editor da entrada.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/table-detail-dark.webp">
  <img src="../../assets/screenshots/table-detail-light.webp" alt="A vista de tabela, com uma coluna para quando, calendário, estado e participantes" />
</picture>

## Que entradas

A tabela lista as entradas de um intervalo de dias contado a partir de hoje, indicado no título da página: **Últimos 30 dias**, **Hoje**, **Próximos 7 dias**, **Próximos 30 dias** (onde ele começa), **Próximos 12 meses**, **Todas as entradas**, ou um **Intervalo personalizado** de duas datas. Escolha-o no menu da coluna **Quando**. O número ao lado do campo de pesquisa é a quantidade de linhas listadas.

As tarefas sem data, e as tarefas abertas que estão em atraso, são listadas qualquer que seja o intervalo escolhido, de modo que o padrão mostra juntos o backlog e o próximo mês.

**Todas as entradas** serve para arrumar. Uma entrada recorrente é uma só linha ali, que representa a série inteira: o seu **Quando** indica onde ela começa, e mover ou excluir a linha move ou exclui todas as ocorrências. O seu estado fica em cada ocorrência, por isso os botões de estado a ignoram.

**Hoje** no cabeçalho da página, e <kbd>G</kbd> para outra data, rolam até a primeira linha desse dia sem alterar o intervalo.

## Pesquisar, ordenar e filtrar

O campo de **pesquisa** compara cada palavra que você digita com o título, o local, a descrição e o calendário.

Clique no cabeçalho de uma coluna para abrir o seu menu:

- **Ordenar de forma crescente** ou **Ordenar de forma decrescente**. Escolha de novo a que está ativa para removê-la. Segure <kbd>Shift</kbd> para ordenar por várias colunas.
- O **filtro** da coluna, quando tem um: desmarque os valores a deixar de fora. Segure <kbd>Alt</kbd> para manter apenas aquele em que você clicar. O **Sem estado** do filtro de **Estado** representa os eventos, por isso desmarcá-lo lista apenas tarefas.
- **Ocultar coluna**, que também retira o filtro da coluna.

As colunas **Estado**, **Calendário**, **Tipo** e **Repete-se** podem filtrar, e **Quando** guarda o intervalo de dias. Um funil ao lado de um cabeçalho mostra que a coluna está deixando linhas de fora. **Título** e **Quando** não podem ser ocultadas.

## Colunas

A tabela começa com **Título**, **Quando**, **Calendário**, **Estado**, **Local**, **Participantes**, **Subtarefa de** e **Bloqueado por**. O botão no fim da linha de cabeçalhos mostra as outras (**Duração**, **Tipo**, **Repete-se**, **Lembretes** e **Descrição**), e **Redefinir colunas** restaura as predefinições.

Cada coluna tem a largura do seu conteúdo. Arraste um cabeçalho para mover a sua coluna, e a sua borda para redimensioná-la; clique duas vezes na borda para ajustar de novo a coluna ao seu conteúdo.

## Alterar várias de uma vez

Clique em uma linha para selecioná-la, segure <kbd>Ctrl</kbd> (<kbd>⌘</kbd>) para adicionar linhas, <kbd>Shift</kbd> para selecionar um intervalo, ou use as caixas de seleção. Uma barra acima das linhas oferece então:

- **A fazer**, **Concluído** e **Cancelado** para as tarefas selecionadas;
- **Mover para…** outro calendário;
- **Excluir**, após perguntar.

Para uma entrada recorrente, isso altera apenas a ocorrência selecionada, exceto em **Todas as entradas**, onde a linha é a série inteira. Para alterar uma série a partir de qualquer outro intervalo, abra o seu editor.

Com o teclado, <kbd>Space</kbd> seleciona a linha em que você está e <kbd>Enter</kbd> a abre. <kbd>Escape</kbd> limpa a seleção e <kbd>Delete</kbd> a exclui.

## Novas entradas

**Criar** no cabeçalho da página, ou <kbd>C</kbd>, inicia uma entrada para hoje e a abre como uma linha da tabela.
