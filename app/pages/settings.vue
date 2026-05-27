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

      <v-card rounded="lg" class="mb-4">
        <v-card-title>
          <v-icon class="mr-2">mdi-connection</v-icon>Default Tools
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-3">Tools enabled when chatting without a persona. Requires a tool-capable model (e.g. llama3.1, qwen2.5).</div>
          <template v-if="mcpServers && mcpServers.length > 0">
            <v-checkbox
              v-for="srv in mcpServers"
              :key="srv.id"
              v-model="defaultToolIds"
              :value="srv.id"
              :label="srv.name"
              density="compact"
              hide-details
              @update:model-value="saveDefaultTools"
            />
          </template>
          <div v-else class="text-caption text-medium-emphasis">
            No MCP servers configured. <a href="/mcp" class="text-primary">Add one</a> first.
          </div>
        </v-card-text>
      </v-card>

      <v-card rounded="lg">
        <v-card-title>
          <v-icon class="mr-2">mdi-folder</v-icon>Storage
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis">
            Data is stored in an encrypted SQLite database at <code>.data/quickchat.sqlite</code>.
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { McpServer } from '~/types'

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const config = useRuntimeConfig()
const ollamaBaseUrl = config.public.ollamaBaseUrl
const ollamaStatus = ref<'idle' | 'checking' | 'connected' | 'error'>('idle')
const models = ref<Array<{ name: string }>>([])

const { data: mcpServers } = await useFetch<McpServer[]>('/api/mcp', { server: false, lazy: true })

const DEFAULT_TOOLS_KEY = 'quickchat:defaultToolIds'
const defaultToolIds = ref<string[]>(
  JSON.parse(typeof localStorage !== 'undefined' ? (localStorage.getItem(DEFAULT_TOOLS_KEY) ?? '[]') : '[]'),
)

function saveDefaultTools() {
  localStorage.setItem(DEFAULT_TOOLS_KEY, JSON.stringify(defaultToolIds.value))
}

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
