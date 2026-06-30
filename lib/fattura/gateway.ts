// =============================================================================
//  gateway.ts — Astrazione del canale di trasmissione verso il SdI.
//
//  Tutto il resto del sistema parla con questa interfaccia, MAI direttamente
//  con Aruba. Così possiamo:
//   - oggi: usare MockGateway (simulatore) e testare tutto senza credenziali
//   - Passo 4: aggiungere ArubaGateway senza toccare il resto
//   - domani (SaaS): sostituire con A-Cube/Openapi allo stesso modo
// =============================================================================

export type StatoSdi = 'inviata' | 'consegnata' | 'scartata' | 'errore';

export interface EsitoInvio {
  sdiId: string;
  stato: StatoSdi;
  messaggio?: string;
}

export interface GatewayFatture {
  /** Invia l'XML al SdI tramite il gateway. Ritorna identificativo e stato iniziale. */
  invia(xml: string, nomeFile: string): Promise<EsitoInvio>;
  /** Stato aggiornato (per polling). Con i webhook non è necessario, ma è comodo. */
  statoCorrente?(sdiId: string): Promise<EsitoInvio>;
}

// ---------------------------------------------------------------------------
//  MOCK: simula il comportamento del SdI senza inviare nulla di reale.
//  Modella le due fasi reali: prima "presa in carico" (inviata), poi l'esito
//  definitivo (consegnata oppure scartata) recuperabile via statoCorrente().
// ---------------------------------------------------------------------------
export class MockGateway implements GatewayFatture {
  private esitiFinali = new Map<string, EsitoInvio>();

  constructor(private opzioni: { forzaScarto?: boolean } = {}) {}

  async invia(_xml: string, _nomeFile: string): Promise<EsitoInvio> {
    const sdiId = 'SDI' + Math.floor(Math.random() * 1e7).toString().padStart(7, '0');

    // Esito definitivo che il "SdI" restituirà al polling/webhook successivo
    const finale: EsitoInvio = this.opzioni.forzaScarto
      ? { sdiId, stato: 'scartata', messaggio: '00404 - Fattura duplicata (simulazione)' }
      : { sdiId, stato: 'consegnata', messaggio: 'Consegna riuscita (simulazione)' };
    this.esitiFinali.set(sdiId, finale);

    // Stato iniziale: il documento è stato preso in carico
    return { sdiId, stato: 'inviata' };
  }

  async statoCorrente(sdiId: string): Promise<EsitoInvio> {
    return this.esitiFinali.get(sdiId) ?? { sdiId, stato: 'errore', messaggio: 'sdiId sconosciuto' };
  }
}
