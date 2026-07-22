import { createBrowserClient } from "@supabase/ssr";

// Types
export type SupabaseClient = ReturnType<typeof createBrowserClient>;

// Browser client (for client components)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
