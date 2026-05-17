import { NextRequest, NextResponse } from "next/server";

import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  ""
);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

async function getAccessToken(
  request: NextRequest,
  response: NextResponse
): Promise<string | null> {
  const supabase = createRouteHandlerClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }

  return session?.access_token ?? null;
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const targetUrl = `${API_BASE}/${path}${request.nextUrl.search}`;

  const cookieResponse = new NextResponse(null);
  const accessToken = await getAccessToken(request, cookieResponse);

  if (!accessToken) {
    const unauth = NextResponse.json(
      { detail: "Not authenticated — sign in again." },
      { status: 401 }
    );
    cookieResponse.cookies.getAll().forEach((c) => {
      unauth.cookies.set(c);
    });
    return unauth;
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.set("Authorization", `Bearer ${accessToken}`);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });

  const proxied = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  cookieResponse.cookies.getAll().forEach((c) => {
    proxied.cookies.set(c);
  });

  return proxied;
}

type RouteContext = { params: { path: string[] } };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context.params.path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context.params.path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context.params.path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context.params.path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context.params.path);
}
