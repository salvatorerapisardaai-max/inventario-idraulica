// =============================================================================
//  generaXmlFattura.ts
//  Generatore di fattura elettronica in formato FatturaPA 1.2.2 (B2B, FPR12).
//  Nessuna dipendenza esterna: produce una stringa XML valida da inviare poi
//  a un gateway accreditato (es. Aruba) per la trasmissione al SdI.
//
//  Pensato per il regime ORDINARIO con IVA (TipoDocumento TD01, RegimeFiscale RF01).
// =============================================================================

// ----------------------------- TIPI ----------------------------------------

export interface Anagrafica {
  denominazione?: string;       // per soggetti con ragione sociale (es. la ditta)
  nome?: string;                // per persone fisiche
  cognome?: string;
}

export interface Sede {
  indirizzo: string;
  numeroCivico?: string;
  cap: string;                  // 5 cifre
  comune: string;
  provincia?: string;           // sigla a 2 lettere (es. 'CT')
  nazione?: string;             // default 'IT'
}

/** Il CEDENTE/PRESTATORE = chi emette la fattura (la ditta). */
export interface Cedente {
  partitaIva: string;           // solo cifre, SENZA prefisso 'IT'
  codiceFiscale?: string;
  anagrafica: Anagrafica;
  regimeFiscale?: string;       // default 'RF01' (ordinario)
  sede: Sede;
}

/** Il CESSIONARIO/COMMITTENTE = il cliente che riceve la fattura. */
export interface Cessionario {
  partitaIva?: string;          // P.IVA (per aziende) ...
  codiceFiscale?: string;       // ... oppure CF (per privati). Almeno uno dei due.
  anagrafica: Anagrafica;
  sede: Sede;
  codiceDestinatario?: string;  // 7 caratteri. Se sconosciuto: '0000000' + pec
  pec?: string;
}

export interface RigaFattura {
  descrizione: string;
  quantita?: number;            // se assente la linea è trattata come 1
  unitaMisura?: string;         // es. 'pz', 'h'
  prezzoUnitario: number;       // imponibile unitario (IVA esclusa)
  aliquotaIva: number;          // es. 22  (per esente usare 0 + natura)
  natura?: string;              // obbligatorio se aliquotaIva = 0 (es. 'N2.2')
}

export interface DatiPagamento {
  condizioni?: string;          // default 'TP02' (pagamento completo)
  modalita?: string;            // default 'MP05' (bonifico)
  iban?: string;
}

export interface Fattura {
  numero: string;
  data: string;                 // formato 'YYYY-MM-DD'
  tipoDocumento?: string;       // default 'TD01'
  divisa?: string;              // default 'EUR'
  progressivoInvio?: string;    // identificativo trasmissione, default '00001'
  cedente: Cedente;
  cessionario: Cessionario;
  righe: RigaFattura[];
  bollo?: boolean;              // applica marca da bollo virtuale da 2,00 €
  pagamento?: DatiPagamento;
}

// --------------------------- UTILITY ----------------------------------------

const NS_P = 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2';
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION =
  'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 ' +
  'http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2.2/' +
  'Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Importi monetari e percentuali: il SdI vuole il punto come separatore e 2 decimali. */
function money(x: number): string {
  return round2(x).toFixed(2);
}

// ------------------------- CALCOLO TOTALI -----------------------------------

export interface RiepilogoIva {
  aliquota: number;
  natura?: string;
  imponibile: number;
  imposta: number;
}

export interface Totali {
  righe: { riga: RigaFattura; prezzoTotale: number }[];
  riepiloghi: RiepilogoIva[];
  imponibile: number;
  imposta: number;
  bollo: number;
  totale: number;
}

