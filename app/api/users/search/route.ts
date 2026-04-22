export const dynamic = 'force-dynamic'

// app/api/users/search/route.ts
// GET /api/users/search?q=searchterm  — search users by name or email

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const q = req.nextUrl.searchParams.get('q') ?? ''

  if (q.trim().length < 2) return NextResponse.json([])

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 8,
  })

  return NextResponse.json(users)
}
