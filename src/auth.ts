// Merge imports and add Session type
import { type AuthOptions, type User, type DefaultSession, type Session } from "next-auth"; // Removed unused default NextAuth import
import { JWT } from "next-auth/jwt"; // Import JWT type for callback
import CredentialsProvider from "next-auth/providers/credentials"; // Import a provider for v4
import { createClient } from '@supabase/supabase-js'; // Import Supabase client

// Initialize Supabase Admin Client (server-side only)
// TODO: Consider moving this to a separate utility file (e.g., src/lib/supabase.ts)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

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
            async request(context) {
              // context contains client_id, client_secret, params (code, redirect_uri), etc.
              console.log("[DEBUG] Token Request Context Params:", context.params);
              console.log("[DEBUG] Token Request Client ID:", context.provider.clientId);
              console.log("[DEBUG] Token Request Redirect URI:", context.params.redirect_uri);

              const body = new URLSearchParams();
              body.append('client_id', context.provider.clientId!);
              body.append('client_secret', context.provider.clientSecret!);
              body.append('grant_type', 'authorization_code');
              body.append('code', context.params.code!);
              body.append('redirect_uri', context.provider.callbackUrl!); // Use configured callbackUrl

              console.log("[DEBUG] Sending Token Request Body:", body.toString());

              try {
                const response = await fetch("https://graph.threads.net/oauth/access_token", { // Use the known URL directly
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body,
                });

                const responseBody = await response.text(); // Read body as text first for logging
                console.log("[DEBUG] Token Response Status:", response.status);
                console.log("[DEBUG] Token Response Body:", responseBody);

                if (!response.ok) {
                  // Throw error to be caught by NextAuth.js, include response body for context
                  throw new Error(`Token request failed with status ${response.status}: ${responseBody}`);
                }

                const tokens = JSON.parse(responseBody); // Parse JSON after logging
                // Ensure the returned object matches NextAuth.js expectations (e.g., access_token, scope, id_token, etc.)
                // Based on Threads docs, it returns access_token and user_id.
                // NextAuth expects at least access_token. We might need to adjust if other fields are mandatory.
                return { tokens }; // Return the parsed tokens wrapped in a 'tokens' object

              } catch (error) {
                console.error("[DEBUG] Error during custom token request:", error);
                // Re-throw the error so NextAuth.js can handle it and show the error page
                throw error;
              }
            }
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
        // signIn callback: Called after successful sign-in, before redirect.
        // We use this to save/update user data in Supabase.
        async signIn({ user, account, profile }) {
          console.log("--- signIn Callback Entered ---"); // Add log at the very beginning
          // Only run this logic for the 'threads' provider
          if (account?.provider === 'threads') {
            console.log("[DEBUG] signIn callback triggered for threads provider");
            console.log("[DEBUG] signIn user:", user);
            console.log("[DEBUG] signIn account:", account);
            console.log("[DEBUG] signIn profile:", profile); // Raw profile data from provider

            try {
              // Ensure necessary data exists from the account and user/profile objects
              const threadsUserId = account.providerAccountId;
              const accessToken = account.access_token;
              // Use user.name which should be mapped from profile.username in the profile callback
              const threadsUsername = user.name;

              if (!threadsUserId || !accessToken || !threadsUsername) {
                 console.error("[SIGNIN_CALLBACK] Missing required data for Supabase upsert", { threadsUserId, accessToken, threadsUsername });
                 // Returning false would prevent the user from signing in
                 // Decide if sign-in should fail if DB upsert fails
                 return false;
              }

              console.log(`[SIGNIN_CALLBACK] Upserting user: ${threadsUserId}, username: ${threadsUsername}`);

              const { error } = await supabaseAdmin
                .from('threads_users')
                .upsert(
                  {
                    threads_user_id: threadsUserId, // The unique ID from Threads
                    threads_username: threadsUsername,
                    access_token: accessToken, // Store the latest access token
                    // 'id' (uuid PK), 'created_at', 'updated_at' are handled by DB defaults/triggers
                  },
                  {
                    onConflict: 'threads_user_id', // If conflict on threads_user_id, update the row
                  }
                );

              if (error) {
                console.error('[SIGNIN_CALLBACK] Supabase upsert error:', error);
                // Decide if sign-in should fail on DB error. Returning false stops sign-in.
                return false;
              }

              console.log(`[SIGNIN_CALLBACK] Successfully upserted user ${threadsUserId} to Supabase.`);
              return true; // Allow sign-in to proceed

            } catch (err) {
              console.error('[SIGNIN_CALLBACK] Unexpected error during Supabase upsert:', err);
              return false; // Stop sign-in on unexpected errors
            }
          }
          // Allow sign-in for other providers (if any) or if it's not an OAuth sign-in
          return true;
        }
    },
    // pages: { signIn: '/auth/signin' }, // Optional: Define custom pages if needed
};

// Note: In v4, we typically export the options object directly.
// The NextAuth() function itself is usually called within the API route handler.