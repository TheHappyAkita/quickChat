<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll">
    <v-container>
      <v-row class="mb-4" align="center">
        <v-col>
          <h1 class="text-h5 font-weight-bold">AI Personas</h1>
        </v-col>
        <v-col cols="auto">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
            New Persona
          </v-btn>
        </v-col>
      </v-row>

      <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" />

      <v-card v-if="!pending && personas && personas.length === 0" variant="tonal" class="text-center pa-8">
        <v-icon size="64" color="medium-emphasis" class="mb-4">mdi-account-circle-outline</v-icon>
        <div class="text-h6">No personas yet</div>
        <div class="text-body-2 text-medium-emphasis mb-4">Create an AI persona with a custom system prompt</div>
        <v-btn color="primary" @click="openCreate">Create Persona</v-btn>
      </v-card>

      <v-row v-if="personas && personas.length > 0">
        <v-col v-for="persona in personas" :key="persona.id" cols="12" md="6" lg="4">
          <v-card rounded="lg" height="100%">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon color="primary">mdi-account-circle</v-icon>
              {{ persona.name }}
            </v-card-title>
            <v-card-subtitle>{{ persona.model }} · temp {{ persona.temperature }}</v-card-subtitle>
            <v-card-text>
              <div class="text-body-2 text-medium-emphasis mb-2">{{ persona.description || 'No description' }}</div>
              <v-chip size="small" variant="tonal" color="secondary" class="mt-1 mr-1">
                {{ persona.model }}
              </v-chip>
              <v-chip v-if="persona.enabledMcpServerIds?.length" size="small" variant="tonal" color="primary" class="mt-1">
                <v-icon start size="12">mdi-connection</v-icon>
                {{ persona.enabledMcpServerIds.length }} tool{{ persona.enabledMcpServerIds.length > 1 ? 's' : '' }}
              </v-chip>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" prepend-icon="mdi-pencil" @click="openEdit(persona)">Edit</v-btn>
              <v-spacer />
              <v-btn variant="text" color="error" icon="mdi-delete" @click="confirmDeletePersona(persona)" />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <v-dialog v-model="dialog" max-width="600">
      <v-card>
        <v-card-title>{{ editingPersona ? 'Edit Persona' : 'New Persona' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name *" variant="outlined" class="mb-3" />
          <v-text-field v-model="form.description" label="Description" variant="outlined" class="mb-3" />
          <v-select
            v-model="form.model"
            :items="modelItems"
            label="Model"
            variant="outlined"
            class="mb-3"
          />
          <v-slider
            v-model="form.temperature"
            label="Temperature"
            min="0"
            max="2"
            step="0.1"
            thumb-label
            class="mb-3"
          />
          <v-textarea
            v-model="form.systemPrompt"
            label="System Prompt"
            variant="outlined"
            rows="5"
            hint="Instructions that define this persona's behavior"
            class="mb-3"
          />
          <template v-if="mcpItems.length > 0">
            <div class="text-body-2 font-weight-medium mb-2">
              <v-icon size="16" class="mr-1">mdi-connection</v-icon>MCP Tools
            </div>
            <v-card variant="tonal" rounded="lg" class="pa-2 mb-1">
              <v-checkbox
                v-for="srv in mcpItems"
                :key="srv.id"
                v-model="form.enabledMcpServerIds"
                :value="srv.id"
                :label="srv.name"
                density="compact"
                hide-details
              />
            </v-card>
            <div class="text-caption text-medium-emphasis mb-2">Only enable for models that support tool calls (e.g. llama3.1, qwen2.5)</div>
          </template>
          <div v-else class="text-caption text-medium-emphasis mb-1">
            No MCP servers configured. <a href="/mcp" class="text-primary">Add one</a> to enable tools.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="savePersona">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete Persona</v-card-title>
        <v-card-text>Delete "{{ deletingPersona?.name }}"?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deletePersona">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { AiPersona, McpServer } from '~/types'

definePageMeta({ middleware: 'auth' })

const { data: personas, pending, refresh } = await useFetch<AiPersona[]>('/api/personas', { server: false, lazy: true })
const { data: models } = await useFetch<Array<{ name: string }>>('/api/ollama/models', { server: false, lazy: true })
const { data: mcpServers } = await useFetch<McpServer[]>('/api/mcp', { server: false, lazy: true })

const modelItems = computed(() => {
  const list = models.value?.map((m: { name: string }) => m.name) ?? []
  return list.length ? list : ['llama3', 'llama3.1', 'mistral', 'gemma3']
})
const mcpItems = computed(() => mcpServers.value ?? [])

const dialog = ref(false)
const saving = ref(false)
const editingPersona = ref<AiPersona | null>(null)
const deleteDialog = ref(false)
const deletingPersona = ref<AiPersona | null>(null)

const defaultForm = () => ({
  name: '',
  description: '',
  systemPrompt: '',
  model: 'llama3',
  temperature: 0.7,
  enabledMcpServerIds: [] as string[],
})
const form = ref(defaultForm())

function openCreate() {
  editingPersona.value = null
  form.value = defaultForm()
  dialog.value = true
}

function openEdit(persona: AiPersona) {
  editingPersona.value = persona
  form.value = {
    name: persona.name,
    description: persona.description,
    systemPrompt: persona.systemPrompt,
    model: persona.model,
    temperature: persona.temperature,
    enabledMcpServerIds: persona.enabledMcpServerIds ?? [],
  }
  dialog.value = true
}

async function savePersona() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    if (editingPersona.value) {
      await $fetch(`/api/personas/${editingPersona.value.id}`, { method: 'PUT', body: form.value })
    } else {
      await $fetch('/api/personas', { method: 'POST', body: form.value })
    }
    await refresh()
    dialog.value = false
  } finally {
    saving.value = false
  }
}

function confirmDeletePersona(persona: AiPersona) {
  deletingPersona.value = persona
  deleteDialog.value = true
}

async function deletePersona() {
  if (!deletingPersona.value) return
  await $fetch(`/api/personas/${deletingPersona.value.id}`, { method: 'DELETE' })
  await refresh()
  deleteDialog.value = false
}
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow-y: auto;
}
</style>
