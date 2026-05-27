// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

const THUMBNAIL_THRESHOLD_BYTES = 200 * 1024

export interface ChatImage {
  dataUrl: string
  path: string
  size: number
}

export function extractImages(content: string): ChatImage[] {
  const images: ChatImage[] = []
  const re = /\[IMAGE:([^|]+)\|([^|]+)\|(\d+)\]/g
  let m
  while ((m = re.exec(content)) !== null) {
    images.push({ dataUrl: m[1]!, path: m[2]!, size: Number(m[3]) })
  }
  return images
}

export function renderWithImages(html: string, content: string): string {
  const re = /\[IMAGE:([^|]+)\|([^|]+)\|(\d+)\]/g
  return content.replace(re, (_match, dataUrl: string, path: string, sizeStr: string) => {
    const size = Number(sizeStr)
    const name = path.split(/[\\/]/).pop() ?? path
    if (size <= THUMBNAIL_THRESHOLD_BYTES) {
      return `<figure class="chat-image-figure">
  <img src="${dataUrl}" alt="${name}" class="chat-image-full" loading="lazy" />
  <figcaption class="chat-image-caption">${name} · ${(size / 1024).toFixed(1)} KB</figcaption>
</figure>`
    }
    return `<figure class="chat-image-figure">
  <a href="${dataUrl}" target="_blank" rel="noopener" title="Open full image: ${name}">
    <img src="${dataUrl}" alt="${name}" class="chat-image-thumb" loading="lazy" />
    <div class="chat-image-overlay"><span>🔍 Open full image</span></div>
  </a>
  <figcaption class="chat-image-caption">${name} · ${(size / 1024).toFixed(1)} KB — click to open full size</figcaption>
</figure>`
  })
}

export function processMessageContent(content: string): { html: string; hasImages: boolean } {
  const hasImages = /\[IMAGE:/.test(content)
  if (!hasImages) return { html: '', hasImages: false }
  const processed = renderWithImages('', content)
  return { html: processed, hasImages: true }
}
