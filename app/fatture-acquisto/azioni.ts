// =============================================================================
//  app/fatture-acquisto/azioni.ts
//  Server Actions per il ciclo PASSIVO (acquisto).
//  Client Supabase costruito inline con @supabase/ssr (nessun helper esterno).
// =============================================================================
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseFatturaXml } from '@/lib/fattura/parseFatturaXml';

// --- helper interno per il client Supabase lato server -----------------
async function getSupabase() {
  const cookieStore = await cookies(); // Next 15: await. Next 14: togli await.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ok: refresh sessione gestito dal middleware
          }
        },
      },
    },
  );
}

export interface Esito { ok: boolean; errore?: string; fatturaAcquistoId?: string }

// --- IMPORT --------------------------------------------------------------
export async function importaXmlAcquisto(xml: string): Promise<Esito> {
  const supabase = await getSupabase();
  let p;
  try {
    p = parseFatturaXml(xml);
  } catch (e: any) {
    return { ok: false, errore: 'XML non leggibile: ' + (e?.message ?? e) };
  }
  if (!p.numero || !p.data) return { ok: false, errore: 'XML privo di numero o data fattura.' };

  // collega il fornitore se gia' presente (per p.iva)
  let fornitoreId: string | null = null;
  if (p.cedente.partitaIva) {
    const { data: f } = await supabase
      .from('fornitori').select('id').eq('p_iva', p.cedente.partitaIva).maybeSingle();
    fornitoreId = f?.id ?? null;
  }

  // inserisci testata
  const { data: testata, error: e1 } = await supabase
    .from('fatture_acquisto')
    .insert({
      fornitore_id: fornitoreId,
      fornitore_piva: p.cedente.partitaIva ?? null,
      fornitore_nome_snapshot: p.cedente.denominazione ?? [p.cedente.nome, p.cedente.cognome].filter(Boolean).join(' ') || null,
      numero: p.numero,
      data: p.data,
      tipo_documento: p.tipoDocumento ?? 'TD01',
      imponibile: p.imponibile,
      imposta: p.imposta,
      totale: p.totale,
      stato: 'ricevuta',
      xml,
      importata_da: 'manuale',
    })
    .select('id').single();
  if (e1) return { ok: false, errore: e1.message };

  // suggerisci articolo per ogni riga (fuzzy match base)
  const { data: articoli } = await supabase
    .from('articoli').select('id, nome, codice');

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const findMatch = (descr: string, codice?: string) => {
    if (!articoli) return null;
    if (codice) {
      const c = articoli.find((a: any) => a.codice && a.codice.toLowerCase() === codice.toLowerCase());
      if (c) return c.id;
    }
    const dN = norm(descr);
    const m = articoli.find((a: any) => {
      const an = norm(a.nome);
      return an.length >= 5 && (dN.includes(an) || an.includes(dN));
    });
    return m?.id ?? null;
  };

  const righe = p.righe.map((r) => ({
    fattura_acquisto_id: testata!.id,
    numero_linea: r.numeroLinea,
    descrizione: r.descrizione,
    codice_articolo_xml: r.codiceArticoloXml ?? null,
    quantita: r.quantita,
    unita_misura: r.unitaMisura ?? null,
    prezzo_unitario: r.prezzoUnitario,
    prezzo_totale: r.prezzoTotale,
    aliquota_iva: r.aliquotaIva,
    articolo_id: findMatch(r.descrizione, r.codiceArticoloXml),
  }));
  if (righe.length) {
    const { error: e2 } = await supabase.from('righe_fattura_acquisto').insert(righe);
    if (e2) return { ok: false, errore: e2.message };
  }

  await supabase.from('fatture_acquisto').update({ stato: 'in_revisione' }).eq('id', testata!.id);

  revalidatePath('/fatture-acquisto');
  return { ok: true, fatturaAcquistoId: testata!.id };
}

// --- MODIFICA RIGA (mapping articolo + markup) ----------------------------
export async function aggiornaMappingRiga(
  rigaId: string,
  patch: { articolo_id?: string | null; markup_override?: number | null }
) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('righe_fattura_acquisto').update({
    articolo_id: patch.articolo_id ?? null,
    markup_override: patch.markup_override ?? null,
  }).eq('id', rigaId);
  if (error) return { ok: false, errore: error.message };
  return { ok: true };
}

// --- REGISTRA (carico magazzino) ------------------------------------------
export async function registraFatturaAcquisto(fatturaAcquistoId: string): Promise<Esito> {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('registra_fattura_acquisto', { p_fattura_id: fatturaAcquistoId });
  if (error) return { ok: false, errore: error.message };
  revalidatePath('/fatture-acquisto');
  return { ok: true, fatturaAcquistoId };
}
