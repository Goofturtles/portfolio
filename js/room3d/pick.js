// Exact picking: which real triangle is under the pointer. Reference: film/SPEC.md, "The room has no bubbles: the
// objects are the buttons" (the hit area is the object's real outline, not a box), now from the geometry itself.
// Each mesh of an object gets a small box tree over its triangles once, at load; a pick is then a few dozen box
// tests and a handful of triangle tests per mesh, cheap enough to run on every frame the pointer is over the room.

export function makeTree(geometry) {
  const p = geometry.attributes.position, ix = geometry.index, n = Math.floor((ix ? ix.count : p.count) / 3)
  const T = new Float32Array(n * 9), C = new Float32Array(n * 3), order = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    order[i] = i
    for (let k = 0; k < 3; k++) {
      const v = ix ? ix.getX(i * 3 + k) : i * 3 + k, x = p.getX(v), y = p.getY(v), z = p.getZ(v)
      T[i * 9 + k * 3] = x; T[i * 9 + k * 3 + 1] = y; T[i * 9 + k * 3 + 2] = z
      C[i * 3] += x / 3; C[i * 3 + 1] += y / 3; C[i * 3 + 2] += z / 3
    }
  }
  const B = [], L = [], R = [], S = [], N = []
  const build = (start, count) => {
    const id = S.length, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], clo = [1e9, 1e9, 1e9], chi = [-1e9, -1e9, -1e9]
    for (let i = start; i < start + count; i++) {
      const t = order[i]
      for (let k = 0; k < 9; k++) { const a = k % 3, v = T[t * 9 + k]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v }
      for (let a = 0; a < 3; a++) { const c = C[t * 3 + a]; if (c < clo[a]) clo[a] = c; if (c > chi[a]) chi[a] = c }
    }
    B.push(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]); S.push(start); N.push(count); L.push(-1); R.push(-1)
    if (count > 6) {
      const ext = [chi[0] - clo[0], chi[1] - clo[1], chi[2] - clo[2]], axis = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : ext[1] > ext[2] ? 1 : 2
      const mid = (clo[axis] + chi[axis]) / 2
      let m = start
      for (let i = start; i < start + count; i++) if (C[order[i] * 3 + axis] < mid) { const t = order[i]; order[i] = order[m]; order[m] = t; m++ }
      if (m === start || m === start + count) m = start + (count >> 1)
      N[id] = 0
      L[id] = build(start, m - start); R[id] = build(m, start + count - m)
    }
    return id
  }
  if (n) build(0, n)
  return { T, order, B: Float32Array.from(B), L: Int32Array.from(L), R: Int32Array.from(R), S: Int32Array.from(S), N: Int32Array.from(N), n }
}

const stack = new Int32Array(64)
// the nearest hit along origin + t * dir (in the mesh's own space), or `best` if there is none nearer
export function hitTree(tree, ox, oy, oz, dx, dy, dz, best) {
  if (!tree.n) return best
  const { T, order, B, L, R, S, N } = tree, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz
  let top = 0
  stack[top++] = 0
  while (top) {
    const id = stack[--top], o = id * 6
    let a = (B[o] - ox) * ix, b = (B[o + 3] - ox) * ix, near = Math.min(a, b), far = Math.max(a, b)
    a = (B[o + 1] - oy) * iy; b = (B[o + 4] - oy) * iy; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b))
    a = (B[o + 2] - oz) * iz; b = (B[o + 5] - oz) * iz; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b))
    if (!(near <= far) || far < 0 || near > best) continue
    if (N[id] === 0) { if (top < 62) { stack[top++] = L[id]; stack[top++] = R[id] } continue }
    for (let i = S[id], end = S[id] + N[id]; i < end; i++) {
      const t = order[i] * 9
      const ax = T[t], ay = T[t + 1], az = T[t + 2], e1x = T[t + 3] - ax, e1y = T[t + 4] - ay, e1z = T[t + 5] - az, e2x = T[t + 6] - ax, e2y = T[t + 7] - ay, e2z = T[t + 8] - az
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz
      if (det > -1e-12 && det < 1e-12) continue
      const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * px + sy * py + sz * pz) * inv
      if (u < 0 || u > 1) continue
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv
      if (v < 0 || u + v > 1) continue
      const d = (e2x * qx + e2y * qy + e2z * qz) * inv
      if (d > 1e-6 && d < best) best = d
    }
  }
  return best
}
