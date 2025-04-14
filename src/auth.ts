import NextAuth from "next-auth";
import type { Profile, User, Account, Session, DefaultSession, AuthOptions } from "next-auth";
// Removed unused OAuthConfig import
import type { JWT } from "next-auth/jwt";

// Augment the Session interface to include the user ID
declare module "next-auth" {
    interface Session {
        user?: {
            id?: string | null; // Add id property
        } & DefaultSession["user"];
    }
}

// Threads API 응답 타입 정의
interface ThreadsProfile extends Profile {
    id: string;
    username: string;
    name?: string;
    threads_profile_picture_url?: string;
    threads_biography?: string;
}

export const authConfig: AuthOptions = {
    providers: [
        // Original Threads Custom OAuth Provider (Simplified for Edge)
        {
            id: "threads",
            name: "Threads",
            type: "oauth",
            clientId: process.env.AUTH_THREADS_ID ?? '', // Ensure string
            clientSecret: process.env.AUTH_THREADS_SECRET ?? '', // Ensure string
            authorization: {
                url: "https://threads.net/oauth/authorize",
                params: { scope: "threads_basic" },
            },
            token: "https://graph.threads.net/oauth/access_token", // Use URL string directly
            userinfo: {
                 url: "https://graph.threads.net/v1.0/me",
                 params: { fields: "id,username,threads_profile_picture_url" }, // Request minimal fields needed for profile
                 // Rely on default request handling
            },
            profile(profile: ThreadsProfile): User {
                 // Map essential fields, ensure id is string
                 return {
                     id: profile.id, // Must be string
                     name: profile.username, // Use username as primary name
                     email: null, // Threads doesn't provide email
                     image: profile.threads_profile_picture_url,
                 };
            },
            // Ensure client config is compatible or rely on defaults if possible
             client: {
                 token_endpoint_auth_method: 'client_secret_post',
             },
        }
    ],
    callbacks: {
        // Keep JWT and Session callbacks minimal for Edge compatibility
        async jwt({ token, user, account }: { token: JWT, user?: User, account?: Account | null }) {
            if (account && user) {
                // Persist the user ID from profile to the token
                token.sub = user.id; // Use 'sub' claim for user ID (standard)
                // Add other minimal necessary info if needed
            }
            return token;
        },
        async session({ session, token }: { session: Session, token: JWT }) {
            // Add user ID to the session object
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        // signIn callback removed as DB operations are not Edge compatible here
    },
    session: {
        strategy: "jwt",
    },
    // debug: false, // Ensure debug is off
};

// Revert to exporting handlers object along with others
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);