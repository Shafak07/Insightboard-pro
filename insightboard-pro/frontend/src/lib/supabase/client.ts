import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url, anonKey };
}

/** Browser Supabase client — uses cookies (same session as middleware). */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        return document.cookie.split("; ").filter(Boolean).map((part) => {
          const eq = part.indexOf("=");
          const name = eq >= 0 ? part.slice(0, eq) : part;
          const value = eq >= 0 ? part.slice(eq + 1) : "";
          return { name, value: decodeURIComponent(value) };
        });
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return;
        for (const { name, value, options } of cookiesToSet) {
          const segments = [
            `${name}=${encodeURIComponent(value)}`,
            `path=${options?.path ?? "/"}`,
          ];
          if (options?.maxAge != null) segments.push(`max-age=${options.maxAge}`);
          if (options?.domain) segments.push(`domain=${options.domain}`);
          if (options?.sameSite) segments.push(`SameSite=${options.sameSite}`);
          if (options?.secure) segments.push("Secure");
          document.cookie = segments.join("; ");
        }
      },
    },
  });
}

/** Session-only storage when "Remember me" is unchecked. */
export function createSessionClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      storage:
        typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  });
}
