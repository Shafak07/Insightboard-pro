import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/database";

function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url: url?.trim(), anonKey: anonKey?.trim() };
}

let warnedMissingEnv = false;

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey) {
    if (process.env.NODE_ENV === "development" && !warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn(
        "[middleware] Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in insightboard-pro/.env, then restart the dev server."
      );
    }
    return {
      response: NextResponse.next({ request }),
      user: null,
    };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
