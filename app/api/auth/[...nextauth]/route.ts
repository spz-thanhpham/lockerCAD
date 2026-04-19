// app/api/auth/[...nextauth]/route.ts
// force-dynamic prevents Next.js from statically analysing this route at build
// time, which would fail because Prisma requires a live DB connection.
export const dynamic = 'force-dynamic'

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
