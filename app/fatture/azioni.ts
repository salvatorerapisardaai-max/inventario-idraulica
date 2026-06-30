// =============================================================================
//  app/fatture/azioni.ts
//  Server Actions per il ciclo ATTIVO (vendita).
//  Client Supabase costruito inline con @supabase/ssr (nessun helper esterno).
// =============================================================================
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { emettiFattura } from '@/lib/fattura/emettiFattura';
import { PersistenzaSupabase } from '@/lib/fattura/persistenzaSupabase';
import { MockGateway } from '@/lib/fattura/gateway';
// import { ArubaGateway } from '@/lib/fattura/arubaGateway'; // Passo 4
import { aziendaToCedente, clienteToCessionario } from '@/lib/fattura/mappers';
import type { RigaFattura } from '@/lib/fattura/generaXmlFattura';

// ⚠️ DA CONFERMARE COL COMMERCIALISTA (Passo 3):
// i prezzi nelle vendite sono IVA esclusa (netto/imponibile) -> false
// oppure IVA inclusa (lordo) -> true.  Default: netto.
const PREZZI_IVA_INCLUSA = false;

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
            // chiamato da Server Component: ok, refresh lo fa il middleware
          }
        },
      },
    },
  );
}

export interface EsitoAzione {
  ok: boolean;
  errore?: string;
  fatturaId?: string;
  numero?: string;
  stato?: string;
  totale?: number;
}

export async function emettiFatturaDaVendita(venditaId: string): Promise<EsitoAzione> {
  const supabase = await getSupabase();

  // 1) emittente
  const { data: azienda, error: eA } = await supabase
    .from('azienda').select('*').limit(1).maybeSingle();
  if (eA) return { ok: false, errore: eA.message };
  if (!azienda) {
    return { ok: false, errore: "Dati azienda mancanti: configura prima l'anagrafica della ditta." };
  }

  // 2) vendita + cliente
  const { data: vendita, error: eV } = await supabase
    .from('vendite').select('*').eq('id', venditaId).single();
  if (eV) return { ok: false, errore: eV.message };
  if (!vendita.cliente_id) {
    return { ok: false, errore: 'La vendita non ha un cliente associato (obbligatorio per la fattura elettronica).' };
  }

  const { data: cliente, error: eC } = await supabase
    .from('clienti').select('*').eq('id', vendita.cliente_id).single();
  if (eC) return { ok: false, errore: eC.message };

  // 3) righe (con aliquota presa dall'articolo, altrimenti default azienda)
  const { data: righeV, error: eR } = await supabase
    .from('vendite_righe')
    .select('articolo_nome, quantita, prezzo_unitario, articoli(aliquota_iva)')
    .eq('vendita_id', venditaId);
  if (eR) return { ok: false, errore: eR.message };
  if (!righeV?.length) return { ok: false, errore: 'La vendita non ha righe.' };

  const aliquotaDefault = Number(azienda.aliquota_iva_default ?? 22);

  const righe: RigaFattura[] = righeV.map((r: any) => {
    // aliquota_iva è memorizzata come frazione (0.22) -> percentuale (22)
    const aliquota = r.articoli?.aliquota_iva != null
      ? Number(r.articoli.aliquota_iva) * 100
      : aliquotaDefault;
    let prezzo = Number(r.prezzo_unitario);
    if (PREZZI_IVA_INCLUSA) prezzo = prezzo / (1 + aliquota / 100);
    return {
      descrizione: r.articolo_nome,
      quantita: Number(r.quantita),
      prezzoUnitario: Math.round(prezzo * 1e6) / 1e6,
      aliquotaIva: aliquota,
    };
  });

  // 4) emetti (Mock ora, Aruba al Passo 4)
  const deps = {
    persistenza: new PersistenzaSupabase(supabase),
    gateway: new MockGateway(),
  };

  const res = await emettiFattura(
    {
      aziendaId: azienda.id,
      clienteId: cliente.id,
      cedente: aziendaToCedente(azienda),
      cliente: clienteToCessionario(cliente),
      righe,
    },
    deps,
  );

  // 5) collega la fattura alla vendita di origine
  await supabase.from('fatture').update({ vendita_id: venditaId }).eq('id', res.fatturaId);

  revalidatePath('/fatture');
  return { ok: true, fatturaId: res.fatturaId, numero: res.numero, stato: res.stato, totale: res.totale };
}
