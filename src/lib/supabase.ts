import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } })
  : null;

export interface Profile { id: string; display_name: string; avatar_url: string | null }

export interface Duel {
  id: string;
  code: string;
  host: string;
  guest: string | null;
  status: "waiting" | "active" | "finished" | "cancelled";
  n_questions: number;
  time_limit_s: number;
  started_at: string | null;
  winner: string | null;
  host_score: number | null;
  guest_score: number | null;
}

export interface DuelAnswer { duel_id: string; idx: number; user_id: string; correct: boolean; ms: number }

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Coś poszło nie tak. Sprawdź połączenie.";
}
