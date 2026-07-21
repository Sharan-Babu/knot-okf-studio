import { useState } from 'react'
import { ArrowUp, Bot, CheckCircle2, Copy, FileSearch, Lightbulb, LoaderCircle, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { MarkdownView } from '@/components/MarkdownView'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'

const suggestions = [
  { icon: FileSearch, title: 'Find missing context', prompt: 'Review this concept for important missing context, ambiguous claims, and unanswered reader questions. Return a prioritized list.' },
  { icon: WandSparkles, title: 'Improve for agents', prompt: 'Suggest concrete structural improvements that make this concept easier for humans and AI agents to retrieve and use. Respect OKF v0.1.' },
  { icon: Lightbulb, title: 'Suggest connections', prompt: 'Based on this concept, suggest likely knowledge relationships we should document. Explain why each connection would help.' },
  { icon: ShieldCheck, title: 'Privacy review', prompt: 'Perform a privacy-focused publishing review of this concept. Flag sensitive, internal-only, or audience-dependent content.' }
]

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export function AssistantPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const selectedId = useAppStore((state) => state.selectedId)
  const codexStatus = useAppStore((state) => state.codexStatus)
  const addToast = useAppStore((state) => state.addToast)
  const [documentId, setDocumentId] = useState(selectedId ?? bundle.documents.find((document) => document.kind === 'concept')?.id ?? '')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const selected = bundle.documents.find((document) => document.id === documentId)

  const run = async (prompt = input): Promise<void> => {
    if (!prompt.trim() || busy) return
    setMessages((current) => [...current, { role: 'user', content: prompt }])
    setInput('')
    setBusy(true)
    try {
      const response = await window.knot.assistant.run({ instruction: prompt, documentPath: selected?.path, documentContent: selected?.raw })
      setMessages((current) => [...current, { role: 'assistant', content: response }])
    } catch (error) {
      addToast({ title: 'Assistant could not respond', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally { setBusy(false) }
  }

  return <div className="page assistant-page">
    <section className="page-heading"><div><span className="eyebrow"><Sparkles size={14} /> Subscription-backed, read-only</span><h1>Knot Assist</h1><p>Use your existing Codex sign-in to strengthen knowledge without uploading a bundle to a separate service.</p></div><Badge className={codexStatus?.authenticated ? 'badge-success' : 'badge-warning'}><span className={`status-dot ${codexStatus?.authenticated ? 'online' : ''}`} />{codexStatus?.authenticated ? 'Codex connected' : 'Sign-in needed'}</Badge></section>
    <div className="assistant-layout">
      <aside className="assistant-context panel"><div className="assistant-orb"><Bot size={25} /></div><h2>Editorial copilot</h2><p>Runs through the local Codex app-server with a read-only sandbox and network access disabled for the turn.</p>
        <label className="field-label">Context concept<select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>{bundle.documents.filter((document) => document.kind === 'concept').map((document) => <option value={document.id} key={document.id}>{document.title}</option>)}</select></label>
        {selected && <div className="context-preview"><span>{selected.type}</span><strong>{selected.title}</strong><small>{selected.path}</small><div>{selected.tags.slice(0,4).map((tag) => <Badge key={tag}>#{tag}</Badge>)}</div></div>}
        <div className="safety-details"><span className="panel-kicker">Safety boundary</span><div><CheckCircle2 size={15} /><span>Read-only filesystem</span></div><div><CheckCircle2 size={15} /><span>No network for the turn</span></div><div><CheckCircle2 size={15} /><span>No automatic edits</span></div></div>
        {!codexStatus?.authenticated && <div className="inline-alert warning"><ShieldCheck size={17} /><span><strong>Connect once in Terminal</strong>Run <code>codex login</code>, complete ChatGPT sign-in, then reopen this page.</span></div>}
      </aside>
      <section className="assistant-chat panel">
        <div className="chat-head"><div><span className="panel-kicker">Conversation</span><h2>{selected ? `Working on ${selected.title}` : 'Choose a concept'}</h2></div>{messages.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMessages([])}>Clear</Button>}</div>
        <div className="chat-body">
          {!messages.length && <div className="assistant-welcome"><div className="assistant-spark"><Sparkles size={24} /></div><h3>What would make this knowledge stronger?</h3><p>Choose a focused review or ask your own question. Knot sends only the selected concept and your instruction.</p><div className="suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion.title} disabled={!codexStatus?.authenticated} onClick={() => void run(suggestion.prompt)}><suggestion.icon size={18} /><span><strong>{suggestion.title}</strong><small>{suggestion.prompt.split('.')[0]}.</small></span></button>)}</div></div>}
          {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.role === 'assistant' && <span className="message-avatar"><Sparkles size={15} /></span>}<div><span className="message-role">{message.role === 'assistant' ? 'Knot Assist' : 'You'}</span>{message.role === 'assistant' ? <><MarkdownView compact source={message.content} documentPath={selected?.path ?? 'index.md'} /><button className="copy-button" onClick={() => void navigator.clipboard.writeText(message.content)}><Copy size={14} /> Copy</button></> : <p>{message.content}</p>}</div></div>)}
          {busy && <div className="chat-message assistant"><span className="message-avatar"><LoaderCircle className="spin" size={15} /></span><div><span className="message-role">Knot Assist</span><div className="thinking"><i /><i /><i /> Reviewing this concept…</div></div></div>}
        </div>
        <div className="composer"><textarea aria-label="Assistant instruction" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void run() } }} placeholder={codexStatus?.authenticated ? 'Ask about structure, clarity, connections, or publishing risk…' : 'Connect Codex to enable assistance'} disabled={!codexStatus?.authenticated || busy} rows={2} /><button aria-label="Send to Knot Assist" disabled={!input.trim() || busy || !codexStatus?.authenticated} onClick={() => void run()}><ArrowUp size={18} /></button><small>Enter to send · Shift+Enter for a new line</small></div>
      </section>
    </div>
  </div>
}
