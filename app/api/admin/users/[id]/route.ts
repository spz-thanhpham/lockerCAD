export const dynamic = 'force-dynamic'

// app/api/admin/users/[id]/route.ts
// PATCH — update user
// DELETE — delete user + their accounts

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, role } = await req.json()
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { ...(name !== undefined && { name }), ...(email && { email }), ...(role && { role }) },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if ((session.user as any).id === params.id)
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
