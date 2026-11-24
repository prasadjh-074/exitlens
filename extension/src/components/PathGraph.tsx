import React, { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge as FlowEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { RecordItem } from '../types'
export const nodeTitle = (key: string) => {
  if (key.includes(' → ')) return key.split(' → ').at(-1)!
  try {
    const last = new URL(key).pathname.split('/').filter(Boolean).at(-1)
    return last ? decodeURIComponent(last).replace(/[-_]/g, ' ') : 'Home'
  } catch {
    return key
  }
}
export function PathGraph({ record: r }: { record: RecordItem }) {
  const [selected, setSelected] = useState('')
  const { nodes, edges } = useMemo(() => {
    const ids = [
      ...new Set([
        r.page,
        ...r.edges.flatMap((e) => [e.from, e.to]),
        r.current,
      ]),
    ]
    // Place branches at equal depth on their own row. Disconnected observed pages start a new component.
    const levels = new Map<string, number>()
    let offset = 0
    for (const root of ids) {
      if (levels.has(root)) continue
      const q = [root]
      levels.set(root, offset)
      for (let i = 0; i < q.length; i++) {
        const id = q[i]
        for (const e of r.edges.filter((e) => e.from === id))
          if (!levels.has(e.to)) {
            levels.set(e.to, levels.get(id)! + 1)
            q.push(e.to)
          }
      }
      offset = Math.max(...levels.values()) + 1
    }
    const used = new Map<number, number>()
    const nodes: Node[] = ids.map((id) => {
      const col = levels.get(id)!,
        row = used.get(col) ?? 0
      used.set(col, row + 1)
      return {
        id,
        position: { x: col * 189, y: row * 82 },
        data: { label: nodeTitle(id) },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: id === r.current ? '#453265' : '#211f29',
          color: '#f2ecff',
          border: '1px solid ' + (id === r.current ? '#b69ae9' : '#666170'),
          borderRadius: 8,
          padding: '10px 8px',
          width: 147,
          textTransform: 'capitalize',
          fontSize: 14,
        },
      }
    })
    const edges: FlowEdge[] = r.edges.map((e, i) => ({
      id: String(i),
      source: e.from,
      target: e.to,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.proof === 'Observed' ? '#97d6bd' : '#b298df',
      },
      style: {
        stroke: e.proof === 'Observed' ? '#97d6bd' : '#b298df',
        strokeWidth: 2,
        strokeDasharray: e.proof === 'Observed' ? undefined : '5 4',
      },
      ariaLabel: e.label + ' ' + e.proof,
    }))
    return { nodes, edges }
  }, [r])
  const selectedEdge = r.edges[Number(selected)]
  return (
    <>
      <div className="graph">
        <ReactFlow
          key={r.id + '-' + nodes.length}
          nodes={nodes}
          edges={edges}
          nodesConnectable={false}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
          minZoom={0.12}
          colorMode="dark"
          onEdgeClick={(_, e) => setSelected(e.id)}
        >
          <Background color="#595060" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="legend">
        <span>
          <i />
          Observed transition
        </span>
        <span>
          <i />
          Discovered control
        </span>
      </div>
      {r.edges.length > 0 && (
        <label className="field">
          Inspect an edge
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a connection</option>
            {r.edges.map((e, i) => (
              <option key={i} value={i}>
                {nodeTitle(e.from)} · {e.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected !== '' && selectedEdge && (
        <p className="note">
          {selectedEdge.evidence} {selectedEdge.kind} · friction{' '}
          {selectedEdge.cost} · confidence{' '}
          {Math.round(selectedEdge.confidence * 100)}%.{' '}
          {selectedEdge.confirm ? 'User confirmation required.' : ''}{' '}
          {selectedEdge.obstacles.join(' ')}
        </p>
      )}
    </>
  )
}
