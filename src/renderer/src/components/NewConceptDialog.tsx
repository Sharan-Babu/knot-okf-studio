import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, FilePlus2, Globe2, LockKeyhole, UsersRound, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Avatar } from './ui/Avatar'
import { audiences } from '@/lib/audiences'
import { filenameFromTitle } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ShareUpdateMode, Visibility } from '@shared/types'

const suggestedTypes = ['Concept', 'Metric', 'Project', 'Playbook', 'Reference', 'Data Model', 'Person', 'Decision']

export function NewConceptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)
  const replaceBundle = useAppStore((state) => state.replaceBundle)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const addToast = useAppStore((state) => state.addToast)
  const reloadWorkspaceState = useAppStore((state) => state.reloadWorkspaceState)
  const [title, setTitle] = useState('')
  const [filename, setFilename] = useState('')
  const [type, setType] = useState('Concept')
  const [directory, setDirectory] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [selectedAudiences, setSelectedAudiences] = useState<Set<string>>(new Set())
  const [updateMode, setUpdateMode] = useState<ShareUpdateMode>('review')
  const [busy, setBusy] = useState(false)
  const directories = [...new Set(bundle?.documents.map((document) => document.path.includes('/') ? document.path.split('/')[0] : '').filter(Boolean) ?? [])]

  useEffect(() => {
    if (!open) return
    setTitle('')
    setFilename('')
    setType('Concept')
    setDirectory('')
    setDescription('')
    setVisibility('private')
    setSelectedAudiences(new Set())
    setUpdateMode('review')
  }, [open])

  const updateTitle = (value: string): void => {
    setTitle(value)
    setFilename(filenameFromTitle(value))
  }

  const create = async (): Promise<void> => {
    if (!title.trim() || !filename.trim() || !type.trim()) return
    setBusy(true)
    try {
      const next = await window.knot.workspace.createDocument({
        title,
        filename,
        type,
        directory: directory || undefined,
        description,
        tags: [],
        visibility,
        audienceIds: visibility === 'workspace' ? [...selectedAudiences] : [],
        allowDownload: visibility !== 'private',
        updateMode
      })
      replaceBundle(next)
      await reloadWorkspaceState()
      const path = `${directory ? `${directory}/` : ''}${filenameFromTitle(filename)}`
      selectDocument(path)
      addToast({ title: 'Concept created', description: `${path}.md`, tone: 'success' })
      onOpenChange(false)
    } catch (error) {
      addToast({ title: 'Could not create concept', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-icon"><FilePlus2 size={20} /></div>
          <Dialog.Title>New knowledge concept</Dialog.Title>
          <Dialog.Description>Create a portable OKF document with valid frontmatter from the start.</Dialog.Description>
          <Dialog.Close className="dialog-close" aria-label="Close"><X size={18} /></Dialog.Close>
          <div className="form-stack">
            <label className="field-label">Title<input autoFocus value={title} onChange={(event) => updateTitle(event.target.value)} placeholder="e.g. Customer retention metric" /></label>
            <div className="form-grid-2">
              <label className="field-label">Type<input list="concept-types" value={type} onChange={(event) => setType(event.target.value)} /></label>
              <datalist id="concept-types">{suggestedTypes.map((item) => <option key={item} value={item} />)}</datalist>
              <label className="field-label">Folder<select value={directory} onChange={(event) => setDirectory(event.target.value)}><option value="">Bundle root</option>{directories.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <label className="field-label">Filename<div className="input-suffix"><input value={filename} onChange={(event) => setFilename(filenameFromTitle(event.target.value))} placeholder="customer-retention" /><span>.md</span></div></label>
            <label className="field-label">One-line description<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Help people and agents understand when this concept is useful." /></label>
            <div className="creation-sharing">
              <span className="field-label">Sharing intent</span>
              <div className="visibility-segments" aria-label="Concept visibility">
                <button aria-pressed={visibility === 'private'} className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><LockKeyhole size={15} />Private</button>
                <button aria-pressed={visibility === 'workspace'} className={visibility === 'workspace' ? 'active' : ''} onClick={() => setVisibility('workspace')}><UsersRound size={15} />Workspace</button>
                <button aria-pressed={visibility === 'public'} className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}><Globe2 size={15} />Public</button>
              </div>
              <small>{visibility === 'private' ? 'Local only. This is the safest default.' : visibility === 'workspace' ? 'Marked for the people and groups you choose. Nothing is sent until you export or publish.' : 'Marked as eligible for public export. Nothing is sent yet; review sensitive content first.'}</small>
            </div>
            {visibility === 'workspace' && <div className="audience-picker creation-audiences"><span className="field-label">People and groups</span>{audiences.map((audience) => <button type="button" key={audience.id} aria-pressed={selectedAudiences.has(audience.id)} className={selectedAudiences.has(audience.id) ? 'selected' : ''} onClick={() => setSelectedAudiences((current) => { const next = new Set(current); next.has(audience.id) ? next.delete(audience.id) : next.add(audience.id); return next })}><Avatar name={audience.name} color={audience.color} size="sm" /><span><strong>{audience.name}</strong><small>{audience.detail}</small></span>{selectedAudiences.has(audience.id) && <Check size={15} />}</button>)}</div>}
            {visibility !== 'private' && <label className="field-label">When this concept changes<select value={updateMode} onChange={(event) => setUpdateMode(event.target.value as ShareUpdateMode)}><option value="review">Notify me to review and redistribute</option><option value="auto-prepare">Auto-prepare the next update</option></select></label>}
          </div>
          <div className="dialog-actions"><Dialog.Close asChild><Button>Cancel</Button></Dialog.Close><Button variant="primary" onClick={() => void create()} disabled={busy || !title || !filename || !type || (visibility === 'workspace' && !selectedAudiences.size)}>{busy ? 'Creating…' : 'Create concept'}</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
