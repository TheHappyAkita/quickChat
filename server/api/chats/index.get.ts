// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { decryptForUser } from '../../utils/dbInit'
import type { ChatSession, ChatListItem } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const db = useDatabase()

  const { rows } = await db.sql`
    SELECT id, updated_at, payload
    FROM chats
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `

  const results: ChatListItem[] = (rows ?? []).map((row: Record<string, unknown>) => {
    try {
      const session = JSON.parse(decryptForUser(userId, row.payload as string)) as ChatSession
      return {
        id: row.id as string,
        title: session.title,
        personaName: session.personaName,
        updatedAt: row.updated_at as number,
        messageCount: session.messages.length,
      }
    } catch {
      return null
    }
  }).filter(Boolean) as ChatListItem[]

  return results
})
