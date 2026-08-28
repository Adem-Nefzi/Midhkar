import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Lazy client: creating at module load with missing credentials throws
   and takes down every route that merely imports this file. The client
   is only built on first use, and null is returned when unconfigured so
   callers can 404/503 gracefully. */

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  _supabase = createClient(url, serviceKey);
  return _supabase;
}

export const BUCKET = process.env.SUPABASE_BUCKET ?? "videos";
