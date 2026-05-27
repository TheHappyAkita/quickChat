<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <v-app :theme="theme">
    <template v-if="authStore.isAuthenticated">
      <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
        <template #prepend>
          <v-list-item
            prepend-icon="mdi-chat-processing"
            title="quickChat"
            nav
          >
            <template #append>
              <v-btn
                :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
                variant="text"
                size="small"
                @click.stop="rail = !rail"
              />
            </template>
          </v-list-item>
          <v-divider />
        </template>
        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-chat-plus"
            title="New Chat"
            value="new-chat"
            @click="navigateTo('/chat/new')"
          />
          <v-list-item
            prepend-icon="mdi-chat-outline"
            title="Chats"
            value="chats"
            @click="navigateTo('/chats')"
          />
          <v-list-item
            prepend-icon="mdi-account-circle"
            title="AI Personas"
            value="personas"
            @click="navigateTo('/personas')"
          />
          <v-list-item
            prepend-icon="mdi-connection"
            title="MCP Servers"
            value="mcp"
            @click="navigateTo('/mcp')"
          />
          <v-list-item
            prepend-icon="mdi-graph"
            title="Knowledge Graph"
            value="graph"
            @click="navigateTo('/graph')"
          />
          <v-list-item
            prepend-icon="mdi-cog"
            title="Settings"
            value="settings"
            @click="navigateTo('/settings')"
          />
        </v-list>
        <template #append>
          <v-divider />
          <v-list density="compact" nav>
            <v-list-item
              prepend-icon="mdi-brightness-6"
              title="Toggle Theme"
              @click="toggleTheme"
            />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Logout"
              @click="logout"
            />
          </v-list>
        </template>
      </v-navigation-drawer>
      <v-main>
        <slot />
      </v-main>
    </template>
    <template v-else>
      <v-main>
        <slot />
      </v-main>
    </template>
  </v-app>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const drawer = ref(true)
const rail = ref(false)
const theme = ref('dark')

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  authStore.clearAuth()
  navigateTo('/login')
}
</script>
