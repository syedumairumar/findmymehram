import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;
export function backend() {
  if (!supabase)
    throw new Error(
      "The account service is not configured. You can explore the demo in the meantime.",
    );
  return supabase;
}
export function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Something went wrong. Please try again.";
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await backend().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function resolvePhoto(photo: string): Promise<string> {
  if (!photo || photo.startsWith("https://") || photo.startsWith("/"))
    return photo;
  const { data, error } = await backend()
    .storage.from("profile-photos")
    .createSignedUrl(photo, 180);
  if (error) return "";
  return data.signedUrl;
}
