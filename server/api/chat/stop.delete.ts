// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { abortJob } from '../../utils/jobRegistry'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const chatId = getQuery(event).chatId as string
  if (!chatId) throw createError({ statusCode: 400, message: 'chatId required' })
  const stopped = abortJob(chatId)
  return { stopped }
})
