// =============================================================================
//  persistenzaSupabase.ts — Adapter Persistenza su Supabase (per la tua app).
//
//  NIENTE import da '@supabase/supabase-js': usiamo un'interfaccia minima
//  (duck typing) con solo i metodi che servono davvero (from, rpc). Così il
//  file non dipende da un pacchetto che potrebbe non essere una dipendenza
//  diretta nel tuo package.json (solo @supabase/ssr lo è).
//
//  Qualsiasi client Supabase (browser o server, @supabase/ssr o supabase-js)
//  soddisfa questa interfaccia automaticamente: nessuna modifica richiesta
//  dove viene chiamato `new PersistenzaSupabase(supabase)`.
// =============================================================================
import { Persistenza, RecordFattura, PatchEsito } from './persistenza';

/** Sottoinsieme minimo dell'API del client Supabase di cui questo file ha bisogno. */
export interface SupabaseLike {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
}

export class PersistenzaSupabase implements Persistenza {
  constructor(private supabase: SupabaseLike) {}

  async prossimoNumero(aziendaId: string, anno: number): Promise<number> {
    const { data, error } = await this.supabase.rpc('prossimo_numero_fattura', {
      p_azienda: aziendaId,
      p_anno: anno,
    });
    if (error) throw error;
    return data as number;
  }

  async salvaFattura(rec: RecordFattura): Promise<string> {
    // 1) inserisci la testata
    const { data, error } = await this.supabase
      .from('fatture')
      .insert({
        azienda_id: rec.aziendaId,
        cliente_id: rec.clienteId ?? null,
        numero: rec.numero,
        data: rec.data,
        imponibile: rec.imponibile,
        imposta: rec.imposta,
        totale: rec.totale,
        stato: rec.stato,
        xml: rec.xml,
        nome_file: rec.nomeFile,
        sdi_id: rec.sdiId ?? null,
        sdi_status: rec.sdiStatus ?? null,
        sdi_message: rec.sdiMessage ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    const fatturaId = data.id as string;

    // 2) inserisci le righe
    if (rec.righe.length) {
      const { error: errRighe } = await this.supabase.from('righe_fattura').insert(
        rec.righe.map((r) => ({
          fattura_id: fatturaId,
          numero_linea: r.numeroLinea,
          descrizione: r.descrizione,
          quantita: r.quantita,
          unita_misura: r.unitaMisura ?? null,
          prezzo_unitario: r.prezzoUnitario,
          prezzo_totale: r.prezzoTotale,
          aliquota_iva: r.aliquotaIva,
          natura: r.natura ?? null,
          articolo_id: r.articoloId ?? null,
        })),
      );
      if (errRighe) throw errRighe;
    }

    return fatturaId;
  }

  async aggiornaEsito(fatturaId: string, patch: PatchEsito): Promise<void> {
    const { error } = await this.supabase
      .from('fatture')
      .update({
        stato: patch.stato,
        sdi_status: patch.sdiStatus ?? null,
        sdi_message: patch.sdiMessage ?? null,
        sdi_updated_at: new Date().toISOString(),
      })
      .eq('id', fatturaId);
    if (error) throw error;
  }
}
