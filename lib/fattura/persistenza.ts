// =============================================================================
//  persistenza.ts — Porta di persistenza (salvataggio fatture).
//
//  Anche qui un'interfaccia, così il flusso si testa in memoria adesso e usa
//  Supabase nella tua app, senza cambiare la logica di emissione.
// =============================================================================

export interface RecordRiga {
  numeroLinea: number;
  descrizione: string;
  quantita: number;
  unitaMisura?: string;
  prezzoUnitario: number;
  prezzoTotale: number;
  aliquotaIva: number;
  natura?: string;
  articoloId?: string;
}

export interface RecordFattura {
  aziendaId: string;
  clienteId?: string;
  numero: string;
  data: string;
  xml: string;
  nomeFile: string;
  imponibile: number;
  imposta: number;
  totale: number;
  stato: string;          // StatoSdi oppure 'bozza'
  sdiId?: string;
  sdiStatus?: string;
  sdiMessage?: string;
  righe: RecordRiga[];
}

export interface PatchEsito {
  stato: string;
  sdiStatus?: string;
  sdiMessage?: string;
}

export interface Persistenza {
  /** Numero progressivo atomico per (azienda, anno). */
  prossimoNumero(aziendaId: string, anno: number): Promise<number>;
  /** Salva fattura + righe, ritorna l'id. */
  salvaFattura(rec: RecordFattura): Promise<string>;
  /** Aggiorna stato/esito SdI di una fattura. */
  aggiornaEsito(fatturaId: string, patch: PatchEsito): Promise<void>;
  /** Comodo per i test. */
  leggi?(fatturaId: string): Promise<RecordFattura & { id: string }>;
}

// ---------------------------------------------------------------------------
//  In memoria — per test e sviluppo locale.
// ---------------------------------------------------------------------------
export class PersistenzaMemoria implements Persistenza {
  private numerazione = new Map<string, { anno: number; prossimo: number }>();
  private fatture = new Map<string, RecordFattura & { id: string }>();
  private seq = 0;

  async prossimoNumero(aziendaId: string, anno: number): Promise<number> {
    const cur = this.numerazione.get(aziendaId);
    const numero = !cur || cur.anno !== anno ? 1 : cur.prossimo;
    this.numerazione.set(aziendaId, { anno, prossimo: numero + 1 });
    return numero;
  }

  async salvaFattura(rec: RecordFattura): Promise<string> {
    const id = 'F' + ++this.seq;
    this.fatture.set(id, { ...rec, id });
    return id;
  }

  async aggiornaEsito(fatturaId: string, patch: PatchEsito): Promise<void> {
    const f = this.fatture.get(fatturaId);
    if (!f) throw new Error('fattura non trovata: ' + fatturaId);
    f.stato = patch.stato;
    if (patch.sdiStatus) f.sdiStatus = patch.sdiStatus;
    if (patch.sdiMessage) f.sdiMessage = patch.sdiMessage;
  }

  async leggi(fatturaId: string) {
    const f = this.fatture.get(fatturaId);
    if (!f) throw new Error('fattura non trovata: ' + fatturaId);
    return f;
  }
}
