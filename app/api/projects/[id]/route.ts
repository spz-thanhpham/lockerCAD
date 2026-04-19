export const dynamic = 'force-dynamic'

// app/api/projects/[id]/route.ts
// PUT    /api/projects/:id  — rename company
// DELETE /api/projects/:id  — delete company (cascades layouts)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ownsProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId } })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownsProject(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: { name: name.trim() },
    include: { _count: { select: { layouts: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownsProject(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.project.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
