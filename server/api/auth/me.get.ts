// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { getSessionUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const username = getSessionUser(event)
  if (!username) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return { username }
})
