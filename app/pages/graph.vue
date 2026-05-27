<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll">
    <v-container fluid class="pa-0 fill-height">
      <div ref="graphContainer" class="graph-container" />
    </v-container>
    <div class="graph-overlay">
      <v-card class="pa-3" rounded="lg" elevation="4" style="min-width: 200px">
        <div class="text-subtitle-2 mb-2">Knowledge Graph</div>
        <div class="text-caption text-medium-emphasis">{{ nodeCount }} chats · {{ edgeCount }} connections</div>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatListItem } from '~/types'

definePageMeta({ middleware: 'auth' })

const graphContainer = ref<HTMLElement | null>(null)
const nodeCount = ref(0)
const edgeCount = ref(0)

const { data: chats } = await useFetch<ChatListItem[]>('/api/chats', { server: false, lazy: true })

onMounted(async () => {
  watch(chats, buildGraph, { immediate: true })
})

async function buildGraph(items: ChatListItem[] | null) {
  if (!items || !graphContainer.value) return

  const cytoscape = (await import('cytoscape')).default

  const nodes = items.map(chat => ({
    data: { id: chat.id, label: chat.title, persona: chat.personaName ?? 'None' },
  }))

  const personaGroups: Record<string, string[]> = {}
  for (const chat of items) {
    const key = chat.personaName ?? '__none__'
    if (!personaGroups[key]) personaGroups[key] = []
    personaGroups[key].push(chat.id)
  }

  const edges: Array<{ data: { id: string; source: string; target: string } }> = []
  for (const group of Object.values(personaGroups)) {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({ data: { id: `e_${group[i]}_${group[i + 1]}`, source: group[i], target: group[i + 1] } })
    }
  }

  nodeCount.value = nodes.length
  edgeCount.value = edges.length

  graphContainer.value.innerHTML = ''

  const cy = cytoscape({
    container: graphContainer.value,
    elements: { nodes, edges },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#7C4DFF',
          'label': 'data(label)',
          'color': '#ffffff',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'width': '60px',
          'height': '60px',
          'text-wrap': 'wrap',
          'text-max-width': '55px',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': '#555',
          'curve-style': 'bezier',
          'opacity': 0.6,
        },
      },
      {
        selector: 'node:selected',
        style: { 'background-color': '#03DAC6' },
      },
    ],
    layout: { name: 'cose', padding: 40 },
  })

  cy.on('tap', 'node', (evt: { target: { id(): string } }) => {
    const id = evt.target.id()
    navigateTo(`/chat/${id}`)
  })
}
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow: hidden;
  position: relative;
}
.graph-container {
  width: 100%;
  height: 100%;
}
.graph-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}
</style>
