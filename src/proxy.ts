import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// "/" é a landing page da plataforma.
const publicRoutes = [
  "/",
  "/login",
  "/reset-password",
  "/cadastro",
  "/termos",
  "/privacidade",
];

// Rotas liberadas para qualquer usuário autenticado e ativo.
const sharedRoutes = ["/alterar-senha"];

const roleAccess = {
  ADMIN: [
    "/dashboard",
    "/crm",
    "/leads",
    "/veiculos",
    "/vendas",
    "/custos",
    "/dre",
    "/relatorios",
    "/configuracoes",
  ],
  GERENTE: [
    "/dashboard",
    "/crm",
    "/leads",
    "/veiculos",
    "/vendas",
    "/custos",
    "/dre",
    "/relatorios",
  ],
  VENDEDOR: ["/dashboard", "/crm", "/leads", "/veiculos", "/vendas"],
};

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function canAccess(pathname: string, role: string) {
  if (pathname === "/") return true;

  if (sharedRoutes.some((route) => matchesRoute(pathname, route))) {
    return true;
  }

  const allowedRoutes = roleAccess[role as keyof typeof roleAccess] || [];

  return allowedRoutes.some((route) => matchesRoute(pathname, route));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // As rotas de API fazem a própria checagem de sessão e perfil e
  // respondem em JSON, então aqui só renovamos a sessão.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  const isPublicRoute = publicRoutes.some((route) =>
    matchesRoute(pathname, route),
  );

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Área da plataforma: só quem está em platform_admins, com ou sem loja.
  if (matchesRoute(pathname, "/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

    if (isPlatformAdmin !== true) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  }

  if (user && (pathname === "/" || pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.role || profile.is_active === false) {
      // Admin da plataforma sem loja própria vai para a área da plataforma.
      if (!profile) {
        const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

        if (isPlatformAdmin === true) {
          return NextResponse.redirect(new URL("/admin", request.url));
        }
      }

      await supabase.auth.signOut();

      const redirect = NextResponse.redirect(new URL("/login", request.url));

      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });

      return redirect;
    }

    if (!canAccess(pathname, profile.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
