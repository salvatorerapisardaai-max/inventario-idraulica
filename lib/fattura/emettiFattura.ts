// =============================================================================
//  emettiFattura.ts — Orchestratore dell'emissione.
//
//  Mette in fila: numerazione -> costruzione fattura -> XML -> invio gateway
//  -> salvataggio. Dipende SOLO dalle due porte (Persistenza, GatewayFatture),
//  quindi funziona identico con Mock o con Aruba.
// =============================================================================
import {
  Cedente, Cessionario, RigaFattura, DatiPagamento,
  Fattura, calcolaTotali, generaXmlFattura,
} from './generaXmlFattura';
import { GatewayFatture } from './gateway';
import { Persistenza, RecordFattura } from './persistenza';

export interface DatiEmissione {
  aziendaId: string;
  clienteId?: string;
  cedente: Cedente;       // dati della ditta (dal record `azienda`)
  cliente: Cessionario;   // dal record `clienti`
  righe: RigaFattura[];
  data?: string;          // default: oggi
  bollo?: boolean;
  pagamento?: DatiPagamento;
}

export interface Dipendenze {
  persistenza: Persistenza;
  gateway: GatewayFatture;
}

export interface RisultatoEmissione {
  fatturaId: string;
  numero: string;
  stato: string;
  totale: number;
  nomeFile: string;
  xml: string;
  sdiId?: string;
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function emettiFattura(
  input: DatiEmissione,
  deps: Dipendenze,
): Promise<RisultatoEmissione> {
  const data = input.data ?? oggiISO();
  const anno = Number(data.slice(0, 4));

  // 1) numero progressivo atomico
  const numero = String(await deps.persistenza.prossimoNumero(input.aziendaId, anno));

  // 2) costruisci la fattura e calcola i totali
  const fattura: Fattura = {
    numero,
    data,
    progressivoInvio: numero.padStart(5, '0'),
    cedente: input.cedente,
    cessionario: input.cliente,
    righe: input.righe,
    bollo: input.bollo,
    pagamento: input.pagamento,
  };
  const totali = calcolaTotali(fattura);

  // 3) genera l'XML FatturaPA
  const { filename, xml } = generaXmlFattura(fattura);

  // 4) invia tramite gateway (Mock ora, Aruba al Passo 4)
  const esito = await deps.gateway.invia(xml, filename);

  // 5) salva fattura + righe con lo stato iniziale
  const rec: RecordFattura = {
    aziendaId: input.aziendaId,
    clienteId: input.clienteId,
    numero,
    data,
    xml,
    nomeFile: filename,
    imponibile: totali.imponibile,
    imposta: totali.imposta,
    totale: totali.totale,
    stato: esito.stato,
    sdiId: esito.sdiId,
    sdiStatus: esito.stato,
    sdiMessage: esito.messaggio,
    righe: totali.righe.map((r, i) => ({
      numeroLinea: i + 1,
      descrizione: r.riga.descrizione,
      quantita: r.riga.quantita ?? 1,
      unitaMisura: r.riga.unitaMisura,
      prezzoUnitario: r.riga.prezzoUnitario,
      prezzoTotale: r.prezzoTotale,
      aliquotaIva: r.riga.aliquotaIva,
      natura: r.riga.natura,
    })),
  };
  const fatturaId = await deps.persistenza.salvaFattura(rec);

  return {
    fatturaId, numero, stato: esito.stato,
    totale: totali.totale, nomeFile: filename, xml, sdiId: esito.sdiId,
  };
}

/**
 * Da chiamare quando arriva l'esito definitivo dal SdI (via webhook o polling):
 * aggiorna lo stato della fattura. Sarà usato al Passo 5.
 */
export async function applicaEsito(
  fatturaId: string,
  esito: { stato: string; messaggio?: string },
  persistenza: Persistenza,
): Promise<void> {
  await persistenza.aggiornaEsito(fatturaId, {
    stato: esito.stato,
    sdiStatus: esito.stato,
    sdiMessage: esito.messaggio,
  });
}
