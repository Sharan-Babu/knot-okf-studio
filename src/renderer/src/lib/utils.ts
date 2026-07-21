import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value > 9999 ? 'compact' : 'standard' }).format(value)
}

export function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function typeTone(type: string): string {
  const tones = ['violet', 'aqua', 'amber', 'rose', 'blue', 'sage']
  let hash = 0
  for (const char of type) hash = ((hash << 5) - hash) + char.charCodeAt(0)
  return tones[Math.abs(hash) % tones.length]
}

export function filenameFromTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function resolveDocumentLink(currentPath: string, href: string): string | null {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return null
  const parts = href.split(/[?#]/, 1)[0].split('/')
  const base = href.startsWith('/') ? [] : currentPath.split('/').slice(0, -1)
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') base.pop()
    else base.push(part)
  }
  let result = base.join('/')
  if (result.endsWith('/')) result += 'index.md'
  if (!result.endsWith('.md')) result += '.md'
  return result.replace(/\.md$/i, '')
}
