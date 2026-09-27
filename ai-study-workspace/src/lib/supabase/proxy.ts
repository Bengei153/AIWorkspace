import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const path = request.nextUrl.pathname;
  const isSetup = path === "/setup";
  const isLogin = path === "/login";
  const isAuthCallback = path.startsWith("/auth/");

  if (!url || !key) {
    if (isSetup) return NextResponse.next({ request });
    const destination = request.nextUrl.clone();
    destination.pathname = "/setup";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims && !isLogin && !isAuthCallback) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  if (claims && (isLogin || isSetup)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/";
    destination.search = "";
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}
