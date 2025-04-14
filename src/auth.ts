import NextAuth from "next-auth";
import type { Profile, User, Account, TokenSet, Session, DefaultSession, AuthOptions } from "next-auth"; // Add AuthOptions
import type { OAuthConfig } from "next-auth/providers/oauth";
import type { JWT } from "next-auth/jwt";
// Removed SupabaseClient, createClient imports as they are not Edge compatible

// Augment the Session interface to include the user ID
declare module "next-auth" {
    interface Session {
        user?: {
            id?: string | null; // Add id property
        } & DefaultSession["user"];
    }
    // Optionally augment User if needed elsewhere, though Session augmentation often suffices for session callback
    // interface User {
    //     id?: string;
    // }
}


// Removed Supabase Admin client logic - not Edge compatible
// Threads API 응답 타입 정의 (제공된 정보 기반)
interface ThreadsProfile extends Profile {
    id: string;
    username: string;
    name?: string; // Optional 필드일 수 있음
    threads_profile_picture_url?: string;
    threads_biography?: string;
}

export const authConfig = {
    providers: [
        {
            // Threads Custom OAuth Provider 설정
            id: "threads",
            name: "Threads",
            type: "oauth",
            clientId: process.env.AUTH_THREADS_ID, // Vercel 환경 변수 이름과 일치시킴
            clientSecret: process.env.AUTH_THREADS_SECRET, // Vercel 환경 변수 이름과 일치시킴
            authorization: {
                url: "https://threads.net/oauth/authorize",
                params: {
                    scope: "threads_basic", // 필요한 최소 scope, 추가 기능 필요시 scope 추가
                    // response_type: "code" // OAuth 2.0 기본값
                },
            },
            // 명시적으로 클라이언트 자격 증명 전달 방식 지정
            client: {
                token_endpoint_auth_method: 'client_secret_post',
            },
            token: {
                url: "https://graph.threads.net/oauth/access_token",
                // Removed custom request function. Auth.js should handle token exchange.
            },
            userinfo: {
                url: "https://graph.threads.net/v1.0/me",
                params: { fields: "id,username,name,threads_profile_picture_url,threads_biography" }, // 요청할 필드 명시
                // Remove custom request function, rely on default handling
            },
            // Threads API 응답을 Auth.js 표준 형식 + 필요한 정보로 매핑
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
            profile(profile: ThreadsProfile, _tokens: any): User { // Mark tokens as unused
                // console.log("Threads Profile Raw:", profile); // 디버깅용 로그
                // profile 콜백은 User 객체를 반환해야 합니다.
                // id는 string 타입이어야 합니다. Threads API는 항상 id를 반환합니다.
                return {
                    id: profile.id,
                    name: profile.username ?? profile.name,
                    email: null, // Threads는 이메일을 제공하지 않음
                    image: profile.threads_profile_picture_url,
                    // User 타입에 없는 추가 정보는 여기서 반환하지 않고,
                    // 필요하다면 signIn 콜백에서 profile 파라미터를 통해 직접 접근합니다.
                };
            },
        },
        // 다른 Provider 추가 가능 (예: Credentials 등)
    ],
    callbacks: {
        async signIn({ user, account, profile }: { user: User, account: Account | null, profile?: Profile }) { // Add types for parameters
            // console.log("signIn Callback:", { user, account, profile }); // 디버깅용 로그
            // Simplified signIn callback for Edge compatibility
            // Database operations should be handled elsewhere (e.g., API route, Server Action)
            if (account?.provider === "threads") {
                // Basic check: Ensure user ID exists after profile mapping
                if (!user?.id) {
                     console.error("Threads user ID not found in signIn callback after profile mapping.");
                     return false;
                }
                // Allow sign in, actual DB sync needs to happen outside middleware/auth config
                console.log("signIn allowed for Threads user:", user.id);
            }
            // 다른 provider 또는 정상적인 경우 로그인 허용
            return true;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async jwt({ token, user, account, profile: _profile, trigger }: { token: JWT, user?: User | null, account?: Account | null, profile?: Profile | null, trigger?: "signIn" | "signUp" | "update" | undefined }) { // Add types
            // JWT 전략 사용 시, signIn 이후 호출됨
            // console.log("JWT Callback:", { token, user, account, profile, trigger }); // 디버깅용 로그
            if (trigger === 'signIn' && account?.provider === 'threads' && user?.id) {
                // 토큰에 Threads ID 명시적으로 저장 (session 콜백에서 사용하기 위함)
                token.sub = user.id; // 'sub' 클레임에 사용자 ID 저장 (표준)
                token.threadsId = user.id; // 명시적인 필드 추가도 가능
            }
            // 필요하다면 DB에서 추가 정보를 조회하여 토큰에 포함 가능
            return token;
        },
        async session({ session, token }: { session: Session, token: JWT }) { // Add types
            // JWT 전략 사용 시, jwt 콜백 이후 호출됨
            // console.log("Session Callback:", { session, token }); // 디버깅용 로그
            // jwt 콜백에서 추가한 정보를 session 객체에 담아 클라이언트에 전달
            if (token.sub && session.user) {
                // Assign id if user exists in session
                if (session.user) {
                    session.user.id = token.sub; // 세션의 user 객체에 ID 할당 (중요!)
                }
            }
            // 다른 정보도 필요시 전달
            // if (token.threadsId && session.user) {
            //   session.user.threadsId = token.threadsId as string; // 타입 확장 필요
            // }
            return session;
        },
    },
    session: {
        strategy: "jwt", // JWT 세션 전략 사용
    },
    // pages: { signIn: '/login' }, // 커스텀 로그인 페이지 설정 시
    debug: true, // 디버그 로그 활성화 (문제 해결 후 false로 변경 권장)
} satisfies AuthOptions; // Add satisfies AuthOptions

// authConfig를 사용하여 NextAuth 핸들러와 auth 함수를 export
export const { handlers, auth, signIn: authSignIn, signOut: authSignOut } = NextAuth(authConfig);