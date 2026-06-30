// =============================================================================
//  lib/supabase/server.example.ts
//  USA QUESTO SOLO SE NON HAI GIÀ un helper server per Supabase.
//  Probabilmente ce l'hai già (hai @supabase/ssr + login): in quel caso
//  IGNORA questo file e negli import usa il tuo (es. '@/lib/supabase/server').
//
//  Se non ce l'hai: rinomina in `server.ts` e adatta le variabili d'ambiente.
// =============================================================================
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // Next 15: await. Next 14: togli await.

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chiamato da un Server Component: ignorabile se il refresh
            // sessione è gestito dal middleware.
          }
        },
      },
    },
  );
}
