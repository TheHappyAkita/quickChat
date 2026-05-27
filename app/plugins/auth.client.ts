// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  try {
    const result = await $fetch<{ username: string }>('/api/auth/me')
    authStore.setAuth(result.username)
  } catch {
    authStore.clearAuth()
  }
})
