import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials not configured");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const BUCKET = process.env.SUPABASE_BUCKET ?? "videos";
