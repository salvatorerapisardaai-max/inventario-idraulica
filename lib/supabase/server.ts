// =============================================================================
//  lib/supabase/server.ts
//  Client Supabase lato server (Server Components, Server Actions, Route Handlers).
//  Usa i cookie del browser per propagare la sessione dell'utente loggato:
//  questo fa sì che la RLS dia accesso ai dati con auth.role() = 'authenticated'.
//
//  Se nel tuo progetto esiste già un file con lo stesso scopo (lib/supabase/server.ts
//  o utils/supabase/server.ts), USA QUELLO e non sostituirlo. Importa createClient
//  da lì negli altri file. Se non esiste, salva questo come `lib/supabase/server.ts`.
// =============================================================================
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  // In Next 15 cookies() è async (await). In Next 14 togli `await` qui sotto.
  const cookieStore = await cookies();

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
            // Chiamato da Server Component: ignorabile se il refresh sessione
            // è gestito dal middleware (caso standard di @supabase/ssr).
          }
        },
      },
    },
  );
}
