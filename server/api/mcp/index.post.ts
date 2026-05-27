// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser } from '../../utils/dbInit'
import type { McpServer } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<Partial<McpServer>>(event)
  if (!body.name) throw createError({ statusCode: 400, message: 'Name required' })
  if (!body.type) throw createError({ statusCode: 400, message: 'Type required' })

  const now = Date.now()
  const server: McpServer = {
    id: `mcp_${now}_${Math.random().toString(36).slice(2)}`,
    name: body.name,
    type: body.type,
    builtinId: body.builtinId,
    builtinConfig: body.builtinConfig ?? {},
    command: body.command,
    args: body.args ?? [],
    env: body.env ?? {},
    url: body.url,
    tools: body.tools ?? [],
    createdAt: now,
    updatedAt: now,
  }

  const payload = encryptForUser(userId, JSON.stringify(server))
  const db = useDatabase()
  await db.sql`INSERT INTO mcp_servers (id, user_id, payload, created_at, updated_at)
    VALUES (${server.id}, ${userId}, ${payload}, ${server.createdAt}, ${server.updatedAt})`
  return server
})
