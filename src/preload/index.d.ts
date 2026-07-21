import type { KnotAPI } from '../shared/types'

declare global {
  interface Window {
    knot: KnotAPI
  }
}

export {}
