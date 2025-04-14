import NextAuth from "next-auth";
import { authOptions } from "@/auth"; // Import the v4 authOptions

// In v4 App Router, you initialize NextAuth directly in the route handler
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests
export { handler as GET, handler as POST };