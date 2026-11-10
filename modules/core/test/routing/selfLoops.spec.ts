import {
  BundlingSettings,
  CurveFactory,
  Edge,
  EdgeRoutingSettings,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  ICurve,
  Node,
  Point,
  Size,
  SplineRouter,
} from '@msagl/core'
import {SelfLoopSettings} from '../../src/layout/core/geomEdge'
import {SmoothedPolyline} from '../../src/math/geometry/smoothedPolyline'
import {RRect} from '../../src/layout/core/RRect'

type Routing = 'spline' | 'bundled'

function mkRouter(g: GeomGraph, routing: Routing): SplineRouter {
  if (routing === 'bundled') {
    const bs = new BundlingSettings()
    return SplineRouter.mk5(g, 2, 4, Math.PI / 6, bs)
  }
  return SplineRouter.mk2(g, new EdgeRoutingSettings())
}

/** node 'a' with 'loops' self-loops and one ordinary edge to node 'b' */
function route(routing: Routing, loops: number, settings: SelfLoopSettings, w = 120, h = 60, group = false) {
  const g = new GeomGraph(new Graph('graph'))
  g.labelSize = new Size(0, 0)
  let a: GeomNode
  if (group) {
    const cluster = new GeomGraph(new Graph('a'))
    cluster.rrect = new RRect({left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2, radX: 0, radY: 0})
    g.addNode(cluster)
    const child = new GeomNode(new Node('child'))
    child.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(40, 30, 5, 5, new Point(0, 0))
    cluster.addNode(child)
    a = cluster
  } else {
    a = new GeomNode(new Node('a'))
    a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(w, h, 8, 8, new Point(0, 0))
    g.addNode(a)
  }
  const b = new GeomNode(new Node('b'))
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(120, 60, 8, 8, new Point(w / 2 + 240, 0))
  g.addNode(b)
  const loopEdges: GeomEdge[] = []
  for (let i = 0; i < loops; i++) loopEdges.push(new GeomEdge(new Edge(a.node, a.node)))
  const ordinary = new GeomEdge(new Edge(a.node, b.node))
  const router = mkRouter(g, routing)
  if (settings) router.SelfLoopSettings = settings
  router.run()
  return {loops: loopEdges.map((e) => e.curve), ordinary: ordinary.curve, graph: g, loopEdges}
}

/** how far the loop reaches beyond the side of the node it leaves from */
function stickOut(c: ICurve, h: number): number {
  return -h / 2 - c.boundingBox.bottom
}

const settings: SelfLoopSettings = {size: 30, separation: 12, maxWidth: 40}

for (const routing of ['spline', 'bundled'] as Routing[]) {
  test(`self-loops without settings keep the original fixed shape, ${routing}`, () => {
    const legacy = routing === 'bundled' ? 8 : 2 // twice the loose padding
    const r = route(routing, 2, null)
    for (const c of r.loops) {
      expect(stickOut(c, 60)).toBeCloseTo(legacy, 6)
      expect(c.start.y).toBeCloseTo(-30, 6)
      expect(c.end.y).toBeCloseTo(-30, 6)
    }
    // the original loops of one node coincide
    expect(r.loops[0].boundingBox.width).toBeCloseTo(r.loops[1].boundingBox.width, 9)
    expect(r.loops[0].start.x).toBeCloseTo(r.loops[1].start.x, 9)
  })

  test(`a single self-loop takes its size and width cap from the settings, ${routing}`, () => {
    const r = route(routing, 1, settings)
    const c = r.loops[0]
    expect(stickOut(c, 60)).toBeCloseTo(30, 6)
    expect(c.boundingBox.width).toBeLessThanOrEqual(40 + 1e-6)
    expect(c.boundingBox.width).toBeGreaterThan(39)
    // clipped at the node boundary at both ends
    expect(c.start.y).toBeCloseTo(-30, 6)
    expect(c.end.y).toBeCloseTo(-30, 6)
    expect(c.end.x).toBeGreaterThan(c.start.x)
    // the ordinary edge is still routed to the other node
    expect(r.ordinary.end.x).toBeGreaterThan(r.ordinary.start.x)
  })

  test(`self-loops of one node nest in insertion order, ${routing}`, () => {
    const r = route(routing, 3, settings)
    expect(r.loops.map((c) => stickOut(c, 60))).toEqual([30, 42, 54].map((v) => expect.closeTo(v, 6)))
    expect(r.loops.map((c) => c.boundingBox.width)).toEqual([40, 64, 88].map((v) => expect.closeTo(v, 1)))
    // routing the unchanged graph again with a new router repeats the routes
    const before = r.loops.map((c) => [c.start.x, c.end.x, c.boundingBox.bottom])
    const again = mkRouter(r.graph, routing)
    again.SelfLoopSettings = settings
    again.run()
    expect(r.loopEdges.map((e) => [e.curve.start.x, e.curve.end.x, e.curve.boundingBox.bottom])).toEqual(before)
  })

  test(`a narrow node shrinks the horizontal step and keeps its loops distinct, ${routing}`, () => {
    const r = route(routing, 3, settings, 40, 30)
    expect(r.loops.map((c) => stickOut(c, 30))).toEqual([30, 42, 54].map((v) => expect.closeTo(v, 6)))
    const widths = r.loops.map((c) => c.boundingBox.width)
    // legs stay within 0.4 of the node width from the center
    for (const wd of widths) expect(wd).toBeLessThanOrEqual(0.8 * 40 + 1e-6)
    expect(widths[1]).toBeGreaterThan(widths[0])
    expect(widths[2]).toBeGreaterThan(widths[1])
  })

  test(`self-loops of a wide cluster stay capped, ${routing}`, () => {
    const r = route(routing, 2, settings, 400, 300, true)
    for (const c of r.loops) {
      expect(c).toBeDefined()
      expect(c.boundingBox.width).toBeLessThanOrEqual(40 + 2 * 12 + 1e-6)
    }
    expect(stickOut(r.loops[0], 300)).toBeCloseTo(30, 6)
    expect(stickOut(r.loops[1], 300)).toBeCloseTo(42, 6)
  })
}

test('a router does not write its self-loop settings into the bundling settings it was given', () => {
  const g = new GeomGraph(new Graph('graph'))
  g.labelSize = new Size(0, 0)
  const a = new GeomNode(new Node('a'))
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(120, 60, 8, 8, new Point(0, 0))
  g.addNode(a)
  const loop = new GeomEdge(new Edge(a.node, a.node))
  const bs = new BundlingSettings()
  const router = SplineRouter.mk5(g, 2, 4, Math.PI / 6, bs)
  router.SelfLoopSettings = settings
  router.run()
  expect(stickOut(loop.curve, 60)).toBeCloseTo(30, 6)
  expect(bs.selfLoopSettings).toBeUndefined()
})

test('RouteSelfEdge default arguments reproduce the original polyline', () => {
  const boundary = CurveFactory.mkRectangleWithRoundedCorners(120, 60, 8, 8, new Point(10, 20))
  const t: {smoothedPolyline: SmoothedPolyline} = {smoothedPolyline: null}
  GeomEdge.RouteSelfEdge(boundary, 7, t)
  const pts = Array.from(t.smoothedPolyline).map((p) => [p.x, p.y])
  expect(pts).toEqual([
    [10 - 30, 20],
    [10 - 30, 20 - 30 - 7],
    [10 + 30, 20 - 30 - 7],
    [10 + 30, 20],
  ])
})
