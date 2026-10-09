---
title: Disponibilità
description: Segna il tempo che riservi al lavoro, allo studio o a qualsiasi altra cosa nel suo calendario, e mostralo come occupato agli altri quando vuoi.
---

La **disponibilità** è il tempo che metti da parte con regolarità, come il lavoro dal lunedì al mercoledì, lo studio il giovedì e il venerdì, o le faccende di casa il sabato. Mitra la colora nella vista **Settimana**, con il colore del suo calendario.

La disponibilità appartiene a un calendario, accanto agli eventi e alle attività di quel calendario. Il tuo orario di lavoro va nel calendario di lavoro, e il tempo di studio in quello dell'università. Non è un appuntamento, quindi Mitra la conserva da sé invece di aggiungerla al tuo account. La [disponibilità occupata](#busy-or-free) è l'unica eccezione.

È la forma abituale della tua settimana, non una recinzione. Un appuntamento dal dentista nel mezzo del tuo orario di lavoro non è un problema.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-detail-dark.webp">
  <img src="../assets/screenshots/availability-detail-light.webp" alt="Tre giorni della vista settimanale: orario di lavoro e tempo di studio colorati con i colori dei rispettivi calendari, con il lavoro del mercoledì pomeriggio indicato come Smart working" />
</picture>

## Con o senza nome

Senza un nome, una fascia è solo la sua tinta. Va bene per la maggior parte della disponibilità, visto che il colore del calendario dice già a cosa serve quel tempo. Se le dai un nome o un luogo, quel testo corre lungo il bordo del giorno, come Tempo di concentrazione nel tuo orario di lavoro, o Ufficio e Smart working in giorni diversi.

Dove le fasce si sovrappongono, le tinte si mescolano diventando più scure e le etichette si separano: la prima verso il suo inizio, l'ultima verso la sua fine.

## Aggiungere disponibilità

Apri la tavolozza dei comandi con <kbd>/</kbd> o <kbd>Ctrl</kbd> + <kbd>K</kbd> ed esegui **Aggiungi disponibilità**. Va nel tuo calendario predefinito:

- Se quel calendario non ha ancora disponibilità, ottieni un orario di lavoro dal lunedì al venerdì, dalle 9:00 alle 17:00.
- Altrimenti ottieni una fascia nel giorno della settimana di oggi.

Si apre l'editor, così puoi cambiare gli orari, i giorni, il nome, il luogo o il calendario. Anche una voce che non si ripete può diventare disponibilità tramite il suo **Tipo**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-editor-detail-dark.webp">
  <img src="../assets/screenshots/availability-editor-detail-light.webp" alt="L'editor del lavoro del mercoledì: il suo orario, la ripetizione settimanale, Smart working come luogo, e Disponibile" />
</picture>

## Modificare e spostare

- Clicca dentro una fascia per aprirla. Trascinare attraverso di essa crea comunque una voce normale, come su una parte vuota della griglia.
- La disponibilità si ripete come qualsiasi altra voce. Ha un fuso orario e una regola di ripetizione, e quando modifichi o elimini un suo giorno, Mitra chiede se intendi quel giorno o tutti.
- Il campo **Calendario** dell'editor la sposta in un altro calendario. Spostare le voci di un calendario con **Sposta le voci in…** porta con sé anche la sua disponibilità.
- La disponibilità compare solo nella vista Settimana. Non appare in Mese, Anno, Cronologia o Tabella, nei risultati di ricerca o nelle relazioni.

## Mostrare e nascondere

L'occhio di un calendario nella barra laterale nasconde la sua disponibilità insieme a eventi e attività. Per nascondere tutta la disponibilità e nient'altro, attiva **Nascondi la disponibilità** in **Impostazioni → Calendario**, oppure trovala nella tavolozza dei comandi.

## Dove può stare la disponibilità

Qualsiasi calendario in cui puoi aggiungere voci può contenere disponibilità, compresi i calendari [Mitra](integrations/mitra.md). Questi no:

- I calendari [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md), perché le loro voci non possono ripetersi.
- I calendari di sola lettura, come gli [abbonamenti a un calendario](integrations/subscriptions.md).

La disponibilità resta con il suo calendario. Eliminare il calendario, o scollegare l'account a cui appartiene, elimina anche la sua disponibilità.

## Occupato o disponibile

La disponibilità ha la stessa scelta **Mostra come occupato o disponibile** di un evento. Parte come **Disponibile**, che va bene per l'orario di lavoro: in quei momenti sei contento di essere prenotato. Scegli **Occupato** per il tempo che gli altri non devono occupare, come il tempo di concentrazione.

All'interno di Mitra, i due casi hanno lo stesso aspetto. La differenza è ciò che vedono gli altri. La disponibilità libera non viene mai scritta in nessuno dei tuoi account. La disponibilità occupata in un [calendario CalDAV, Google o Apple](integrations/caldav.md#busy-availability) viene aggiunta a quel calendario come eventi occupati, con il suo nome e il suo luogo, così compare sul telefono e chi ti invita vede quel tempo come impegnato.
