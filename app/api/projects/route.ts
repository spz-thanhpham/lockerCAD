export const dynamic = 'force-dynamic'

// app/api/projects/route.ts
// GET  /api/projects  — list companies (projects) owned by current user
// POST /api/projects  — create a new company

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { layouts: true } },
    },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const project = await prisma.project.create({
    data: { name: name.trim(), ownerId: session.user.id },
    include: { _count: { select: { layouts: true } } },
  })

  return NextResponse.json(project, { status: 201 })
}
