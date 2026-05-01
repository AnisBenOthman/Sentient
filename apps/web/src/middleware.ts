import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

function isTokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp: number;
    };
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  // The access token is stored in localStorage (client-side only).
  // Middleware reads a thin cookie we set on login to decide server-side.
  const tokenCookie = req.cookies.get('sentient_logged_in')?.value;
  const isAuthenticated = tokenCookie === '1';

  if (!isPublic && !isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  if (isPublic && isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