/** Calcola prezzi di riga, riepiloghi IVA e totale documento. Riusabile anche in UI. */
export function calcolaTotali(f: Fattura): Totali {
  const righe = f.righe.map((riga) => {
    const q = riga.quantita ?? 1;
    return { riga, prezzoTotale: round2(q * riga.prezzoUnitario) };
  });

  // Raggruppa per (aliquota | natura)
  const mappa = new Map<string, RiepilogoIva>();
  for (const { riga, prezzoTotale } of righe) {
    const key = `${riga.aliquotaIva}|${riga.natura ?? ''}`;
    const acc = mappa.get(key) ?? {
      aliquota: riga.aliquotaIva,
      natura: riga.natura,
      imponibile: 0,
      imposta: 0,
    };
    acc.imponibile = round2(acc.imponibile + prezzoTotale);
    mappa.set(key, acc);
  }

  const riepiloghi = [...mappa.values()].map((r) => ({
    ...r,
    imposta: round2((r.imponibile * r.aliquota) / 100),
  }));

  const imponibile = round2(riepiloghi.reduce((s, r) => s + r.imponibile, 0));
  const imposta = round2(riepiloghi.reduce((s, r) => s + r.imposta, 0));
  const bollo = f.bollo ? 2.0 : 0;
  const totale = round2(imponibile + imposta + bollo);

  return { righe, riepiloghi, imponibile, imposta, bollo, totale };
}

// ------------------------- GENERAZIONE XML ----------------------------------

/** Nome file richiesto dal SdI: IT<partitaIVA>_<progressivo>.xml */
export function nomeFile(f: Fattura): string {
  const prog = f.progressivoInvio ?? '00001';
  return `IT${f.cedente.partitaIva}_${prog}.xml`;
}

