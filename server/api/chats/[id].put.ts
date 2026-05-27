// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser } from '../../utils/dbInit'
import type { ChatSession } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const body = await readBody<Partial<ChatSession>>(event)
  const now = Date.now()
  const session: ChatSession = {
    id,
    title: body.title || 'Untitled',
    personaId: body.personaId ?? null,
    personaName: body.personaName ?? null,
    messages: body.messages || [],
    createdAt: body.createdAt || now,
    updatedAt: now,
  }

  const payload = encryptForUser(userId, JSON.stringify(session))
  const db = useDatabase()
  await db.sql`
    UPDATE chats
    SET payload = ${payload}, updated_at = ${session.updatedAt}
    WHERE id = ${id} AND user_id = ${userId}
  `
  return session
})
