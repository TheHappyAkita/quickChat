<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll">
    <v-container>
      <v-row class="mb-4" align="center">
        <v-col>
          <h1 class="text-h5 font-weight-bold">Chats</h1>
        </v-col>
        <v-col cols="auto">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="navigateTo('/chat/new')">
            New Chat
          </v-btn>
        </v-col>
      </v-row>

      <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" />

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
        Failed to load chats
      </v-alert>

      <v-card v-if="!pending && chats && chats.length === 0" variant="tonal" class="text-center pa-8">
        <v-icon size="64" color="medium-emphasis" class="mb-4">mdi-chat-outline</v-icon>
        <div class="text-h6">No chats yet</div>
        <div class="text-body-2 text-medium-emphasis mb-4">Start a new conversation with an AI persona</div>
        <v-btn color="primary" @click="navigateTo('/chat/new')">Start Chatting</v-btn>
      </v-card>

      <v-list v-if="chats && chats.length > 0" lines="two">
        <v-list-item
          v-for="chat in chats"
          :key="chat.id"
          :title="chat.title"
          :subtitle="chat.personaName ? `${chat.personaName} · ${chat.messageCount} messages` : `${chat.messageCount} messages`"
          :to="`/chat/${chat.id}`"
          rounded="lg"
          class="mb-2"
        >
          <template #prepend>
            <v-avatar color="primary" variant="tonal">
              <v-icon>mdi-chat</v-icon>
            </v-avatar>
          </template>
          <template #append>
            <div class="text-caption text-medium-emphasis">
              {{ formatDate(chat.updatedAt) }}
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import type { ChatListItem } from '~/types'

definePageMeta({ middleware: 'auth' })

const { data: chats, pending, error } = await useFetch<ChatListItem[]>('/api/chats', { server: false, lazy: true })

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow-y: auto;
}
</style>
