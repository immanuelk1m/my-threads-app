import NextAuth from "next-auth";
import type { NextAuthConfig, Profile, User, Account } from "next-auth";
import type { TokenSet } from "@auth/core/types"; // Import TokenSet type
import type { OAuthConfig } from "@auth/core/providers/oauth"; // Import OAuthConfig type for context hint
import { SupabaseClient, createClient } from "@supabase/supabase-js";

// Supabase Admin 클라이언트 인스턴스 (필요시 생성)
let supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin() {
    if (!supabaseAdmin) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error('Supabase URL or Service Role Key is missing in env');
        }
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { persistSession: false } // 서버 측 클라이언트에서는 세션 유지 불필요
        });
    }
    return supabaseAdmin;
}

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
                // Define the request function with proper typing
                async request(context: {
                    provider: OAuthConfig<ThreadsProfile>; // Use OAuthConfig for provider type hint
                    params: URLSearchParams; // params are typically URLSearchParams
                    checks: { pkce: string }; // checks contain pkce verifier
                }): Promise<{ tokens: TokenSet }> { // Return type expected by Auth.js
                    const { provider, params, checks } = context;

                    const response = await fetch(provider.token.url!, {
                        method: "POST",
                        // Remove Content-Type header, fetch will set it for FormData
                        body: (() => {
                            const formData = new FormData();
                            formData.append("client_id", provider.clientId!);
                            formData.append("client_secret", provider.clientSecret!);
                            formData.append("grant_type", "authorization_code");
                            formData.append("code", params.get("code")!);
                            formData.append("redirect_uri", `${process.env.NEXTAUTH_URL}/api/auth/callback/${provider.id}`);
                            formData.append("code_verifier", checks.pkce);
                            return formData;
                        })(),
                    });

                    const tokens: TokenSet & { user_id?: number, error?: string, error_message?: string } = await response.json();

                    // 디버깅: 토큰 응답 로그
                    console.log("Threads Token Response:", tokens);

                    if (!response.ok || tokens.error || !tokens.access_token) {
                        console.error("Threads Token Error:", tokens.error_message || tokens.error || "Failed to retrieve access token");
                        throw new Error(tokens.error_message || "Failed to retrieve access token from Threads");
                    }

                    // Construct the TokenSet in the format Auth.js expects
                    const constructedTokens: TokenSet = {
                        access_token: tokens.access_token,
                        token_type: "bearer", // Explicitly set token_type because Threads doesn't return it
                        // Add other standard fields if returned by Threads (e.g., expires_in, scope)
                        // expires_in: tokens.expires_in,
                        // scope: tokens.scope,
                    };

                    // Return the tokens in the expected wrapper object
                    return { tokens: constructedTokens };
                }
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
            if (account?.provider === "threads") {
                const threadsUserId = user.id; // profile 콜백에서 매핑된 id (Threads ID)
                const username = user.name; // profile 콜백에서 매핑된 name
                const imageUrl = user.image; // profile 콜백에서 매핑된 image
                // profile 객체에서 직접 접근도 가능 (signIn의 profile 파라미터)
                const threadsProfile = profile as ThreadsProfile;
                const biography = threadsProfile?.threads_biography; // profile 콜백에서 직접 가져오거나 매핑된 데이터 사용

                if (!threadsUserId) {
                    console.error("Threads user ID not found in signIn callback");
                    return false; // 필수 정보 없으면 로그인 실패
                }

                try {
                    const supabase = getSupabaseAdmin();
                    const { error } = await supabase
                        .from("threads_users") // 5단계에서 생성할 테이블 이름
                        .upsert(
                            {
                                id: threadsUserId, // Primary Key
                                username: username,
                                profile_image_url: imageUrl,
                                name: threadsProfile?.name, // 추가 정보
                                biography: biography, // 추가 정보
                                updated_at: new Date().toISOString(),
                            },
                            {
                                onConflict: "id", // id 컬럼 기준으로 중복 시 업데이트
                            }
                        );

                    if (error) {
                        console.error("Supabase upsert error:", error);
                        return false; // DB 에러 시 로그인 실패
                    }
                    console.log("Threads user upserted successfully:", threadsUserId);
                } catch (err) {
                    console.error("Supabase operation failed:", err);
                    return false; // 예외 발생 시 로그인 실패
                }
            }
            // 다른 provider 또는 정상적인 경우 로그인 허용
            return true;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async jwt({ token, user, account, profile: _profile, trigger }) { // Mark profile as unused and disable eslint rule
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
        async session({ session, token }) {
            // JWT 전략 사용 시, jwt 콜백 이후 호출됨
            // console.log("Session Callback:", { session, token }); // 디버깅용 로그
            // jwt 콜백에서 추가한 정보를 session 객체에 담아 클라이언트에 전달
            if (token.sub && session.user) {
                session.user.id = token.sub; // 세션의 user 객체에 ID 할당 (중요!)
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
} satisfies NextAuthConfig;

// authConfig를 사용하여 NextAuth 핸들러와 auth 함수를 export
export const { handlers, auth, signIn: authSignIn, signOut: authSignOut } = NextAuth(authConfig);