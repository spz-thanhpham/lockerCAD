export const dynamic = 'force-dynamic'

// app/api/admin/users/route.ts
// GET  — list all users
// POST — create user

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await (prisma.user as any).findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, image: true,
      role: true, createdAt: true,
      accounts: { select: { provider: true } },
    },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, name, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const user = await prisma.user.create({
    data: { email, name: name || null, role: role || 'DESIGNER' },
  })
  return NextResponse.json(user, { status: 201 })
}
