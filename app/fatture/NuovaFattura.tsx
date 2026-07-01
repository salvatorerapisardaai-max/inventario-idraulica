// =============================================================================
//  app/fatture/NuovaFattura.tsx — riquadro client per creare una fattura.
//  Stile inline coerente con InventarioApp.tsx.
// =============================================================================
'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { emettiFatturaDaVendita } from './azioni';

const C = { surface:'#1a1a1a', border:'#2a2a2a', text:'#e8e8e8', muted:'#888', accent:'#3b82f6', green:'#22c55e', red:'#ef4444', orange:'#f97316' };

const inp: CSSProperties = { padding:'9px 11px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:13, fontFamily:'inherit', outline:'none' };
const btnPrimary: CSSProperties = { padding:'10px 18px', background:C.accent, color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' };

interface VenditaOpt {
  id: string;
  numero: number;
  data: string;
  totale: number;
  cliente_nome: string | null;
  cliente_id: string | null;
}

const euro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function NuovaFattura({
  vendite,
  disabilitato,
}: {
  vendite: VenditaOpt[];
  disabilitato: boolean;
}) {
  const [sel, setSel] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const genera = () => {
    if (!sel) return;
    setMsg(null);
    start(async () => {
      try {
        const r = await emettiFatturaDaVendita(sel);
        if (r.ok) {
          setMsg({ tipo: 'ok', testo: `Fattura n.${r.numero} creata — stato: ${r.stato}.` });
          setSel('');
          router.refresh();
        } else {
          setMsg({ tipo: 'err', testo: r.errore ?? 'Errore sconosciuto.' });
        }
      } catch (e: any) {
        setMsg({ tipo: 'err', testo: e?.message ?? 'Errore durante la generazione.' });
      }
    });
  };

  return (
    <div style={{ borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, padding:16 }}>
      <h2 style={{ margin:'0 0 10px', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em' }}>Crea fattura da una vendita</h2>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8 }}>
        <select
          style={{ ...inp, minWidth:280, cursor:'pointer' }}
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          disabled={disabilitato || pending}
        >
          <option value="">— seleziona una vendita —</option>
          {vendite.map((v) => (
            <option key={v.id} value={v.id}>
              #{v.numero} · {v.data?.slice(0, 10)} · {v.cliente_nome ?? 'cliente n.d.'} · {euro(v.totale)}
            </option>
          ))}
        </select>
        <button
          onClick={genera}
          disabled={disabilitato || pending || !sel}
          style={{ ...btnPrimary, opacity: (disabilitato || pending || !sel) ? 0.5 : 1 }}
        >
          {pending ? 'Genero…' : 'Genera fattura'}
        </button>
      </div>

      {disabilitato && (
        <p style={{ margin:'8px 0 0', fontSize:12, color:C.orange }}>Configura prima i dati azienda.</p>
      )}
      {vendite.length === 0 && !disabilitato && (
        <p style={{ margin:'8px 0 0', fontSize:12, color:C.muted }}>Nessuna vendita disponibile da fatturare.</p>
      )}
      {msg && (
        <p style={{ margin:'8px 0 0', fontSize:13, color: msg.tipo === 'ok' ? C.green : C.red }}>
          {msg.testo}
        </p>
      )}
    </div>
  );
}
