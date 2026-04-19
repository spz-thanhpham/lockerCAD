// lib/auth.ts
// NextAuth configuration

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // ── Admin / dev credentials login ──────────────────────────
    // Credentials are set via ADMIN_EMAIL + ADMIN_PASSWORD in .env
    // No SMTP required — useful for local dev and internal admin access.
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin account',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials?.password ||
          credentials.email    !== process.env.ADMIN_EMAIL ||
          credentials.password !== process.env.ADMIN_PASSWORD
        ) return null

        // Find-or-create the admin user in DB
        const user = await prisma.user.upsert({
          where:  { email: credentials.email },
          update: {},
          create: { email: credentials.email, name: 'Admin', role: 'ADMIN' },
        })

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),

    // ── Email magic-link ────────────────────────────────────────
    // Configure SMTP via EMAIL_SERVER_* env vars.
    // In dev with no SMTP, NextAuth logs the link to the terminal.
    EmailProvider({
      server: {
        host:   process.env.EMAIL_SERVER_HOST || 'localhost',
        port:   Number(process.env.EMAIL_SERVER_PORT) || 25,
        auth: {
          user: process.env.EMAIL_SERVER_USER || '',
          pass: process.env.EMAIL_SERVER_PASSWORD || '',
        },
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
      },
      from: process.env.EMAIL_FROM || 'noreply@lockerapp.com',
    }),

    // ── Google OAuth (optional) ─────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId:     process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      // Persist role into the JWT on first sign-in
      if (user) token.role = (user as any).role
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id   = token.sub!
        session.user.role = (token.role as string) ?? 'DESIGNER'
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
  },
}
