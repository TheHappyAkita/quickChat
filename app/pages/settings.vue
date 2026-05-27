<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll">
    <v-container>
      <h1 class="text-h5 font-weight-bold mb-6">Settings</h1>

      <v-card rounded="lg" class="mb-4">
        <v-card-title prepend-icon="mdi-account">
          <v-icon class="mr-2">mdi-account</v-icon>Account
        </v-card-title>
        <v-card-text>
          <div class="text-body-1">Logged in as <strong>{{ authStore.username }}</strong></div>
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" variant="tonal" prepend-icon="mdi-logout" @click="logout">
            Logout
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-card rounded="lg" class="mb-4">
        <v-card-title>
          <v-icon class="mr-2">mdi-robot</v-icon>Ollama Connection
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-3">
            Base URL: <code>{{ ollamaBaseUrl }}</code>
          </div>
          <v-chip
            :color="ollamaStatus === 'connected' ? 'success' : ollamaStatus === 'checking' ? 'warning' : 'error'"
            :prepend-icon="ollamaStatus === 'connected' ? 'mdi-check-circle' : ollamaStatus === 'checking' ? 'mdi-loading' : 'mdi-alert-circle'"
            variant="tonal"
          >
            {{ ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Not reachable' }}
          </v-chip>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" prepend-icon="mdi-refresh" @click="checkOllama">Check Connection</v-btn>
        </v-card-actions>
      </v-card>

      <v-card v-if="models && models.length > 0" rounded="lg" class="mb-4">
        <v-card-title>
          <v-icon class="mr-2">mdi-cube-outline</v-icon>Available Models
        </v-card-title>
        <v-card-text>
          <v-chip
            v-for="model in models"
            :key="model.name"
            class="mr-2 mb-2"
            variant="tonal"
            color="secondary"
          >
            {{ model.name }}
          </v-chip>
        </v-card-text>
      </v-card>

      <v-card rounded="lg">
        <v-card-title>
          <v-icon class="mr-2">mdi-folder</v-icon>Storage
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis">
            Chats are stored as encrypted Markdown files in <code>~/.quickChat/</code>
            (or the configured <code>STORAGE_DIR</code> environment variable).
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const config = useRuntimeConfig()
const ollamaBaseUrl = config.public.ollamaBaseUrl
const ollamaStatus = ref<'idle' | 'checking' | 'connected' | 'error'>('idle')
const models = ref<Array<{ name: string }>>([])

async function checkOllama() {
  ollamaStatus.value = 'checking'
  try {
    const result = await $fetch<Array<{ name: string }>>('/api/ollama/models')
    models.value = result
    ollamaStatus.value = 'connected'
  } catch {
    ollamaStatus.value = 'error'
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  authStore.clearAuth()
  navigateTo('/login')
}

onMounted(() => checkOllama())
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow-y: auto;
}
</style>
