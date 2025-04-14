import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });

    // If no token exists and the path is protected, redirect to login
    // Adjust the login page URL as needed
    const loginUrl = new URL('/api/auth/signin', req.url); // Default NextAuth signin page
    loginUrl.searchParams.set('callbackUrl', req.url); // Redirect back after login

    if (!token) {
        // Allow access to the root path even without a token (if desired)
        if (req.nextUrl.pathname === '/') {
            return NextResponse.next();
        }
        // Redirect to login for other protected paths
        return NextResponse.redirect(loginUrl);
    }

    // If token exists, allow the request to proceed
    return NextResponse.next();
}

// Keep the existing config for matching paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - / (the root path, if you want the homepage public) - Handled inside middleware now
         */
        // Apply middleware to all paths except API, static files, images, favicon
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
        // Explicitly include paths like /dashboard if needed, though the above pattern might cover them
        // '/dashboard/:path*',
    ],
};