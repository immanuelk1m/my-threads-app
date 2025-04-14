import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config'; // Import config directly

// Initialize NextAuth with the config, but only use the middleware export part
const { auth: middleware } = NextAuth(authConfig);

export { middleware }; // Export the middleware function

// Keep the existing config for matching paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - / (the root path, if you want the homepage public)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|^/$).*)', // 홈페이지 제외한 대부분 경로 보호 예시
        '/dashboard/:path*', // 대시보드 및 하위 경로 명시적 보호
    ],
};