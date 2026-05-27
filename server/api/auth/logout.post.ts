// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { clearSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'qc_session')
  clearSessionCookie(event, token ?? undefined)
  return { ok: true }
})
