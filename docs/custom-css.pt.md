---
title: CSS personalizado
description: "Mude a aparência do Mitra com seu próprio CSS: uma folha de estilo sua que acompanha sua conta, e uma para todos no servidor."
---

A aparência do Mitra é CSS comum, e você pode acrescentar o seu por cima. Esconda o que você nunca usa, coloque uma borda em volta de hoje ou dê suas cores ao servidor inteiro. Há dois lugares para isso: **Configurações → Geral → CSS personalizado** para você, e, onde as pessoas entram com uma conta, **Configurações → Administração → CSS personalizado para todos** para todos no servidor.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="O Mitra no dourado do seu logotipo, com a regra de CSS personalizado que faz isso aberta nas configurações" />
</picture>

> [!WARNING]
> Até o Mitra 1.0, qualquer atualização pode mudar os elementos, atributos e variáveis que suas regras atingem. Uma regra que funciona hoje pode parar de funcionar depois de uma atualização, ou começar a esconder alguma coisa. Mantenha sua folha de estilo curta e olhe o Mitra depois de cada atualização.

## Sua própria folha de estilo

Abra **Configurações → Geral** e digite CSS no campo abaixo de **CSS personalizado**. O Mitra aplica enquanto você digita, salva um instante depois que você para, e ela acompanha sua conta em todos os dispositivos e navegadores em que você entra.

O interruptor ao lado de **CSS personalizado** desliga sua folha de estilo sem perdê-la, e a [paleta de comandos](shortcuts.md) oferece **CSS personalizado: Desativado** e **CSS personalizado: Ativado**.

`@import` é removido ao salvar: cole uma folha de estilo inteira em vez de apontar para uma.

## A folha de estilo do servidor

Onde as pessoas entram com uma conta, quem administra o servidor pode mudar a aparência do Mitra para todos: abra **Configurações → Administração** e digite CSS na caixa abaixo de **CSS personalizado para todos**. Você vê enquanto digita, e os outros na próxima vez que carregam o Mitra. O botão ao lado o desliga para todos sem perdê-lo. A primeira pessoa a entrar em um servidor é quem o administra. Sem entrada com conta, sua própria folha de estilo já chega a todos que usam o Mitra, então só existe ela.

Ela combina com o que torna um servidor seu, como as cores, a fonte ou o [nome](configuration.md#name-your-instance) que ele já tem. A folha de estilo de cada pessoa vem depois, então a dela vence onde as duas definem a mesma coisa.

## Sua regra vence

As regras do próprio Mitra ficam numa camada de cascata chamada `mitra`, e as suas não, então uma regra sua vence a do Mitra seja qual for o seletor. Você não precisa de `!important`. As poucas declarações `!important` do próprio Mitra ficam por cima, porque as camadas as ordenam ao contrário: elas seguram o layout.

Para tirar algo que o Mitra define, em vez de pintar por cima, dê à propriedade o valor `revert`. Isto tira o fundo dos dias na vista de mês:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Exemplos

### Esconder os dias fora do mês

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

Na [vista de mês](views/month.md), isto esconde os dias antes e depois do mês exibido, a data e o fundo deles. As entradas que estão neles continuam. `visibility` mantém a grade no lugar, onde `display: none` a desmontaria. Aproxime o zoom para dar mais espaço aos dias do mês.

### Uma borda em volta de hoje

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` em vez de `border`: uma borda aumentaria o dia e deslocaria a grade.

### Suas próprias cores

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` recebe a cor do tema claro e depois a do tema escuro. Tudo o que o Mitra colore com estas variáveis acompanha, inclusive a barra de título do [app instalado](install-app.md):

| Variável | O que ela colore |
| --- | --- |
| `--color-accent` | Hoje, o que está selecionado, os anéis de foco e os botões principais |
| `--color-background-seed` | O fundo atrás de tudo; os diálogos tiram o deles dele |
| `--color-surface` | Os dias nas vistas, e o que fica sobre o fundo, como a paleta de comandos |
| `--color-text` | O texto |
| `--color-text-muted` | O texto secundário, como dicas e horários |
| `--color-error` | Erros e avisos |
| `--border-radius` | Os cantos de botões, entradas e da maioria dos controles |
| `--font-family` | A fonte do texto |

## Descobrir o que atingir

As ferramentas de desenvolvedor do navegador mostram o que está na página: clique com o botão direito em algo e escolha **Inspecionar**. Os elementos do próprio Mitra se chamam `mitra-…`, como as vistas `mitra-days` (semana), `mitra-weeks` (mês), `mitra-months` (ano), `mitra-timeline` e `mitra-table`, um dia `mitra-day`, uma entrada `mitra-entry-segment` e a barra lateral `mitra-sidebar`. Os atributos declaram fatos, como `today`, `data-outside` e `data-date`.

Botões, campos, interruptores, menus e os outros controles guardam o interior para si. Alcance-os pelas partes deles, como `mitra-switch::part(switch)`, e pelas variáveis `--mitra-…` que eles leem. Se precisar ir mais fundo, peça uma parte numa [issue](https://github.com/a11delavar/mitra/issues).

## O que deixar como está

Algumas coisas seguram o Mitra, e mudá-las o quebra:

- `display` ou `position` em `mitra-day`, ou nos `.entries` de uma vista: eles ficam numa grade que a vista inteira compartilha, e sem ela a vista de semana fica muito lenta.
- Variáveis que começam com `--_`: elas mudam a cada quadro de um zoom, e defini-las atrapalha o zoom.
- O tamanho de uma entrada: o título escolhe o layout pela largura, então dimensioná-la de fora pode trocá-lo.
- `all: unset` também desfaz o esconder, então acrescente `[hidden] { display: none }` ao lado.

## Quando uma regra esconde o caminho de volta

Acrescente `?css=off` ao endereço, como `https://mitra.example.com/?css=off`. O Mitra então carrega uma vez sem nenhuma das duas folhas de estilo, para você abrir **Configurações** e consertar a sua. Quem administra o servidor conserta a de todos do mesmo jeito.

## Antes de colar

Uma folha de estilo não executa código, mas pode carregar endereços, e uma escrita para isso pode enviar a eles o que está na sua tela. Cole só CSS que você entende. Sua folha de estilo afeta só você; a do servidor, todos nele.

## Compartilhe a sua

Abaixo da caixa, **Compartilhar no GitHub** abre uma nova discussão na categoria [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) com a sua folha de estilo já dentro. Conte o que ela faz, acrescente uma captura de tela se ela mostra algo e publique. Uma folha de estilo longa demais para o link é copiada para a sua área de transferência, para você colar na discussão. Na categoria você também encontra folhas de estilo que outras pessoas compartilharam: leia antes de colar.
