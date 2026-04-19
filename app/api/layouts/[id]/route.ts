export const dynamic = 'force-dynamic'

// app/api/layouts/[id]/route.ts
// GET    /api/layouts/:id  — fetch single layout
// PUT    /api/layouts/:id  — update layout canvasData / name
// DELETE /api/layouts/:id  — delete layout

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ownsLayout(layoutId: string, userId: string) {
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, project: { ownerId: userId } },
  })
  return layout
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const layout = await ownsLayout(params.id, session.user.id)
  if (!layout) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(layout)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownsLayout(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, canvasData } = body

  const updated = await prisma.layout.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(canvasData && {
        canvasData,
        roomWidth: canvasData.room?.widthMm ?? existing.roomWidth,
        roomDepth: canvasData.room?.depthMm ?? existing.roomDepth,
        scale: canvasData.room?.scale ?? existing.scale,
        version: { increment: 1 },
      }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await ownsLayout(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.layout.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
