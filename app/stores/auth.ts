// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const username = ref<string | null>(null)

  function setAuth(user: string) {
    isAuthenticated.value = true
    username.value = user
  }

  function clearAuth() {
    isAuthenticated.value = false
    username.value = null
  }

  return { isAuthenticated, username, setAuth, clearAuth }
})
