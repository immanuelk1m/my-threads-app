import type { Profile, User, Account, TokenSet, Session, DefaultSession, AuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import GitHub from "next-auth/providers/github";
import type { JWT } from "next-auth/jwt";

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

// Threads API 응답 타입 정의 (제공된 정보 기반) - 필요시 원래 provider로 복구할 때 사용
interface ThreadsProfile extends Profile {
    id: string;
    username: string;
    name?: string; // Optional 필드일 수 있음
    threads_profile_picture_url?: string;
    threads_biography?: string;
}

export const authConfig = {
    providers: [
        // Replaced custom Threads provider with GitHub for Edge compatibility testing
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID ?? '', // Provide default empty string if undefined
            clientSecret: process.env.AUTH_GITHUB_SECRET ?? '', // Provide default empty string if undefined
        }),
        // 다른 Provider 추가 가능 (예: Credentials 등)
    ],
    callbacks: {
        async signIn({ user, account, profile }: { user: User, account: Account | null, profile?: Profile }) { // Add types for parameters
            // console.log("signIn Callback:", { user, account, profile }); // 디버깅용 로그
            // Simplified signIn callback for Edge compatibility
            // Database operations should be handled elsewhere (e.g., API route, Server Action)
            // Temporarily commented out provider-specific logic for testing
            // if (account?.provider === "github") { // Example if testing GitHub
            //     // Basic check: Ensure user ID exists after profile mapping
            //     if (!user?.id) {
            //          console.error("GitHub user ID not found in signIn callback after profile mapping.");
            //          return false;
            //     }
            //     // Allow sign in
            //     console.log("signIn allowed for GitHub user:", user.id);
            // }
            // 다른 provider 또는 정상적인 경우 로그인 허용
            return true;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async jwt({ token, user, account, profile: _profile, trigger }: { token: JWT, user?: User | null, account?: Account | null, profile?: Profile | null, trigger?: "signIn" | "signUp" | "update" | undefined }) { // Add types
            // JWT 전략 사용 시, signIn 이후 호출됨
            // console.log("JWT Callback:", { token, user, account, profile, trigger }); // 디버깅용 로그
            // Temporarily commented out provider-specific logic for testing
            // if (trigger === 'signIn' && account?.provider === 'github' && user?.id) {
            //     // 토큰에 GitHub ID 명시적으로 저장 (session 콜백에서 사용하기 위함)
            //     token.sub = user.id; // 'sub' 클레임에 사용자 ID 저장 (표준)
            //     // token.githubId = user.id; // 명시적인 필드 추가도 가능
            // }
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
} satisfies AuthOptions;