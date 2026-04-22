export const dynamic = 'force-dynamic'

// app/api/admin/shares/route.ts
// GET /api/admin/shares  — admin: list all share permissions

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')

  const where: Record<string, unknown> = {}
  if (type === 'project') where.projectId = { not: null }
  if (type === 'layout') where.layoutId = { not: null }

  const shares = await (prisma as any).sharePermission.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      layout: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(shares)
}
