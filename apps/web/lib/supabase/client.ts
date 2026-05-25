import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env/client";

export function createClient() {
  return createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey);
}
