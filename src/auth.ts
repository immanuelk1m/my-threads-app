import NextAuth from "next-auth";
import { authConfig } from "./auth.config"; // Import the separated config

// authConfig를 사용하여 NextAuth 핸들러와 auth 함수를 export
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);