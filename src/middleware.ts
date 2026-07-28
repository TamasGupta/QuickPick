import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request so Server
// Components always see a valid session.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A brand-new buyer who backs out (browser back button, closed tab) of the
  // login flow's "what should we call you" step ends up with a real, valid
  // session but no profiles.full_name — verifyOtp() already authenticates
  // them before that step even renders, and the phone/otp/name steps never
  // change the /login URL, so back navigation just pops to whatever page
  // came before /login in history rather than undoing the login. Catch it
  // here so every subsequent page load routes them back to finish onboarding
  // instead of silently browsing (and placing orders) as "Not set". Scoped to
  // `user` only, so anonymous browsing never pays for the extra query.
  const pathname = request.nextUrl.pathname;
  if (user && pathname !== "/login" && pathname !== "/register" && !pathname.startsWith("/api")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    if (profile && profile.role === "buyer" && !profile.full_name) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and the service worker.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|icons/).*)",
  ],
};
