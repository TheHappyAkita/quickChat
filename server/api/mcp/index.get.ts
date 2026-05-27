// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { decryptForUser } from '../../utils/dbInit'
import type { McpServer } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const db = useDatabase()
  const { rows } = await db.sql`SELECT payload FROM mcp_servers WHERE user_id = ${userId}`
  const servers = ((rows ?? []) as Record<string, unknown>[]).map((row) => {
    try {
      return JSON.parse(decryptForUser(userId, row.payload as string)) as McpServer
    } catch {
      return null
    }
  }).filter(Boolean) as McpServer[]
  return servers.sort((a, b) => a.name.localeCompare(b.name))
})
