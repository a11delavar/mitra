---
title: Attività secondarie
description: "Suddividi un'attività in attività secondarie o in un elenco di controllo, segui il suo avanzamento, e concludi, sposta o elimina un intero albero di attività in una volta."
---

Un'attività può avere delle **attività secondarie**: attività più piccole che insieme la compongono. Un'attività secondaria può stare in un altro calendario, perfino in un altro account, può avere a sua volta attività secondarie e può essere [non pianificata](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Un'attività con un elenco di controllo nella descrizione e un'attività secondaria conclusa, contate come 1/1" />
</picture>

## Aggiungere un'attività secondaria

Apri l'attività più piccola, premi **＋** su **Attività secondaria di** e scrivi una parte del titolo dell'attività più grande. La ricerca copre tutti i tuoi calendari. L'attività più grande la elenca poi sotto **Attività secondarie**, con il conteggio di quante sono completate, come 1/3. Il collegamento si aggiunge sempre dall'attività secondaria: la riga **Attività secondarie** dell'attività più grande si limita a elencarle.

Ogni attività secondaria nell'elenco mostra la propria casella con il [colore del suo calendario](calendars.md#recolor), così puoi spuntarla senza lasciare l'attività più grande. Le attività secondarie completate e annullate sono barrate. Clicca su un titolo per aprire quell'attività, oppure premi la **✕** accanto per rimuovere il collegamento, da entrambi i lati. Nel calendario, una linea unisce un'attività alle sue attività secondarie quando sono entrambe in vista.

Mitra rifiuta un collegamento che andrebbe in cerchio, come un'attività che finisce per essere attività secondaria di se stessa.

## Elenchi di controllo

La descrizione di un'attività può contenere anche un elenco di controllo, scritto in Markdown:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Spunta una casella direttamente nella descrizione per segnarla. Mitra cambia `[ ]` in `[x]` nel testo, così lo vedono anche le altre app che usano il calendario. Spuntare le caselle non cambia mai da solo lo stato dell'attività. Solo le attività contano i propri elenchi di controllo: le caselle di un evento si possono spuntare, ma non contano per nulla.

## Avanzamento

Un'attività con attività secondarie o un elenco di controllo mostra il proprio avanzamento. Ogni attività secondaria e ogni casella conta come un passaggio, tutti con lo stesso peso, quindi un'attività con tre caselle e due attività secondarie ha cinque passaggi.

Un'attività secondaria in parte completata conta in parte, che abbia un avanzamento proprio o attività secondarie proprie. Se un'attività ha tre attività secondarie, due completate e la terza all'80%, l'attività è al 93%. Le attività secondarie annullate non contano, così il lavoro abbandonato non frena mai l'attività. Anche gli eventi collegati come attività secondarie non contano.

Nel calendario, il contorno della casella di un'attività si riempie man mano che procede. Passa il puntatore sulla casella per vedere il conteggio, come «2 di 3 attività secondarie completate», o «2 di 4 passaggi completati» quando caselle e attività secondarie contano insieme. Fai clic con il tasto destro, oppure <kbd>Alt</kbd>-clic, per aprire il menu dello stato con la percentuale esatta.

## Impostare l'avanzamento a mano

Un'attività senza attività secondarie e senza elenco di controllo può avere un avanzamento impostato da te. Fai clic con il tasto destro sulla sua casella, oppure <kbd>Alt</kbd>-clic, e trascina **Avanzamento** a passi del 5%. Al 100%, l'attività diventa **Fatto**. Sotto il 100%, un'attività completata torna a **In corso**, o a **Da fare** allo 0%. La **✕** accanto al valore lo cancella.

Il calendario deve poter memorizzare l'avanzamento: i [server di calendario](integrations/caldav.md), [Apple Calendar](integrations/apple.md) e i [calendari Mitra](integrations/mitra.md) possono. Google Calendar, Notion e Tempo no, quindi le loro attività non hanno il cursore **Avanzamento**.

## Concludere un albero di attività

Quando spunti l'ultima attività secondaria aperta, Mitra chiede se segnare come completata anche l'attività più grande. Se questo conclude altre attività più in alto, offre di segnarle tutte come completate. Chiede solo quando anche l'elenco di controllo dell'attività più grande è spuntato per intero.

Quando segni un'attività come completata o annullata mentre alcune sue attività secondarie sono ancora aperte, Mitra chiede cosa farne: **Segna come completata** o **Segna come annullata**. Chiudi la domanda per lasciarle aperte. Puoi tornarci più tardi: nel menu dello stato dell'attività, il conteggio delle attività secondarie porta alla stessa domanda.

## Spostare o eliminare un'attività con attività secondarie

Quando trascini un'attività con attività secondarie su un altro orario, Mitra chiede **Spostare anche le attività secondarie?**. Scegli **Solo questa voce**, oppure sposta l'attività con tutte le sue attività secondarie della stessa quantità di tempo. Eliminare un'attività del genere chiede allo stesso modo **Eliminare anche le attività secondarie?**.

> [!TIP]
> Tieni premuto <kbd>Ctrl</kbd> (<kbd>⌘</kbd> su un Mac) mentre rilasci o elimini per saltare la domanda e modificare solo quell'attività. Vedi le [scorciatoie da tastiera](shortcuts.md).

## Quali calendari lo supportano

Un collegamento viene salvato con l'attività secondaria, nel calendario di quella voce. I [server di calendario](integrations/caldav.md), [Apple Calendar](integrations/apple.md) e i [calendari Mitra](integrations/mitra.md) conservano qualsiasi collegamento, e su un server di calendario viene scritto nel formato standard dei calendari, così le altre app che usano lo stesso calendario possono leggerlo.

- In [Notion](integrations/notion.md), un collegamento a un'attività dello stesso database va nella proprietà di relazione corrispondente, come «Parent task». Mitra conserva da sé i collegamenti a qualsiasi altra cosa.
- [Google Calendar](integrations/google.md) scarta i collegamenti, quindi a una voce di un calendario Google non si può assegnare un'attività principale. Le voci di altri calendari possono comunque collegarsi a essa.
- Gli [abbonamenti a un calendario](integrations/subscriptions.md) sono di sola lettura, e [Tempo](integrations/tempo.md) non ha collegamenti.
