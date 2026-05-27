<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card elevation="8" rounded="lg">
          <v-card-title class="text-center pa-6">
            <v-icon size="48" color="primary" class="mb-2">mdi-chat-processing</v-icon>
            <div class="text-h4 font-weight-bold">quickChat</div>
            <div class="text-subtitle-1 text-medium-emphasis">Personal AI Chat</div>
          </v-card-title>
          <v-card-text class="px-6 pb-6">
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                autofocus
              />
              <v-text-field
                v-model="password"
                label="Password"
                prepend-inner-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                class="mb-4"
                :disabled="loading"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-alert
                v-if="error"
                type="error"
                variant="tonal"
                class="mb-4"
                :text="error"
              />
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
              >
                Sign In
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Please enter username and password'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ username: string }>('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    authStore.setAuth(result.username)
    navigateTo('/chats')
  } catch {
    error.value = 'Invalid username or password'
  } finally {
    loading.value = false
  }
}
</script>
