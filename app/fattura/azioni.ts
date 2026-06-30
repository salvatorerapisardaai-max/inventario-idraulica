// =============================================================================
//  app/fatture/azioni.ts — Server Actions per la fatturazione.
//
//  Usa il client Supabase a cookie (@supabase/ssr): la sessione dell'utente
//  loggato fa passare la RLS. Oggi trasmette col MockGateway; al Passo 4 si
//  sostituisce una sola riga con ArubaGateway.
// =============================================================================
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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

export interface EsitoAzione {
  ok: boolean;
  errore?: string;
  fatturaId?: string;
  numero?: string;
  stato?: string;
  totale?: number;
}

export async function emettiFatturaDaVendita(venditaId: string): Promise<EsitoAzione> {
  const supabase = await createClient();

  // 1) emittente
  const { data: azienda, error: eA } = await supabase
    .from('azienda').select('*').limit(1).maybeSingle();
  if (eA) throw eA;
  if (!azienda) {
    return { ok: false, errore: "Dati azienda mancanti: configura prima l'anagrafica della ditta." };
  }

  // 2) vendita + cliente
  const { data: vendita, error: eV } = await supabase
    .from('vendite').select('*').eq('id', venditaId).single();
  if (eV) throw eV;
  if (!vendita.cliente_id) {
    return { ok: false, errore: 'La vendita non ha un cliente associato (obbligatorio per la fattura elettronica).' };
  }

  const { data: cliente, error: eC } = await supabase
    .from('clienti').select('*').eq('id', vendita.cliente_id).single();
  if (eC) throw eC;

  // 3) righe (con aliquota presa dall'articolo, altrimenti default azienda)
  const { data: righeV, error: eR } = await supabase
    .from('vendite_righe')
    .select('articolo_nome, quantita, prezzo_unitario, articoli(aliquota_iva)')
    .eq('vendita_id', venditaId);
  if (eR) throw eR;
  if (!righeV?.length) return { ok: false, errore: 'La vendita non ha righe.' };

  const aliquotaDefault = Number(azienda.aliquota_iva_default ?? 22);

  const righe: RigaFattura[] = righeV.map((r: any) => {
    // aliquota_iva è memorizzata come frazione (0.22) -> percentuale (22)
    const aliquota = r.articoli?.aliquota_iva != null
      ? Number(r.articoli.aliquota_iva) * 100
      : aliquotaDefault;
    let prezzo = Number(r.prezzo_unitario);
    if (PREZZI_IVA_INCLUSA) prezzo = prezzo / (1 + aliquota / 100); // scorpora l'IVA
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
