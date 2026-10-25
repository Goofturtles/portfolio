// Things are things. Reference: film/SPEC.md, "What only 3D can do", item 3 (hover lifts and lights the real object;
// the ball can be pushed and rolls on the desk; the chair swivels when dragged and turns back; the ring turns; the
// flowers lean and sway after the pointer; the laptop's lid answers), and the film's own desk events for how they
// move (film/research/P2.md: the vase is jolted and "the flower heads follow, but not rigidly: let the stems sway";
// the chair is shoved and comes to rest). Which node is what, where it stands, how big it is and the edge of the
// table all come from room3d.json (contract.js); what the ball bumps into is the real outline of each thing on the
// desk, read off its meshes. Followers are critically damped; only the stems may swing past.
import * as THREE from 'three'
import { Damp, Sway, ms } from './motion.js'
import { makeTree, hitTree } from './pick.js'

const TAU = Math.PI * 2, rad = THREE.MathUtils.degToRad
const UP = new THREE.Vector3(0, 1, 0)

export function createThings(scene, camera, contract) {
  const deskY = contract.mirror.height ?? 0
  const trees = new Map(), owner = new Map(), records = []
  const listed = contract.objects.filter((o) => /^obj_/.test(o.node || ''))
  const entries = listed.length ? listed : scene.children.filter((n) => /^obj_/.test(n.name)).map((n) => ({ node: n.name, id: n.name.replace(/^obj_/, ''), opens: n.name === contract.ball.node ? null : n.name.replace(/^obj_/, ''), does: '' }))
  for (const o of entries) {
    const node = scene.getObjectByName(o.node)
    if (!node) continue
    node.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(node), sphere = box.getBoundingSphere(new THREE.Sphere())
    const centre = o.centre ? new THREE.Vector3(...o.centre) : sphere.center.clone(), foot = o.place ? o.place[1] : box.min.y
    const rec = { id: o.id, node, opens: o.opens, does: o.does, group: { id: o.id, uHover: { value: 0 }, uFade: { value: 1 } }, hover: new Damp(0, 0.2), lift: new Damp(0, 0.18),
      rest: node.position.clone(), restQ: node.quaternion.clone(), centre, radius: o.radius ?? Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2, bound: sphere.radius,
      onDesk: Math.abs(foot - deskY) < 0.06, forced: 0, sweepAt: -1, meshes: [] }
    rec.liftBy = rec.onDesk ? 0.0018 + 0.004 * Math.min(0.25, rec.radius) : 0      // pointed at, it rises a hair (2 to 3 mm): it answers, it does not jump
    node.traverse((m) => {
      if (!m.isMesh) return
      if (!trees.has(m.geometry)) trees.set(m.geometry, makeTree(m.geometry))
      rec.meshes.push({ mesh: m, tree: trees.get(m.geometry) })
      owner.set(m, rec)
    })
    records.push(rec)
  }
  const by = (id) => records.find((r) => r.id === id || r.opens === id)
  const named = (name) => (name ? scene.getObjectByName(name) : null)
  const pivotAxis = (name, fallback) => { const p = contract.pivots[name]; return p && p.axis ? new THREE.Vector3(...p.axis).normalize() : fallback }

  // ---- the parts that answer ---------------------------------------------------------------------------
  const laptop = by('projects'), ring = by('ai'), flowers = by('results'), chair = by('about'), ball = records.find((r) => r.node.name === contract.ball.node)
  const lid = laptop && { node: named((contract.objects.find((o) => o.node === laptop.node.name) || {}).pivot) || laptop.node.getObjectByName('pivot_lid'), angle: new Damp(0, 0.25) }
  if (lid && lid.node) lid.rest = lid.node.quaternion.clone()
  const seat = chair && { node: named((contract.objects.find((o) => o.node === chair.node.name) || {}).pivot) || chair.node.getObjectByName('pivot_chair') || chair.node, angle: new Damp(0, 0.5), held: false }
  if (seat) { seat.rest = seat.node.quaternion.clone(); seat.axis = pivotAxis(seat.node.name, UP) }
  const spin = ring && { angle: new Damp(0, 0.55) }
  const stems = []
  if (flowers) {
    const listed = (contract.objects.find((o) => o.node === flowers.node.name) || {}).stems
    const nodes = listed ? listed.map(named).filter(Boolean) : []
    if (!nodes.length) flowers.node.traverse((n) => { if (/^stem/i.test(n.name) && !n.isMesh && n !== flowers.node) nodes.push(n) })
    nodes.forEach((node, i) => stems.push({ node, rest: node.quaternion.clone(), side: new Sway(5.6 + i * 1.5, 0.17 + i * 0.04), depth: new Sway(4.9 + i * 1.2, 0.2), gain: 1 - i * 0.22 }))
  }
  if (ball) ball.liftBy = 0

  // ---- the ball on the table ---------------------------------------------------------------------------
  // What the ball cannot roll through: the shadow on the desk plane of everything that stands on the desk and reaches into
  // the ball's height. It is read off the meshes themselves, once at load: their vertices from the desk up to the top of the
  // ball, carried through the world matrix (a turned laptop is a turned rectangle, the glass a round one, the lamp's flared
  // shade is only as wide as it is down where the ball is), wrapped in a convex outline, one for each mesh. What lies on the
  // desk (the paper, the card, the pencil) is rolled over, and so is anything a few millimetres high.
  const LIES = /^(set_paper|obj_how)$/, FLAT = 0.009
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  function chain(P) {                                            // Andrew's monotone chain: the convex outline of points [x, z], anticlockwise in (x, z), the inside on the left of each edge
    P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const lo = [], hi = []
    for (const p of P) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
    for (const p of P.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p) }
    return lo.slice(0, -1).concat(hi.slice(0, -1))
  }
  function hull(pts, bins = 90) {                                // pts: x, z, x, z, ...; tens of thousands of vertices are too many to sort, so first the farthest in each direction round the middle make a rough outline...
    const n = pts.length / 2
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, pts[2 * i]); x1 = Math.max(x1, pts[2 * i]); z0 = Math.min(z0, pts[2 * i + 1]); z1 = Math.max(z1, pts[2 * i + 1]) }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, far = new Int32Array(bins).fill(-1), reach = new Float64Array(bins)
    for (let i = 0; i < n; i++) {
      const dx = pts[2 * i] - cx, dz = pts[2 * i + 1] - cz, d = dx * dx + dz * dz, k = Math.min(bins - 1, Math.floor((Math.atan2(dz, dx) + Math.PI) / TAU * bins))
      if (d > reach[k]) { reach[k] = d; far[k] = i }
    }
    const rough = chain(Array.from(far).filter((i) => i >= 0).map((i) => [pts[2 * i], pts[2 * i + 1]])), m = rough.length, E = new Float64Array(m * 5), extra = []
    rough.forEach((a, k) => { const b = rough[(k + 1) % m]; E.set([a[0], a[1], b[0] - a[0], b[1] - a[1], Math.hypot(b[0] - a[0], b[1] - a[1])], k * 5) })
    for (let i = 0; i < n; i++) {                                // ...then whatever still sticks out of it by more than a tenth of a millimetre goes back in
      const x = pts[2 * i], z = pts[2 * i + 1]
      for (let k = 0; k < m * 5; k += 5) if ((E[k + 2] * (z - E[k + 1]) - E[k + 3] * (x - E[k])) / E[k + 4] < -1e-4) { extra.push([x, z]); break }
    }
    return chain(rough.concat(extra))
  }
  const within = (poly, p) => poly.every((a, i) => { const b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1]; return ((p[0] - a[0]) * ez - (p[1] - a[1]) * ex) / Math.hypot(ex, ez) < 0.0002 })
  function footprints(r) {
    const found = [], top = deskY + 2 * r, box = new THREE.Box3(), mb = new THREE.Box3()
    for (const o of contract.objects) {
      const node = o.node && o.node !== contract.ball.node && !LIES.test(o.node) ? scene.getObjectByName(o.node) : null
      if (!node) continue
      node.updateWorldMatrix(true, true)
      box.setFromObject(node)
      if (box.min.y < deskY - 0.03 || box.min.y > deskY + 0.03 || box.max.y < deskY + FLAT) continue      // only what stands on the desk
      node.traverse((m) => {
        if (!m.isMesh || !m.geometry.attributes.position) return
        mb.setFromObject(m)
        if (mb.min.y > top || mb.max.y < deskY + FLAT) return    // a flower head above the ball, a sheet beneath it
        const pos = m.geometry.attributes.position, ix = m.geometry.index, e = m.matrixWorld.elements, W = new Float32Array(pos.count * 3), pts = []
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
          W[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; W[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; W[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
          if (W[i * 3 + 1] <= top) pts.push(W[i * 3], W[i * 3 + 2])
        }
        for (let t = 0, n = ix ? ix.count : pos.count; t < n; t++) {      // and where an edge climbs through the top of the ball's height: a tilted lid is wider there than at its foot
          const t2 = t - (t % 3) + ((t + 1) % 3), a = (ix ? ix.getX(t) : t) * 3, b = (ix ? ix.getX(t2) : t2) * 3
          if ((W[a + 1] <= top) === (W[b + 1] <= top)) continue
          const u = (top - W[a + 1]) / (W[b + 1] - W[a + 1])
          pts.push(W[a] + (W[b] - W[a]) * u, W[a + 2] + (W[b + 2] - W[a + 2]) * u)
        }
        const poly = pts.length >= 6 ? hull(pts) : []
        const area = poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + (a[0] * b[1] - b[0] * a[1]) / 2 }, 0)
        if (poly.length < 3 || area < 5e-5) return                // a sliver under half a square centimetre is not a thing
        const x = poly.reduce((t, p) => t + p[0], 0) / poly.length, z = poly.reduce((t, p) => t + p[1], 0) / poly.length      // and a circle round it, so the ball only looks closely at what it is near
        found.push({ poly, area, node, x, z, reach: Math.max(...poly.map((p) => Math.hypot(p[0] - x, p[1] - z))) })
      })
    }
    // the keys, the liquid in the glass, the base under the lamp's shade are inside a bigger outline: only that one is kept
    found.sort((a, b) => b.area - a.area)
    return found.filter((f, i) => !found.slice(0, i).some((g) => f.poly.every((p) => within(g.poly, p))))
  }
  const roll = ball && (() => {
    const r = contract.ball.radius || ball.bound, p = ball.node.getWorldPosition(new THREE.Vector3())
    const outline = (contract.desk.outline || []).map((e) => [e[0], e[1]]), wall = contract.desk.wall
    return { r, x: p.x, z: p.z, vx: 0, vz: 0, free: true, outline, wall, feet: footprints(r), at: new THREE.Vector2(NaN, NaN), q: new THREE.Quaternion() }
  })()
  const axis = new THREE.Vector3(), hitPoint = new THREE.Vector3(), plane = new THREE.Plane(), dirV = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion()
  const contact = { nx: 0, nz: 0, depth: 0 }
  // the ball's circle against one outline: true when they overlap, with the way out in `contact` (a unit normal from the thing to the ball, and how far)
  function overlaps(poly, r) {
    const x = roll.x, z = roll.z, n = poly.length
    let inside = true, near = Infinity, qx = 0, qz = 0, top = -Infinity, tx = 0, tz = 0
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], len2 = ex * ex + ez * ez, len = Math.sqrt(len2)
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / len2)), px = a[0] + ex * t - x, pz = a[1] + ez * t - z, d2 = px * px + pz * pz
      if (d2 < near) { near = d2; qx = px; qz = pz }
      const side = ((x - a[0]) * ez - (z - a[1]) * ex) / len        // how far outside this edge's line (its outward normal is (ez, -ex))
      if (side > 0) inside = false
      if (side > top) { top = side; tx = ez / len; tz = -ex / len }
    }
    if (inside) { contact.nx = tx; contact.nz = tz; contact.depth = r - top; return true }      // the middle of the ball is in it: out by the nearest face
    const d = Math.sqrt(near)
    if (d >= r) return false
    contact.nx = -qx / d; contact.nz = -qz / d; contact.depth = r - d
    return true
  }
  function bounce(nx, nz, depth) {                               // push out along (nx, nz) and lose half the speed into the edge
    roll.x += nx * depth; roll.z += nz * depth
    const vn = roll.vx * nx + roll.vz * nz
    if (vn < 0) { roll.vx -= 1.5 * vn * nx; roll.vz -= 1.5 * vn * nz }
  }
  // a solid thing: out by the overlap, off it at a third of the speed it came in with, and slowed a little along it.
  // A ball only leaned against something (the finger holds it there) does not bounce, it rests. Returns how hard it hit.
  function knock(nx, nz, depth) {
    roll.x += nx * (depth + 1e-4); roll.z += nz * (depth + 1e-4)      // and a tenth of a millimetre over, so it ends clear and not just touching
    const vn = roll.vx * nx + roll.vz * nz
    if (vn >= 0) return 0
    const e = vn < -0.15 ? 0.35 : 0, tx = -nz, tz = nx, vt = roll.vx * tx + roll.vz * tz, slow = Math.sign(vt) * Math.min(Math.abs(vt), 0.2 * (1 + e) * -vn)
    roll.vx -= (1 + e) * vn * nx + slow * tx; roll.vz -= (1 + e) * vn * nz + slow * tz
    return -vn
  }
  function stepBall(dt, ptr) {
    // the pointer is a finger on the desk: where its ray meets the ball's height, it pushes
    if (ptr.inside && ptr.pushes) {
      plane.set(UP, -ball.rest.y)
      dirV.set(ptr.x, ptr.y, 0.5).unproject(camera).sub(camera.position).normalize()
      const t = -(camera.position.y - ball.rest.y) / dirV.y
      if (t > 0 && Number.isFinite(t)) {
        hitPoint.copy(camera.position).addScaledVector(dirV, t)
        const wx = Number.isNaN(roll.at.x) ? 0 : (hitPoint.x - roll.at.x) / dt, wz = Number.isNaN(roll.at.x) ? 0 : (hitPoint.z - roll.at.y) / dt
        roll.at.set(hitPoint.x, hitPoint.z)
        const dx = roll.x - hitPoint.x, dz = roll.z - hitPoint.z, d = Math.hypot(dx, dz), reach = roll.r * 1.5
        if (d < reach && d > 1e-5) {
          const nx = dx / d, nz = dz / d, push = Math.min(1.1, Math.max(0, (wx * nx + wz * nz) * 0.85)) + 0.1 - (roll.vx * nx + roll.vz * nz)
          if (push > 0) { roll.vx += nx * push; roll.vz += nz * push }
        }
      } else roll.at.set(NaN, NaN)
    } else roll.at.set(NaN, NaN)
    let speed = Math.hypot(roll.vx, roll.vz)
    if (speed < 1e-4) return
    if (speed > 1.4) { roll.vx *= 1.4 / speed; roll.vz *= 1.4 / speed; speed = 1.4 }
    const drag = Math.max(0, speed - (0.22 + 0.5 * speed) * dt) / speed      // rolling resistance: it coasts, then stops
    roll.vx *= drag; roll.vz *= drag
    // a fast ball is moved in slices of at most half its width, so it cannot step over a thin thing between two looks
    const slices = Math.min(8, Math.ceil(speed * dt / (roll.r * 0.5))), h = dt / slices
    for (let s = 0; s < slices; s++) {
      const sx = roll.vx * h, sz = roll.vz * h, px = roll.x, pz = roll.z
      roll.x += sx; roll.z += sz
      const o = roll.outline, n = o.length
      for (let i = 0; i < n; i++) {                               // the rim of the table (anticlockwise seen from above: inside is on the left)
        const a = o[i], b = o[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez)
        if (len < 1e-6) continue
        const t = ((roll.x - a[0]) * ex + (roll.z - a[1]) * ez) / (len * len)
        if (t < 0 || t > 1) continue
        let nx = -ez / len, nz = ex / len
        if (roll.winding < 0) { nx = -nx; nz = -nz }
        const dist = (roll.x - a[0]) * nx + (roll.z - a[1]) * nz
        if (dist < roll.r && dist > -roll.r * 2) bounce(nx, nz, roll.r - dist)
        const cx = roll.x - a[0], cz = roll.z - a[1], cd = Math.hypot(cx, cz)
        if (cd < roll.r * 0.6 && cd > 1e-6) bounce(cx / cd * (dist < 0 ? -1 : 1), cz / cd * (dist < 0 ? -1 : 1), roll.r * 0.6 - cd)      // a corner of the rim
      }
      if (roll.wall) { const dx = roll.x - roll.wall.centre[0], dz = roll.z - roll.wall.centre[1], d = Math.hypot(dx, dz); if (d < roll.wall.radius + roll.r) bounce(dx / d, dz / d, roll.wall.radius + roll.r - d) }
      let jammed = true
      for (let pass = 0; pass < 12 && jammed; pass++) {           // the things on the table, again while it is still in one: a ball in the notch between two of them takes a few rounds to come out
        jammed = false
        for (const f of roll.feet) {
          const dx = roll.x - f.x, dz = roll.z - f.z, lim = f.reach + roll.r
          if (dx * dx + dz * dz > lim * lim || !overlaps(f.poly, roll.r)) continue
          const deep = contact.depth > 2e-4, hard = knock(contact.nx, contact.nz, contact.depth)
          jammed ||= deep
          if (spin && f.node === ring.node && hard > 0.3) {       // a hard knock turns the ring a hair, about its own axis, and it settles back
            const lever = (roll.x - contact.nx * roll.r - ring.centre.x) * contact.nz - (roll.z - contact.nz * roll.r - ring.centre.z) * contact.nx
            spin.angle.v += THREE.MathUtils.clamp(Math.sign(lever) * (hard - 0.3) * 2.2, -1.3, 1.3)
          }
        }
      }
      if (jammed && roll.free) { roll.x = px; roll.z = pz; roll.vx = 0; roll.vz = 0; continue }      // a gap too narrow for it, between two things: it stays where it was, it does not squeeze in
      roll.free = !jammed
      const dist = Math.hypot(sx, sz)
      if (dist > 1e-7) { axis.set(sz, 0, -sx).normalize(); q.setFromAxisAngle(axis, dist / roll.r); roll.q.premultiply(q) }
    }
    tmp.set(roll.x, ball.rest.y, roll.z)
    ball.node.parent.worldToLocal(tmp)
    ball.node.position.copy(tmp)
    ball.node.quaternion.copy(roll.q).multiply(ball.restQ)
    ball.centre.set(roll.x, ball.rest.y, roll.z)
  }
  if (roll) {
    // which way round the rim runs, so "inside" is known whatever the export's order (the ball starts inside)
    let area = 0
    for (let i = 0, o = roll.outline; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; area += a[0] * b[1] - b[0] * a[1] }
    roll.winding = area > 0 ? 1 : -1                              // in (x, z) a positive area has its inside on the left of each edge
    ball.rest.copy(ball.node.getWorldPosition(new THREE.Vector3()))
  }

  // ---- picking -----------------------------------------------------------------------------------------
  const origin = new THREE.Vector3(), dir = new THREE.Vector3(), inv = new THREE.Matrix4(), lo = new THREE.Vector3()
  function pick(x, y) {
    origin.copy(camera.position)
    dir.set(x, y, 0.5).unproject(camera).sub(origin).normalize()
    let best = Infinity, hit = null
    for (const rec of records) {
      tmp.copy(rec.centre).sub(origin)
      const along = tmp.dot(dir), off2 = tmp.lengthSq() - along * along, reach = rec.bound * 1.3 + 0.03
      if (off2 > reach * reach) continue
      for (const m of rec.meshes) {
        inv.copy(m.mesh.matrixWorld).invert()
        const e = inv.elements
        lo.copy(origin).applyMatrix4(inv)
        const t = hitTree(m.tree, lo.x, lo.y, lo.z, e[0] * dir.x + e[4] * dir.y + e[8] * dir.z, e[1] * dir.x + e[5] * dir.y + e[9] * dir.z, e[2] * dir.x + e[6] * dir.y + e[10] * dir.z, best)
        if (t < best) { best = t; hit = rec }
      }
    }
    return hit ? { rec: hit, point: origin.clone().addScaledVector(dir, best) } : null
  }

  // once an object has the pointer it keeps it anywhere inside its own round reach: a ring that turns edge-on, or a
  // flower that sways aside, does not drop the pointer while it answers it
  function holds(rec, x, y) {
    origin.copy(camera.position)
    dir.set(x, y, 0.5).unproject(camera).sub(origin).normalize()
    tmp.copy(rec.centre).sub(origin)
    const along = tmp.dot(dir)
    return tmp.lengthSq() - along * along < (rec.bound * 0.7) ** 2
  }

  // ---- every frame -------------------------------------------------------------------------------------
  let hot = null, clock = 0
  const turn = (node, rest, axisWorld, angle) => {                // about a world axis through the node's own origin
    node.parent.getWorldQuaternion(q2).invert()
    axis.copy(axisWorld).applyQuaternion(q2)
    node.quaternion.setFromAxisAngle(axis, angle).multiply(rest)
  }
  function update(dt, ptr, flying) {
    clock += dt
    const tin = ms('--m-hover-in', 200) / 1000, tout = ms('--m-hover-out', 300) / 1000
    for (const rec of records) {
      const on = rec === hot || rec.forced > 0 || (rec.sweepAt >= 0 && clock >= rec.sweepAt && clock < rec.sweepAt + 0.56)
      rec.hover.time = on ? tin : tout; rec.hover.to = on ? 1 : 0
      rec.group.uHover.value = rec.hover.step(dt)
      if (rec.liftBy) { rec.lift.to = on ? 1 : 0; rec.node.position.y = rec.rest.y + rec.lift.step(dt) * rec.liftBy }
      // what the camera is about to fly through thins out of its way
      const d = flying ? camera.position.distanceTo(rec.centre) : 1e9
      rec.group.uFade.value = rec === flying || !flying ? 1 : THREE.MathUtils.smoothstep(d, rec.bound + 0.12, rec.bound + 0.5)
    }
    if (lid && lid.node) {                                        // the lid tips back a little to meet the eye
      lid.angle.to = hot === laptop || laptop.forced > 0 ? rad(-1.5) : 0
      lid.node.quaternion.copy(lid.rest).multiply(q.setFromAxisAngle(axis.set(1, 0, 0), lid.angle.step(dt)))
    }
    if (seat) {                                                   // dragged, it swivels; let go, it turns back
      if (!seat.held) { seat.angle.time = ms('--m-settle-ms', 900) / 1000 * 0.7; seat.angle.to = hot === chair ? rad(3) : 0 }
      turn(seat.node, seat.rest, seat.axis, seat.angle.step(dt))
    }
    if (spin) {                                                   // the ring turns slowly while it is pointed at
      if (hot === ring || ring.forced > 0) spin.angle.to += 0.9 * dt
      else spin.angle.to = Math.round(spin.angle.to / TAU) * TAU      // let go, it settles back to the nearest rest, never whips round
      turn(ring.node, ring.restQ, UP, spin.angle.step(dt))
    }
    if (stems.length) {
      // the pointer's movement near the flowers is a breath of air: they lean after it and sway back
      tmp.copy(flowers.centre).project(camera)
      const near = ptr.inside ? Math.max(0, 1 - Math.hypot((ptr.x - tmp.x) * camera.aspect, ptr.y - tmp.y) / 0.42) : 0
      camera.getWorldDirection(dirV); dirV.y = 0; dirV.normalize()
      axis.crossVectors(dirV, UP)                                 // the camera's right, on the desk
      for (const s of stems) {
        s.side.v += THREE.MathUtils.clamp(ptr.vx, -6, 6) * near * near * 7 * s.gain * dt      // a hand's pass leans them four or five degrees; a swipe, up to the stop below
        s.depth.v += THREE.MathUtils.clamp(ptr.vy, -6, 6) * near * near * 2.6 * s.gain * dt
        const a = THREE.MathUtils.clamp(s.side.step(dt), -0.3, 0.3) + 0.006 * Math.sin(clock * 0.9 + s.gain * 5), b = THREE.MathUtils.clamp(s.depth.step(dt), -0.18, 0.18)
        s.node.parent.getWorldQuaternion(q2).invert()
        q.setFromAxisAngle(tmp.copy(dirV).applyQuaternion(q2), a)
        s.node.quaternion.setFromAxisAngle(tmp.copy(axis).applyQuaternion(q2), -b).multiply(q).multiply(s.rest)
      }
    }
    if (roll) stepBall(dt, ptr)
  }

  return {
    records, by, pick, holds, update, groupOf: (mesh) => { const r = owner.get(mesh); return r ? r.group : undefined },
    get hot() { return hot },
    setHot(rec) { hot = rec || null },
    force(id, on) { const r = by(id); if (r) r.forced = Math.max(0, r.forced + (on ? 1 : -1)) },
    calm() { hot = null; for (const r of records) { r.forced = 0; r.sweepAt = -1 } },
    // the light runs once over the objects, left to right, so nobody misses that they are buttons
    sweep() {
      const gap = ms('--m-stagger', 120) / 1000
      records.filter((r) => r.opens).map((r) => [tmp.copy(r.centre).project(camera).x, r]).sort((a, b) => a[0] - b[0]).forEach(([, r], i) => { r.sweepAt = clock + 0.2 + i * gap })
    },
    // a click on the ball flicks it away from the eye; a click on the chair gives it a turn
    press(hit) {
      if (roll && hit.rec === ball) {
        camera.getWorldDirection(dirV); dirV.y = 0; dirV.normalize()
        const side = THREE.MathUtils.clamp(((roll.x - hit.point.x) * dirV.z - (roll.z - hit.point.z) * dirV.x) / roll.r, -1, 1)
        roll.vx += dirV.x * 0.55 + dirV.z * side * 0.25; roll.vz += dirV.z * 0.55 - dirV.x * side * 0.25
        return true
      }
      return false
    },
    isChair: (rec) => !!seat && rec === chair,
    isBall: (rec) => !!roll && rec === ball,
    grabChair() { seat.held = true; seat.angle.time = 0.16 },
    turnChair(by) { if (seat.held) seat.angle.to = THREE.MathUtils.clamp(seat.angle.to + by, -2.6, 2.6) },
    dropChair() { if (seat) seat.held = false },
    laptop,
  }
}
