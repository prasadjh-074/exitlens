import type { Candidate, Edge, Snapshot } from '../types'
export const endpoint = (page: string, c: Candidate) =>
  c.url ?? page + ' → ' + c.label
export function discover(s: Snapshot, category: Candidate['category']): Edge[] {
  return s.candidates
    .filter((c) => c.category === category && endpoint(s.page, c) !== s.page)
    .map((c) => ({
      from: s.page,
      to: endpoint(s.page, c),
      label: c.label,
      kind: c.kind,
      proof: 'Discovered',
      evidence: c.url
        ? 'Visible same-origin link'
        : 'Visible control; destination unverified',
      cost: 1 + (c.confirm ? 2 : 0) + s.barriers.length,
      confidence: c.url ? 0.85 : 0.6,
      obstacles: s.barriers,
      confirm: c.confirm,
    }))
}
export function mergeEdges(old: Edge[], incoming: Edge[]) {
  const all = new Map(
    old.map((e) => [JSON.stringify([e.from, e.to, e.label]), e]),
  )
  for (const e of incoming) {
    const key = JSON.stringify([e.from, e.to, e.label])
    if (all.get(key)?.proof !== 'Observed') all.set(key, e)
  }
  return [...all.values()].slice(-100)
}
export function shortestPath(
  edges: Edge[],
  start: string,
  targets: Set<string>,
): Edge[] {
  const frontier = [{ node: start, cost: 0, path: [] as Edge[] }],
    seen = new Set<string>()
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost)
    const next = frontier.shift()!
    if (seen.has(next.node)) continue
    if (targets.has(next.node)) return next.path
    seen.add(next.node)
    for (const edge of edges.filter(
      (e) => e.from === next.node && !seen.has(e.to),
    ))
      frontier.push({
        node: edge.to,
        cost: next.cost + edge.cost,
        path: [...next.path, edge],
      })
  }
  return []
}
export function nextStep(edges: Edge[], page: string) {
  const tier = (label: string) =>
    /Confirm cancellation|Withdraw consent|Reject cookies/.test(label)
      ? 4
      : /Cancel subscription|Continue|verification/.test(label)
        ? 3
        : /Manage subscription|Privacy settings/.test(label)
          ? 2
          : 1
  for (const rank of [4, 3, 2, 1]) {
    const route = shortestPath(
      edges,
      page,
      new Set(
        edges
          .filter((e) => tier(e.label) === rank && e.to !== page)
          .map((e) => e.to),
      ),
    )
    if (route.length) return route[0]
  }
  return null
}
