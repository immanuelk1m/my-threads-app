// Merge imports and add Session type
import { type AuthOptions, type User, type DefaultSession, type Session } from "next-auth"; // Removed unused default NextAuth import
import { JWT } from "next-auth/jwt"; // Import JWT type for callback
import CredentialsProvider from "next-auth/providers/credentials"; // Import a provider for v4

// Augment the default types to include the user ID
declare module "next-auth" {
    interface Session {
        user: {
            id: string; // Add the id property
        } & DefaultSession["user"]; // Extend the default user properties (name, email, image)
    }

    interface User { // Augment the User type returned by authorize callback
        id: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT { // Augment the JWT type
        id?: string;
    }
}

// Define AuthOptions for NextAuth v4
export const authOptions: AuthOptions = {
    providers: [
        // Add a dummy Credentials provider for basic setup
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, _req) { // Mark req as unused
                // Add your own logic here to find the user
                // IMPORTANT: Returning null triggers an error page, returning a user object signs them in.
                // For this fix, we just return a dummy user if credentials exist.
                if (credentials) {
                    return { id: "1", name: "Dummy User", email: "dummy@example.com" };
                }
                return null;
            }
        })
    ],
    secret: process.env.AUTH_SECRET, // Use AUTH_SECRET from environment variables
    session: {
        strategy: "jwt", // Use JWT strategy for session management
    },
    callbacks: {
        // JWT callback: Called whenever a JWT is created or updated.
        // We add the user ID to the token here.
        async jwt({ token, user }: { token: JWT; user?: User }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        // Session callback: Called whenever a session is checked.
        // We get the user ID from the token and add it to the session object.
        async session({ session, token }: { session: Session; token: JWT }) {
            if (token?.id && session.user) {
                session.user.id = token.id;
            }
            return session;
        },
    },
    // pages: { signIn: '/auth/signin' }, // Optional: Define custom pages if needed
};

// Note: In v4, we typically export the options object directly.
// The NextAuth() function itself is usually called within the API route handler.