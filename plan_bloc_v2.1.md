Impatti **contenuti**, non una riscrittura totale. Il grosso del tuo plugin era già più vicino al flusso corretto di quanto fosse il testo del regolamento, perché aveva già raccolta separata, contro-argomentazioni dopo la matrice e risoluzione successiva; la vera novità del testo rivisto è l’esplicitazione di **movimento** e **negoziazione** prima delle dichiarazioni, mentre il resto resta compatibile con la logica generale di BLOC su dichiarazioni, reazioni, risoluzione e conflitti diretti.

## Impatti forti

1. **Aggiungere la Fase di Movimento**
   - Questo è l’unico impatto davvero strutturale.
   - Devi decidere se diventa:
     - un nuovo stato della macchina prima di `raccolta`, oppure
     - un pre-step dentro `raccolta` quando la campagna usa la mappa.
   - Se vuoi minimizzare il refactor, io la tratterei come **pre-step opzionale di raccolta**, non come nuovo stato persistente.

2. **Aggiungere la Fase di Negoziazione**
   - Anche questa viene prima della raccolta delle azioni.
   - Però qui non serve per forza uno stato macchina dedicato.
   - Basta prevedere:
     - una finestra procedurale prima di `BLOC: Dichiara azione`;
     - eventualmente un campo/appunto per accordi raggiunti;
     - opzionalmente una nota strutturata che poi la matrice possa leggere.

## Impatti medi

3. **Rinominare il concetto di “argomento di vantaggio”**
   - Nel testo rivisto l’azione **non richiede necessariamente** un vantaggio di fazione.
   - Quindi il tuo campo:
     - `Argomento di vantaggio`
   - oggi è un po’ troppo stretto.
   - Io lo cambierei in qualcosa come:
     - `Base favorevole dell’azione`
     - oppure `Argomento favorevole`
   - e nella descrizione scriverei che può derivare da vantaggi, accordi, preparazione, posizione, risorse standard, fatti già stabiliti.

4. **Eliminare la logica di “fazione attiva” nelle reazioni**
   - Nel flusso rivisto prima dichiarano tutti, poi arrivano le reazioni.
   - Quindi nel plugin e nella documentazione conviene parlare di:
     - `azione dichiarata`
     - `fazione interessata`
   - invece di `fazione attiva`, almeno dalla matrice in poi.

## Impatti bassi

5. **La state machine può restare quasi identica**
   - `raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso`
   - regge ancora.
   - Al massimo diventa:
     - `movimento? → negoziazione? → raccolta → ...`
   - oppure tieni movimento/negoziazione fuori dalla macchina e li tratti come prerequisiti procedurali del turno.

6. **La parte valutazione/tiri è già sostanzialmente giusta**
   - Hai già:
     - dichiarazioni raccolte prima;
     - contro-argomentazioni dopo;
     - valutazione successiva;
     - tiri separati;
     - review narrativa finale.
   - Questa è esattamente la parte che ti conviene **non toccare**, salvo allineare le etichette.

## Dove metterei mano

Se vuoi il minimo impatto possibile, farei solo questo:

- Aggiunta opzionale di `BLOC: Movimento del turno` prima di `BLOC: Dichiara azione`.
- Aggiunta opzionale di `BLOC: Registra negoziazione` prima di `BLOC: Dichiara azione`.
- Rinomina di `Argomento di vantaggio` in `Argomento favorevole` o simile.
- Rinomina nei testi UI/documentazione di `fazione attiva` in `azione dichiarata` / `fazione interessata`.
- Nessuna modifica al core di:
  - generazione matrice,
  - contro-argomentazioni,
  - valutazione,
  - tiri,
  - review.

