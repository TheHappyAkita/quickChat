// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { resolveToolCall } from '../../utils/toolCallRegistry'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const { callId, result } = await readBody<{ callId: string; result: string }>(event)
  if (!callId) throw createError({ statusCode: 400, message: 'callId required' })
  const resolved = resolveToolCall(callId, result ?? '')
  return { resolved }
})
