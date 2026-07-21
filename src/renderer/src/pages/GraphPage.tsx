import { useMemo, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { ChevronRight, FileText, Focus, GitFork, Link2, Minus, Network, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { typeTone } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { BundleDocument } from '@shared/types'

interface GraphNode extends SimulationNodeDatum {
  id: string
  document: BundleDocument
  x: number
  y: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

const WIDTH = 1100
const HEIGHT = 700

function layoutDocuments(documents: BundleDocument[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const ids = new Set(documents.map((document) => document.id))
  const nodes: GraphNode[] = documents.map((document, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5))
    const radius = 28 * Math.sqrt(index)
    return { id: document.id, document, x: WIDTH / 2 + Math.cos(angle) * radius, y: HEIGHT / 2 + Math.sin(angle) * radius }
  })
  const links: GraphLink[] = documents.flatMap((document) => document.outboundIds
    .filter((target) => ids.has(target))
    .map((target) => ({ source: document.id, target })))

  const simulation = forceSimulation(nodes)
    .alphaDecay(0.035)
    .velocityDecay(0.42)
    .force('link', forceLink<GraphNode, GraphLink>(links).id((node) => node.id).distance(138).strength(0.72))
    .force('charge', forceManyBody().strength(-560).distanceMax(500))
    .force('collide', forceCollide<GraphNode>().radius(64).strength(0.95).iterations(3))
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2).strength(0.55))
    .force('x', forceX(WIDTH / 2).strength(0.035))
    .force('y', forceY(HEIGHT / 2).strength(0.05))
    .stop()
  for (let tick = 0; tick < 260; tick += 1) simulation.tick()

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs, WIDTH / 2)
  const maxX = Math.max(...xs, WIDTH / 2)
  const minY = Math.min(...ys, HEIGHT / 2)
  const maxY = Math.max(...ys, HEIGHT / 2)
  const scale = Math.min((WIDTH - 170) / Math.max(1, maxX - minX), (HEIGHT - 150) / Math.max(1, maxY - minY), 1.35)
  for (const node of nodes) {
    node.x = WIDTH / 2 + (node.x - (minX + maxX) / 2) * scale
    node.y = HEIGHT / 2 + (node.y - (minY + maxY) / 2) * scale
  }
  return { nodes, links }
}

function linkNodes(link: GraphLink): { source: GraphNode; target: GraphNode } {
  return { source: link.source as GraphNode, target: link.target as GraphNode }
}

