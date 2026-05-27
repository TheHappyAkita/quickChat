// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { initDb } from '../utils/dbInit'

export default defineNitroPlugin(async () => {
  await initDb()
})
