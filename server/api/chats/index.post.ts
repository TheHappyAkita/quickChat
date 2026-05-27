// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser } from '../../utils/dbInit'
import type { ChatSession } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<Partial<ChatSession>>(event)

  const now = Date.now()
  const session: ChatSession = {
    id: body.id || `chat_${now}_${Math.random().toString(36).slice(2)}`,
    title: body.title || 'New Chat',
    personaId: body.personaId ?? null,
    personaName: body.personaName ?? null,
    messages: body.messages || [],
    createdAt: body.createdAt || now,
    updatedAt: now,
  }

  const payload = encryptForUser(userId, JSON.stringify(session))
  const db = useDatabase()
  await db.sql`
    INSERT INTO chats (id, user_id, payload, created_at, updated_at)
    VALUES (${session.id}, ${userId}, ${payload}, ${session.createdAt}, ${session.updatedAt})
  `
  return session
})
