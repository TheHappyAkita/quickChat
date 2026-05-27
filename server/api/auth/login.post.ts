// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { validateCredentials, createSession, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: 'Username and password required' })
  }
  if (!await validateCredentials(body.username, body.password)) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }
  const token = createSession(body.username)
  setSessionCookie(event, token)
  return { username: body.username }
})
