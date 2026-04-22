export const dynamic = 'force-dynamic'

// app/api/share/route.ts
// GET  /api/share?projectId=xxx  or  ?layoutId=xxx  — list shares for a resource
// POST /api/share                                    — create / upsert a share

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function isOwnerOrAdmin(userId: string, isAdmin: boolean, projectId?: string | null, layoutId?: string | null) {
  if (isAdmin) return true
  if (projectId) {
    const p = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } })
    return !!p
  }
  if (layoutId) {
    const l = await prisma.layout.findFirst({
      where: { id: layoutId, project: { ownerId: userId } },
    })
    return !!l
  }
  return false
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const isAdmin = (session.user as any).role === 'ADMIN'
  const projectId = req.nextUrl.searchParams.get('projectId')
  const layoutId = req.nextUrl.searchParams.get('layoutId')

  if (!projectId && !layoutId) {
    return NextResponse.json({ error: 'projectId or layoutId required' }, { status: 400 })
  }

  const allowed = await isOwnerOrAdmin(userId, isAdmin, projectId, layoutId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shares = await (prisma as any).sharePermission.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(layoutId ? { layoutId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(shares)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const isAdmin = (session.user as any).role === 'ADMIN'
  const body = await req.json()
  const { projectId, layoutId, userId: targetUserId, permission = 'VIEW' } = body

  if (!targetUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!projectId && !layoutId) return NextResponse.json({ error: 'projectId or layoutId required' }, { status: 400 })
  if (targetUserId === userId) return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 })
  if (!['VIEW', 'EDIT'].includes(permission)) return NextResponse.json({ error: 'Invalid permission' }, { status: 400 })

  const allowed = await isOwnerOrAdmin(userId, isAdmin, projectId, layoutId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Upsert
  const existing = await (prisma as any).sharePermission.findFirst({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(layoutId ? { layoutId } : {}),
      userId: targetUserId,
    },
  })

  let share
  if (existing) {
    share = await (prisma as any).sharePermission.update({
      where: { id: existing.id },
      data: { permission },
      include: {
        user: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    })
  } else {
    share = await (prisma as any).sharePermission.create({
      data: {
        ...(projectId ? { projectId } : {}),
        ...(layoutId ? { layoutId } : {}),
        userId: targetUserId,
        permission,
        grantedById: userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    })
  }

  return NextResponse.json(share, { status: 201 })
}