export function generaXmlFattura(f: Fattura): { filename: string; xml: string } {
  if (!f.righe?.length) throw new Error('La fattura deve avere almeno una riga.');
  for (const r of f.righe) {
    if (r.aliquotaIva === 0 && !r.natura) {
      throw new Error(`Riga "${r.descrizione}": con aliquota 0 è obbligatoria la Natura (es. N2.2).`);
    }
  }
  if (!f.cessionario.partitaIva && !f.cessionario.codiceFiscale) {
    throw new Error('Il cliente deve avere Partita IVA oppure Codice Fiscale.');
  }

  const t = calcolaTotali(f);
  const tipoDoc = f.tipoDocumento ?? 'TD01';
  const divisa = f.divisa ?? 'EUR';
  const regime = f.cedente.regimeFiscale ?? 'RF01';
  const prog = f.progressivoInvio ?? '00001';
  const codDest = f.cessionario.codiceDestinatario || '0000000';

  // ---- builder con indentazione leggibile ----
  const L: string[] = [];
  let ind = 1;
  const pad = () => '  '.repeat(ind);
  const open = (tag: string) => { L.push(pad() + `<${tag}>`); ind++; };
  const close = (tag: string) => { ind--; L.push(pad() + `</${tag}>`); };
  const leaf = (tag: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    L.push(pad() + `<${tag}>${esc(String(v))}</${tag}>`);
  };

  const scriviAnagrafica = (a: Anagrafica) => {
    open('Anagrafica');
    if (a.denominazione) leaf('Denominazione', a.denominazione);
    else { leaf('Nome', a.nome); leaf('Cognome', a.cognome); }
    close('Anagrafica');
  };

  const scriviSede = (s: Sede) => {
    open('Sede');
    leaf('Indirizzo', s.indirizzo);
    leaf('NumeroCivico', s.numeroCivico);
    leaf('CAP', s.cap);
    leaf('Comune', s.comune);
    leaf('Provincia', s.provincia);
    leaf('Nazione', s.nazione ?? 'IT');
    close('Sede');
  };

  // ---- intestazione XML + root con namespace ----
  L.push('<?xml version="1.0" encoding="UTF-8"?>');
  L.push(
    `<p:FatturaElettronica versione="FPR12" xmlns:p="${NS_P}" ` +
    `xmlns:ds="${NS_DS}" xmlns:xsi="${NS_XSI}" ` +
    `xsi:schemaLocation="${SCHEMA_LOCATION}">`
  );

  // =========================== HEADER =======================================
  open('FatturaElettronicaHeader');

  open('DatiTrasmissione');
  open('IdTrasmittente');
  leaf('IdPaese', 'IT');
  leaf('IdCodice', f.cedente.partitaIva);
  close('IdTrasmittente');
  leaf('ProgressivoInvio', prog);
  leaf('FormatoTrasmissione', 'FPR12');
  leaf('CodiceDestinatario', codDest);
  if (codDest === '0000000' && f.cessionario.pec) leaf('PECDestinatario', f.cessionario.pec);
  close('DatiTrasmissione');

  open('CedentePrestatore');
  open('DatiAnagrafici');
  open('IdFiscaleIVA');
  leaf('IdPaese', 'IT');
  leaf('IdCodice', f.cedente.partitaIva);
  close('IdFiscaleIVA');
  leaf('CodiceFiscale', f.cedente.codiceFiscale);
  scriviAnagrafica(f.cedente.anagrafica);
  leaf('RegimeFiscale', regime);
  close('DatiAnagrafici');
  scriviSede(f.cedente.sede);
  close('CedentePrestatore');

  open('CessionarioCommittente');
  open('DatiAnagrafici');
  if (f.cessionario.partitaIva) {
    open('IdFiscaleIVA');
    leaf('IdPaese', 'IT');
    leaf('IdCodice', f.cessionario.partitaIva);
    close('IdFiscaleIVA');
  }
  leaf('CodiceFiscale', f.cessionario.codiceFiscale);
  scriviAnagrafica(f.cessionario.anagrafica);
  close('DatiAnagrafici');
  scriviSede(f.cessionario.sede);
  close('CessionarioCommittente');

  close('FatturaElettronicaHeader');

  // ============================ BODY ========================================
  open('FatturaElettronicaBody');

  open('DatiGenerali');
  open('DatiGeneraliDocumento');
  leaf('TipoDocumento', tipoDoc);
  leaf('Divisa', divisa);
  leaf('Data', f.data);
  leaf('Numero', f.numero);
  if (f.bollo) {
    open('DatiBollo');
    leaf('BolloVirtuale', 'SI');
    leaf('ImportoBollo', money(2.0));
    close('DatiBollo');
  }
  leaf('ImportoTotaleDocumento', money(t.totale));
  close('DatiGeneraliDocumento');
  close('DatiGenerali');

  open('DatiBeniServizi');
  t.righe.forEach(({ riga, prezzoTotale }, i) => {
    open('DettaglioLinee');
    leaf('NumeroLinea', i + 1);
    leaf('Descrizione', riga.descrizione);
    if (riga.quantita !== undefined) leaf('Quantita', money(riga.quantita));
    leaf('UnitaMisura', riga.unitaMisura);
    leaf('PrezzoUnitario', money(riga.prezzoUnitario));
    leaf('PrezzoTotale', money(prezzoTotale));
    leaf('AliquotaIVA', money(riga.aliquotaIva));
    leaf('Natura', riga.natura);
    close('DettaglioLinee');
  });
  for (const r of t.riepiloghi) {
    open('DatiRiepilogo');
    leaf('AliquotaIVA', money(r.aliquota));
    leaf('Natura', r.natura);
    leaf('ImponibileImporto', money(r.imponibile));
    leaf('Imposta', money(r.imposta));
    leaf('EsigibilitaIVA', 'I');
    close('DatiRiepilogo');
  }
  close('DatiBeniServizi');

  if (f.pagamento) {
    open('DatiPagamento');
    leaf('CondizioniPagamento', f.pagamento.condizioni ?? 'TP02');
    open('DettaglioPagamento');
    leaf('ModalitaPagamento', f.pagamento.modalita ?? 'MP05');
    leaf('ImportoPagamento', money(t.totale));
    leaf('IBAN', f.pagamento.iban);
    close('DettaglioPagamento');
    close('DatiPagamento');
  }

  close('FatturaElettronicaBody');

  L.push('</p:FatturaElettronica>');

  return { filename: nomeFile(f), xml: L.join('\n') };
}
