// =============================================================================
//  app/fatture-acquisto/[id]/page.tsx
//  Dettaglio: rivedi righe, modifica articolo / markup, registra (carica magazzino).
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import RigheRevisione from './RigheRevisione';
import RegistraButton from './RegistraButton';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const euro = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default async function DettaglioAcquisto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fattura } = await supabase
    .from('fatture_acquisto')
    .select('id, numero, data, totale, imponibile, imposta, stato, fornitore_nome_snapshot, fornitori(nome, p_iva)')
    .eq('id', id).maybeSingle();
  if (!fattura) notFound();

  const { data: righe } = await supabase
    .from('righe_fattura_acquisto')
    .select('id, numero_linea, descrizione, codice_articolo_xml, quantita, unita_misura, prezzo_unitario, prezzo_totale, aliquota_iva, articolo_id, markup_override, caricato')
    .eq('fattura_acquisto_id', id)
    .order('numero_linea');

  // articoli per la combo di mapping
  const { data: articoli } = await supabase
    .from('articoli').select('id, nome, codice, prezzo_acquisto, usa_markup_auto').order('nome');

  const f: any = fattura;
  const registrabile = f.stato !== 'registrata' && (righe ?? []).some((r) => r.articolo_id);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <a href="/fatture-acquisto" className="text-sm text-blue-600 hover:underline">← Torna all'elenco</a>
      <h1 className="text-2xl font-semibold mt-2">
        Fattura {f.numero} del {f.data}
      </h1>
      <p className="text-sm text-gray-600">
        Fornitore: <strong>{f.fornitori?.nome ?? f.fornitore_nome_snapshot ?? '—'}</strong>
        {f.fornitori?.p_iva && <> · P.IVA {f.fornitori.p_iva}</>}
      </p>
      <p className="text-sm text-gray-600 mt-1">
        Imponibile {euro(f.imponibile)} · IVA {euro(f.imposta)} · <strong>Totale {euro(f.totale)}</strong>
      </p>

      <h2 className="mt-6 text-sm font-medium text-gray-700">Righe (rivedi mapping articolo e markup)</h2>
      <RigheRevisione righe={righe ?? []} articoli={articoli ?? []} />

      <div className="mt-6">
        <RegistraButton fatturaId={id} disabilitato={!registrabile} stato={f.stato} />
        {!registrabile && f.stato !== 'registrata' && (
          <p className="mt-2 text-xs text-amber-700">Mappa almeno una riga a un articolo per poter registrare.</p>
        )}
      </div>
    </main>
  );
}
