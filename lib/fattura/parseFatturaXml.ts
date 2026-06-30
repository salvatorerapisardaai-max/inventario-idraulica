// =============================================================================
//  parseFatturaXml.ts
//  Inverso di generaXmlFattura.ts: legge una FatturaPA (1.2.x) e restituisce
//  i dati strutturati di una fattura ricevuta da un fornitore.
//
//  Implementazione regex-based: niente dipendenze, gestisce sia prefisso `p:`
//  sia versione senza prefisso. Per fatture standard funziona bene; per casi
//  esotici (CDATA, valori escape complessi) si puo' passare a un vero parser.
// =============================================================================

export interface ParsedRiga {
  numeroLinea: number;
  descrizione: string;
  codiceArticoloXml?: string;
  quantita: number;
  unitaMisura?: string;
  prezzoUnitario: number;
  prezzoTotale: number;
  aliquotaIva: number;
}

export interface ParsedAnagrafica {
  partitaIva?: string;
  codiceFiscale?: string;
  denominazione?: string;
  nome?: string;
  cognome?: string;
}

export interface ParsedFattura {
  numero: string;
  data: string;
  tipoDocumento?: string;
  divisa?: string;
  cedente: ParsedAnagrafica; // chi ha emesso (il fornitore, per il ciclo passivo)
  cessionario: ParsedAnagrafica;
  righe: ParsedRiga[];
  imponibile: number;
  imposta: number;
  totale: number;
}

// ---------------------------------------------------------------------------
// utility minimali
// ---------------------------------------------------------------------------
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** Estrae il contenuto del primo tag con quel nome (con o senza namespace). */
function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`);
  const m = xml.match(re);
  return m ? decode(m[1]) : null;
}

/** Estrae tutti i blocchi di un tag (per le righe, i riepiloghi, ecc.). */
function tagsAll(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

const num = (s: string | null) => (s == null ? 0 : Number(s.replace(',', '.')));

function parseAnagrafica(blocco: string): ParsedAnagrafica {
  const fiscale = tag(blocco, 'IdFiscaleIVA');
  const ana = tag(blocco, 'Anagrafica') ?? '';
  return {
    partitaIva: fiscale ? tag(fiscale, 'IdCodice') ?? undefined : undefined,
    codiceFiscale: tag(blocco, 'CodiceFiscale') ?? undefined,
    denominazione: tag(ana, 'Denominazione') ?? undefined,
    nome: tag(ana, 'Nome') ?? undefined,
    cognome: tag(ana, 'Cognome') ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// API principale
// ---------------------------------------------------------------------------
export function parseFatturaXml(xml: string): ParsedFattura {
  const header = tag(xml, 'FatturaElettronicaHeader') ?? '';
  const body   = tag(xml, 'FatturaElettronicaBody') ?? xml;

  // anagrafiche
  const cedBlocco = tag(header, 'CedentePrestatore') ?? '';
  const cesBlocco = tag(header, 'CessionarioCommittente') ?? '';
  const cedente = parseAnagrafica(tag(cedBlocco, 'DatiAnagrafici') ?? cedBlocco);
  const cessionario = parseAnagrafica(tag(cesBlocco, 'DatiAnagrafici') ?? cesBlocco);

  // dati documento
  const dgd = tag(body, 'DatiGeneraliDocumento') ?? '';
  const numero = tag(dgd, 'Numero') ?? '';
  const data   = tag(dgd, 'Data') ?? '';
  const tipoDocumento = tag(dgd, 'TipoDocumento') ?? undefined;
  const divisa = tag(dgd, 'Divisa') ?? undefined;
  const totale = num(tag(dgd, 'ImportoTotaleDocumento'));

  // righe
  const beni = tag(body, 'DatiBeniServizi') ?? '';
  const righe: ParsedRiga[] = tagsAll(beni, 'DettaglioLinee').map((d) => ({
    numeroLinea: Number(tag(d, 'NumeroLinea') ?? '0') || 0,
    descrizione: tag(d, 'Descrizione') ?? '',
    codiceArticoloXml: tag(d, 'CodiceValore') ?? undefined,
    quantita: num(tag(d, 'Quantita')) || 1,
    unitaMisura: tag(d, 'UnitaMisura') ?? undefined,
    prezzoUnitario: num(tag(d, 'PrezzoUnitario')),
    prezzoTotale:   num(tag(d, 'PrezzoTotale')),
    aliquotaIva:    num(tag(d, 'AliquotaIVA')),
  }));

  // riepiloghi
  let imponibile = 0;
  let imposta = 0;
  for (const r of tagsAll(beni, 'DatiRiepilogo')) {
    imponibile += num(tag(r, 'ImponibileImporto'));
    imposta    += num(tag(r, 'Imposta'));
  }

  return {
    numero, data, tipoDocumento, divisa,
    cedente, cessionario,
    righe,
    imponibile: Math.round(imponibile * 100) / 100,
    imposta: Math.round(imposta * 100) / 100,
    totale,
  };
}
