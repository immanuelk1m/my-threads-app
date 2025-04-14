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
        {
          id: "threads",
          name: "Threads",
          type: "oauth",
          clientId: process.env.AUTH_THREADS_ID,
          clientSecret: process.env.AUTH_THREADS_SECRET,
          authorization: {
            url: "https://threads.net/oauth/authorize", // Verify this URL with Threads/Meta documentation
            params: { scope: "threads_basic" } // Verify required scopes
          },
          token: {
            url: "https://graph.threads.net/oauth/access_token",
            // Explicitly defining as an object, even with defaults, might help.
            // We rely on NextAuth.js defaults for method (POST) and params (grant_type, etc.)
          },
          userinfo: {
            url: "https://graph.threads.net/me", // Verify this URL and necessary fields
            params: { fields: "id,username" }  // Request basic user info
            // The userinfo request and basic parsing are often handled automatically
            // by NextAuth/Auth.js when url and params are provided.
            // Custom request logic is removed to rely on standard behavior first.
          },
          profile(profile: { id: string; username: string }) { // Use a specific type based on userinfo fields
            // This function maps the userinfo response (profile) to the NextAuth User object.
            // Ensure the fields match the structure returned by the Threads API userinfo endpoint.
            return {
              id: profile.id, // Map the 'id' from Threads API response
              name: profile.username, // Map the 'username' from Threads API response to 'name'
              // email: profile.email, // Map email if available and needed
              // image: profile.profile_picture_url, // Map image if available and needed
            };
          }
        }, // End of Threads Provider

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
    debug: true, // Enable NextAuth.js debug mode for detailed logs
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