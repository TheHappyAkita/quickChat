// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { decryptForUser, encryptForUser } from '../../utils/dbInit'
import type { AiPersona } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = useDatabase()
  const { rows } = await db.sql`
    SELECT payload FROM personas WHERE id = ${id} AND user_id = ${userId}
  `
  const row = (rows ?? [])[0] as Record<string, unknown> | undefined
  if (!row) throw createError({ statusCode: 404, message: 'Persona not found' })

  const existing = JSON.parse(decryptForUser(userId, row.payload as string)) as AiPersona
  const body = await readBody<Partial<AiPersona>>(event)
  const updated: AiPersona = { ...existing, ...body, id, updatedAt: Date.now() }

  const payload = encryptForUser(userId, JSON.stringify(updated))
  await db.sql`
    UPDATE personas
    SET payload = ${payload}, updated_at = ${updated.updatedAt}
    WHERE id = ${id} AND user_id = ${userId}
  `
  return updated
})
