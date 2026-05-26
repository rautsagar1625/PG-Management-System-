import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

// Paths accessible to every authenticated role (shared auth pages)
const TENANT_PATHS = ['/tenant'];
const STAFF_PATHS = ['/staff'];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root → redirect to operator dashboard by default (role-corrected below after auth)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublicPath) return NextResponse.next();

  const token = request.cookies.get('pg_session')?.value;

  if (!token) {
    // Allow /tenant and /staff paths through to their own login if no session
    if (TENANT_PATHS.some((p) => pathname.startsWith(p)) || STAFF_PATHS.some((p) => pathname.startsWith(p))) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = (payload as { systemRole?: string }).systemRole ?? '';

    // ── Role-based routing ───────────────────────────────────────────────────

    // TENANT: can only access /tenant/* — redirect away from operator dashboard
    if (role === 'TENANT') {
      if (!TENANT_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
      }
      return NextResponse.next();
    }

    // STAFF: can only access /staff/* — redirect away from operator dashboard
    if (role === 'STAFF') {
      if (!STAFF_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/staff', request.url));
      }
      return NextResponse.next();
    }

    // Operators/Owners/Admins: cannot access tenant or staff-only routes
    if (TENANT_PATHS.some((p) => pathname.startsWith(p)) || STAFF_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch {
    // Token is expired or invalid — clear cookie and redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('pg_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
