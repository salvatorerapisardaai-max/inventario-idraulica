// =============================================================================
//  lib/fattura/mappers.ts
//  Traduce le righe del DB (tabelle `azienda` e `clienti`) nei tipi che il
//  generatore XML si aspetta. Necessario perché i nomi delle colonne reali
//  (p_iva, codice_sdi, paese, nome...) non coincidono con i campi del tipo.
// =============================================================================
import type { Cedente, Cessionario } from './generaXmlFattura';

/** Riga della tabella `azienda` (emittente). */
export interface RigaAzienda {
  id: string;
  denominazione: string;
  partita_iva: string;
  codice_fiscale: string | null;
  regime_fiscale: string | null;
  indirizzo: string;
  numero_civico: string | null;
  cap: string;
  comune: string;
  provincia: string | null;
  nazione: string | null;
  aliquota_iva_default: number | null;
}

/** Riga della tabella `clienti` (così com'è nel tuo DB). */
export interface RigaCliente {
  id: string;
  nome: string;
  p_iva: string | null;
  codice_fiscale: string | null;
  codice_sdi: string | null;
  pec: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  paese: string | null;
}

export function aziendaToCedente(a: RigaAzienda): Cedente {
  return {
    partitaIva: a.partita_iva,
    codiceFiscale: a.codice_fiscale ?? undefined,
    anagrafica: { denominazione: a.denominazione },
    regimeFiscale: a.regime_fiscale ?? 'RF01',
    sede: {
      indirizzo: a.indirizzo,
      numeroCivico: a.numero_civico ?? undefined,
      cap: a.cap,
      comune: a.comune,
      provincia: a.provincia ?? undefined,
      nazione: a.nazione ?? 'IT',
    },
  };
}

export function clienteToCessionario(c: RigaCliente): Cessionario {
  return {
    partitaIva: c.p_iva ?? undefined,
    codiceFiscale: c.codice_fiscale ?? undefined,
    anagrafica: { denominazione: c.nome },
    codiceDestinatario: c.codice_sdi || '0000000',
    pec: c.pec ?? undefined,
    sede: {
      indirizzo: c.indirizzo ?? '',
      cap: c.cap ?? '',
      comune: c.comune ?? '',
      provincia: c.provincia ?? undefined,
      nazione: c.paese ?? 'IT',
    },
  };
}
