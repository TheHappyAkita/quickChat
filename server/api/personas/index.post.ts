// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser } from '../../utils/dbInit'
import type { AiPersona } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<Partial<AiPersona>>(event)
  if (!body.name) throw createError({ statusCode: 400, message: 'Name required' })

  const now = Date.now()
  const persona: AiPersona = {
    id: `persona_${now}_${Math.random().toString(36).slice(2)}`,
    name: body.name,
    description: body.description || '',
    systemPrompt: body.systemPrompt || '',
    model: body.model || 'llama3',
    temperature: body.temperature ?? 0.7,
    enabledMcpServerIds: body.enabledMcpServerIds ?? [],
    createdAt: now,
    updatedAt: now,
  }

  const payload = encryptForUser(userId, JSON.stringify(persona))
  const db = useDatabase()
  await db.sql`
    INSERT INTO personas (id, user_id, payload, created_at, updated_at)
    VALUES (${persona.id}, ${userId}, ${payload}, ${persona.createdAt}, ${persona.updatedAt})
  `
  return persona
})
