// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const db = useDatabase()
  await db.sql`DELETE FROM mcp_servers WHERE id = ${id} AND user_id = ${userId}`
  return { ok: true }
})
