import type { ShareAudience } from '@shared/types'

export const audiences: ShareAudience[] = [
  { id: 'product', name: 'Product team', kind: 'group', avatar: 'PT', detail: '12 members', color: '#6b5bd2' },
  { id: 'leadership', name: 'Leadership', kind: 'group', avatar: 'LD', detail: '6 members', color: '#247f73' },
  { id: 'maya', name: 'Maya Chen', kind: 'person', avatar: 'MC', detail: 'Product · Editor', color: '#93451f' },
  { id: 'jon', name: 'Jon Bell', kind: 'person', avatar: 'JB', detail: 'Data · Viewer', color: '#3674b5' },
  { id: 'aurora', name: 'Aurora pilot', kind: 'group', avatar: 'AH', detail: '4 guests', color: '#b14e69' }
]
