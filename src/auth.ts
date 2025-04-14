import NextAuth from "next-auth";
import type { Session, DefaultSession, AuthOptions } from "next-auth";

// Augment the Session interface (Keep for potential session usage later)
declare module "next-auth" {
    interface Session {
        user?: {
            id?: string | null;
        } & DefaultSession["user"];
    }
}

// Minimal AuthOptions - providers, callbacks etc. removed for testing
export const authConfig: AuthOptions = {
    providers: [], // Add empty providers array to satisfy AuthOptions type
    // callbacks: {}, // Keep removed
    // session: { strategy: "jwt" }, // Keep removed
    // secret: process.env.AUTH_SECRET, // Secret might be needed even for basic init
};

// Initialize NextAuth with minimal config and export handlers
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);