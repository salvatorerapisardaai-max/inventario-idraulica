import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anonKey)

// ─── Tipi del dominio ────────────────────────────────────────────────

export type Fornitore = {
  id: string
  nome: string
  telefono?: string | null
  email?: string | null
  indirizzo?: string | null
  note?: string | null
  // Campi anagrafici da Fatture in Cloud
  p_iva?: string | null
  codice_fiscale?: string | null
  comune?: string | null
  cap?: string | null
  provincia?: string | null
  paese?: string | null
  pec?: string | null
  codice_sdi?: string | null
  referente?: string | null
}

export type Cliente = {
  id: string
  nome: string
  telefono?: string | null
  email?: string | null
  indirizzo?: string | null
  note?: string | null
  access_token?: string | null
  // Campi anagrafici da Fatture in Cloud
  p_iva?: string | null
  codice_fiscale?: string | null
  comune?: string | null
  cap?: string | null
  provincia?: string | null
  paese?: string | null
  pec?: string | null
  codice_sdi?: string | null
  termini_pagamento?: string | null
  sconto_predefinito?: number | null
  lettera_intento?: boolean | null
  codice_interno?: string | null
}

export type Zona = {
  id: string
  codice: string
  nome: string
  tipo: string
  parent_id: string | null
  ordine: number
}

export type Articolo = {
  id: string
  nome: string
  codice?: string | null
  categoria?: string | null
  descrizione?: string | null  // sotto-categoria di FiC (es. "RICAMBI CASSETTE WC")
  utilizzo?: string | null
  posizione?: string | null
  zona_id?: string | null
  foto_url?: string | null
  prezzo_acquisto?: number | null
  prezzo_vendita?: number | null
  prezzo_lordo?: number | null
  quantita: number
  soglia_riordino: number
  fornitore_id?: string | null
  note?: string | null
  // Nuovi campi da Fatture in Cloud
  udm?: string | null              // 'PZ', 'MT', 'CF', 'KIT', ...
  aliquota_iva?: number | null     // 0.22 = 22%
  macro_categoria?: string | null  // 'IDRAULICA', 'TERMOIDRAULICA', ...
  // Join opzionali
  fornitori?: Fornitore | null
  zona_codice?: string
  zona_nome?: string
  zona_path?: string
}

export type StoricoPrezzoAcquisto = {
  id: string
  articolo_id: string
  fornitore_id: string | null
  fornitore_alias: string | null    // testo grezzo dal campo Extra
  prezzo: number
  anno: number | null
  mese: number | null
  data_stimata: string | null
  raw: string | null
  fonte: string
  created_at: string
  // Join opzionale
  fornitori?: Pick<Fornitore, 'id' | 'nome'> | null
}

// ─── Categorie applicative (le 11 della tassonomia interna) ──────────
export const CATEGORIE = [
  'Raccordi',
  'Valvole',
  'Tubi e Tubazioni',
  'Guarnizioni e O-ring',
  'Pompe',
  'Filtri',
  'Manometri e Strumenti',
  'Rubinetteria',
  'Giunti',
  'Accessori',
  'Altro',
] as const

export type Categoria = typeof CATEGORIE[number]

// ─── Macro-categorie informative da Fatture in Cloud ─────────────────
// Non vincolanti, usate per filtri rapidi e generazione codici.
export const MACRO_CATEGORIE = [
  'IDRAULICA',
  'TERMOIDRAULICA',
  'FERRAMENTA',
  'ARREDO BAGNO',
  'RICAMBI',
  'SIGILLANTI',
  'DEPURAZIONE ACQUE',
  "ELETTRICITA'",
  'DETERGENTI',
] as const

// ─── Unità di Misura comuni ──────────────────────────────────────────
export const UDM_OPZIONI = ['PZ', 'NR', 'MT', 'CF', 'KIT', 'COPPIA', 'KG', 'RT'] as const

// ─── Aliquote IVA italiane standard ──────────────────────────────────
export const ALIQUOTE_IVA = [
  { valore: 0.22, etichetta: '22% (ordinaria)' },
  { valore: 0.10, etichetta: '10% (ridotta)' },
  { valore: 0.04, etichetta: '4% (minima)' },
  { valore: 0,    etichetta: '0% (esente)' },
] as const