export function GraphPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const selectDocument = useAppStore((state) => state.selectDocument)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [connectedOnly, setConnectedOnly] = useState(false)
  const concepts = bundle.documents.filter((document) => document.kind === 'concept')
  const types = ['All', ...new Set(concepts.map((document) => document.type))]
  const visibleDocuments = useMemo(() => concepts
    .filter((document) => typeFilter === 'All' || document.type === typeFilter)
    .filter((document) => !connectedOnly || document.outboundIds.length > 0 || concepts.some((candidate) => candidate.outboundIds.includes(document.id)))
    .filter((document) => `${document.title} ${document.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 32), [concepts, typeFilter, connectedOnly, query])
  const graph = useMemo(() => layoutDocuments(visibleDocuments), [visibleDocuments])
  const selected = bundle.documents.find((document) => document.id === selectedId)
  const inbound = selected ? bundle.documents.filter((document) => document.outboundIds.includes(selected.id)) : []

  return <div className="page graph-page">
    <section className="page-heading"><div><span className="eyebrow"><GitFork size={14} /> Relationship explorer</span><h1>Knowledge graph</h1><p>Follow the paths people and agents can take through this bundle.</p></div><div className="page-heading-actions"><div className="graph-search"><Search size={16} /><input aria-label="Find a node" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a node…" /></div><Button aria-pressed={connectedOnly} onClick={() => setConnectedOnly((value) => !value)}><Network size={16} /> {connectedOnly ? 'Connected only' : 'All concepts'}</Button></div></section>
    <div className="graph-workspace">
      <div className="graph-toolbar"><div className="filter-tabs" aria-label="Filter graph by type">{types.map((type) => <button key={type} aria-pressed={typeFilter === type} className={typeFilter === type ? 'active' : ''} onClick={() => { setTypeFilter(type); setZoom(1) }}>{type}</button>)}</div><div className="zoom-control"><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.65, value - .1))}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.5, value + .1))}><Plus size={15} /></button><button aria-label="Reset zoom" title="Fit graph to view" onClick={() => setZoom(1)}><Focus size={15} /></button></div></div>
      <div className="graph-canvas" data-testid="graph-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label={`Knowledge graph with ${graph.nodes.length} concepts and ${graph.links.length} links`}>
          <defs>
            <filter id="node-shadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity=".12" /></filter>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
          </defs>
          <g className="graph-viewport" transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
            <g className="graph-edges">{graph.links.map((link, index) => { const { source, target } = linkNodes(link); const related = selectedId && (source.id === selectedId || target.id === selectedId); const midX = (source.x + target.x) / 2; const midY = (source.y + target.y) / 2 - Math.min(22, Math.abs(target.x - source.x) * .06); return <path key={`${source.id}-${target.id}-${index}`} d={`M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`} className={related ? 'is-related' : ''} markerEnd="url(#edge-arrow)" /> })}</g>
            <g>{graph.nodes.map(({ document, x, y }) => {
              const related = selectedId === document.id || (selected?.outboundIds.includes(document.id) ?? false) || inbound.some((item) => item.id === document.id)
              const muted = Boolean(selectedId) && !related
              return <g key={document.id} role="button" tabIndex={0} aria-label={`Inspect ${document.title}`} data-node-id={document.id} className={`graph-node-svg tone-${typeTone(document.type)} ${selectedId === document.id ? 'is-selected' : ''} ${muted ? 'is-muted' : ''}`} transform={`translate(${x} ${y})`} onClick={() => setSelectedId(document.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(document.id) } }}>
                <circle r={selectedId === document.id ? 29 : 23} filter="url(#node-shadow)" /><circle className="node-inner" r={selectedId === document.id ? 21 : 16} /><text className="node-label" y="42">{document.title.length > 24 ? `${document.title.slice(0, 22)}…` : document.title}</text><text className="node-type" y="58">{document.type}</text><title>{document.title} · {document.type}</title>
              </g>
            })}</g>
          </g>
        </svg>
        {!graph.nodes.length && <div className="graph-empty">No concepts match this view. Clear search or filters to restore the network.</div>}
        <div className="graph-key"><span><i /> Concept</span><span><i className="line" /> Directed Markdown link</span><span>{graph.nodes.length} concepts · {graph.links.length} links</span></div>
      </div>
      <aside className="graph-inspector">
        {selected ? <><div className="inspector-head"><span className={`doc-glyph large tone-${typeTone(selected.type)}`}><FileText size={21} /></span><div><Badge className={`type-badge tone-${typeTone(selected.type)}`}>{selected.type}</Badge><h2>{selected.title}</h2></div></div><p>{selected.description || 'No description yet.'}</p>
          <div className="inspector-stats"><div><strong>{selected.outboundIds.length}</strong><span>Outgoing</span></div><div><strong>{inbound.length}</strong><span>Incoming</span></div><div><strong>{selected.tags.length}</strong><span>Tags</span></div></div>
          <div className="inspector-section"><span className="panel-kicker"><Link2 size={13} /> Connected concepts</span>{[...selected.outboundIds.map((id) => bundle.documents.find((document) => document.id === id)).filter(Boolean), ...inbound].filter((value, index, all) => all.findIndex((item) => item?.id === value?.id) === index).slice(0, 7).map((document) => document && <button key={document.id} onClick={() => setSelectedId(document.id)}><span className={`visibility-dot tone-${typeTone(document.type)}`} /><span>{document.title}<small>{document.type}</small></span><ChevronRight size={15} /></button>)}</div>
          <div className="tag-row">{selected.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}</div>
          <Button variant="primary" onClick={() => selectDocument(selected.id)}>Open concept <ChevronRight size={16} /></Button>
        </> : <div className="inspector-empty"><GitFork size={24} /><p>Select a node to inspect its relationships.</p></div>}
      </aside>
    </div>
  </div>
}
