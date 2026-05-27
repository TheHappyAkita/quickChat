// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { getJob, subscribeToJob } from '../../utils/jobRegistry'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const chatId = getQuery(event).chatId as string
  if (!chatId) throw createError({ statusCode: 400, message: 'chatId required' })

  const job = getJob(chatId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'No active job' })
  }

  const res = event.node.res
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data: string) => { try { res.write(`data: ${data}\n\n`) } catch {} }

  const unsubscribe = subscribeToJob(chatId, send)

  event.node.req.on('close', () => {
    if (unsubscribe) unsubscribe()
  })

  await new Promise<void>((resolve) => {
    event.node.req.on('close', resolve)
  })
})
