// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser, decryptForUser } from '../../utils/dbInit'
import type { ChatSession } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const body = await readBody<Partial<ChatSession>>(event)
  const db = useDatabase()
  const { rows } = await db.sql`SELECT payload FROM chats WHERE id = ${id} AND user_id = ${userId}`
  const row = (rows ?? [])[0] as Record<string, unknown> | undefined
  if (!row) throw createError({ statusCode: 404, message: 'Chat not found' })

  const session = JSON.parse(decryptForUser(userId, row.payload as string)) as ChatSession
  if (body.title !== undefined) session.title = body.title
  if (body.personaId !== undefined) session.personaId = body.personaId
  if (body.personaName !== undefined) session.personaName = body.personaName
  if (body.model !== undefined) session.model = body.model
  if (body.messages !== undefined) session.messages = body.messages
  if (body.contextSummary !== undefined) session.contextSummary = body.contextSummary
  if (body.summarizedUpTo !== undefined) session.summarizedUpTo = body.summarizedUpTo
  session.updatedAt = Date.now()

  const payload = encryptForUser(userId, JSON.stringify(session))
  await db.sql`
    UPDATE chats
    SET payload = ${payload}, updated_at = ${session.updatedAt}
    WHERE id = ${id} AND user_id = ${userId}
  `
  return session
})
