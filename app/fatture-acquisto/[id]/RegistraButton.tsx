'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registraFatturaAcquisto } from '../azioni';

export default function RegistraButton({ fatturaId, disabilitato, stato }: { fatturaId: string; disabilitato: boolean; stato: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  if (stato === 'registrata') {
    return <p className="text-sm text-green-700">✅ Fattura già registrata: magazzino aggiornato.</p>;
  }

  const onClick = () => {
    setMsg(null);
    start(async () => {
      const r = await registraFatturaAcquisto(fatturaId);
      if (r.ok) router.refresh();
      else setMsg(r.errore ?? 'Errore durante la registrazione.');
    });
  };

  return (
    <div>
      <button
        onClick={onClick}
        disabled={pending || disabilitato}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Registro…' : 'Registra e carica magazzino'}
      </button>
      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}
