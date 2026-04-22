export const dynamic = 'force-dynamic'

// app/api/share/[id]/route.ts
// DELETE /api/share/[id]  — revoke a share
// PATCH  /api/share/[id]  — update permission

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getShareAndCheckAccess(shareId: string, userId: string, isAdmin: boolean) {
  const share = await (prisma as any).sharePermission.findUnique({
    where: { id: shareId },
    include: {
      project: { select: { ownerId: true } },
      layout: { select: { project: { select: { ownerId: true } } } },
    },
  })
  if (!share) return { share: null, allowed: false }

  if (isAdmin) return { share, allowed: true }

  const ownerId = share.project?.ownerId ?? share.layout?.project?.ownerId
  const allowed = ownerId === userId
  return { share, allowed }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const isAdmin = (session.user as any).role === 'ADMIN'

  const { share, allowed } = await getShareAndCheckAccess(params.id, userId, isAdmin)
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await (prisma as any).sharePermission.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const isAdmin = (session.user as any).role === 'ADMIN'

  const body = await req.json()
  const { permission } = body
  if (!['VIEW', 'EDIT'].includes(permission)) {
    return NextResponse.json({ error: 'Invalid permission' }, { status: 400 })
  }

  const { share, allowed } = await getShareAndCheckAccess(params.id, userId, isAdmin)
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await (prisma as any).sharePermission.update({
    where: { id: params.id },
    data: { permission },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(updated)
}
