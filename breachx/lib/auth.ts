/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHubProvider from "next-auth/providers/github";
import prisma from './db';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubUsername: profile.login,
        }
      },
      // We need these scopes to access user's repositories
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }:any) {
      // Add user id and githubUsername to the session
      session.user.id = user.id;
      session.user.githubUsername = user.githubUsername;
      return session;
    },
    async jwt({ token, account, profile }:any) {
      // Add access token to the JWT if available
      if (account) {
        token.accessToken = account.access_token;
        if (profile) {
          token.githubUsername = profile.login;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
  session: {
    strategy: 'database' as const, // ✅ FIX: enforce literal type
  },
  secret: process.env.NEXTAUTH_SECRET,
};