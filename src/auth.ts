import NextAuth from "next-auth";
import type { DefaultSession, AuthOptions } from "next-auth";
import GitHub from "next-auth/providers/github";

// Augment the Session interface (minimal version needed for basic functionality)
declare module "next-auth" {
    interface Session {
        user?: {
            id?: string | null;
        } & DefaultSession["user"];
    }
}

export const authConfig: AuthOptions = {
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID ?? '',
            clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
        }),
    ],
    // Callbacks removed for testing Edge compatibility
    // session: { strategy: "jwt" }, // Also removed for simplicity, defaults might work
    // debug: false, // Explicitly set to false or remove
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);