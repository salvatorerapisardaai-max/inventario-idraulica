import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anonKey)

// ─── Tipi del dominio ────────────────────────────────────────────

export type Fornitore = {
  id: string
  nome: string
  telefono?: string
  email?: string
  indirizzo?: string
  note?: string
}

export type Zona = {
  id: string
  codice: string
  nome: string
  tipo: string
  parent_id: string | null
  ordine: number
  livello: number
  path_codice: string
  path_nome: string
  sort_key: string
}

export type Articolo = {
  id: string
  nome: string
  codice?: string
  categoria?: string
  descrizione?: string
  utilizzo?: string
  posizione?: string
  zona_id?: string
  foto_url?: string
  prezzo_acquisto?: number
  prezzo_vendita?: number
  quantita: number
  soglia_riordino: number
  fornitore_id?: string
  note?: string
  fornitori?: Fornitore | null
  zona_codice?: string
  zona_nome?: string
  zona_path?: string
}

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
