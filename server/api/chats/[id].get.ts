// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { decryptForUser } from '../../utils/dbInit'
import type { ChatSession } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = useDatabase()
  const { rows } = await db.sql`
    SELECT payload FROM chats WHERE id = ${id} AND user_id = ${userId}
  `
  const row = rows?.[0] as Record<string, unknown> | undefined
  if (!row) throw createError({ statusCode: 404, message: 'Chat not found' })

  try {
    return JSON.parse(decryptForUser(userId, row.payload as string)) as ChatSession
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to decrypt chat' })
  }
})
