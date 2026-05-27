// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser, decryptForUser } from '../../utils/dbInit'
import type { McpServer } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<Partial<McpServer>>(event)

  const db = useDatabase()
  const { rows } = await db.sql`SELECT payload FROM mcp_servers WHERE id = ${id} AND user_id = ${userId}`
  const row = ((rows ?? []) as Record<string, unknown>[])[0]
  if (!row) throw createError({ statusCode: 404, message: 'Not found' })

  const existing = JSON.parse(decryptForUser(userId, row.payload as string)) as McpServer
  const updated: McpServer = {
    ...existing,
    name: body.name ?? existing.name,
    type: body.type ?? existing.type,
    builtinId: body.builtinId ?? existing.builtinId,
    builtinConfig: body.builtinConfig ?? existing.builtinConfig ?? {},
    command: body.command,
    args: body.args ?? [],
    env: body.env ?? {},
    url: body.url,
    tools: body.tools ?? existing.tools ?? [],
    updatedAt: Date.now(),
  }

  const payload = encryptForUser(userId, JSON.stringify(updated))
  await db.sql`UPDATE mcp_servers SET payload = ${payload}, updated_at = ${updated.updatedAt} WHERE id = ${id} AND user_id = ${userId}`
  return updated
})
