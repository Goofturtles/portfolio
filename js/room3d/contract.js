// Reads the Blender export. Reference: film/SPEC.md, "Contract between Blender and the site: site/media/room3d/".
// Every position, size, camera and file name comes from room3d.json or from the glb's own named nodes; nothing about
// where things are is written in the site's code. Until the real export exists the stand-in in _standin/ is read
// (same contract, plain shapes), and the room says so on screen. `?room3d=standin` in the address asks for the
// stand-in on purpose (it is the only baked scene until the real atlases arrive).
import { retry } from '../config.js'

const REAL = 'media/room3d/', STANDIN = 'media/room3d/_standin/'
const first = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; return undefined }
const vec = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v.x, v.y, v.z] : null)
const list = (o, key = 'id') => (Array.isArray(o) ? o : Object.entries(o || {}).map(([k, v]) => ({ [key]: k, ...v })))

async function read(dir) {
  const r = await fetch(dir + 'room3d.json', { cache: 'no-cache' })
  if (r.status === 404) return null                             // not exported yet: that is an answer, not a failure
  if (!r.ok) throw new Error(dir + 'room3d.json ' + r.status)
  return r.json()
}

export async function loadContract() {
  let dir = /[?&]room3d=standin/.test(location.search) ? STANDIN : REAL
  let raw = await retry(() => read(dir)).catch(() => null)      // a refused request is asked again (the local server drops some of a burst)
  if (!raw && dir !== STANDIN) { dir = STANDIN; raw = await retry(() => read(STANDIN)) }
  if (!raw) throw new Error('room3d: no room3d.json')
  return normalise(raw, dir)
}

// one light atlas file: the json may name it whole, name its stem, or only count them (lm_<theme>_<n>_<size>.webp)
function atlasFile(entry, theme, n, size) {
  if (entry && typeof entry === 'object') entry = first(entry, String(size), 's' + size, 'file', 'src', 'name')
  if (typeof entry !== 'string') return `lm_${theme}_${n}_${size}.webp`
  if (/\.(webp|png|jpe?g|avif)$/i.test(entry)) return entry.replace(/_(4096|2048)(?=\.\w+$)/, '_' + size)
  return `${entry}_${size}.webp`
}

function normalise(j, dir) {
  const baked = j.baked !== false
  const themes = {}
  for (const t of list(j.themes)) {
    const id = first(t, 'id', 'name', 'theme')
    let atl = first(t, 'atlases', 'atlas', 'lightmaps', 'lm')
    if (typeof atl === 'number') atl = Array.from({ length: atl })
    if (!Array.isArray(atl)) atl = atl ? [atl] : []
    if (baked && !atl.length) atl = [null]
    const env = first(t, 'env', 'panorama', 'pano')
    themes[id] = {
      id, frame: first(t, 'frame', 'f'), ui: t.ui, atlas: (n, size) => dir + atlasFile(atl[n], id, n, size), atlases: baked ? atl.length : 0,
      env: env ? dir + env : baked ? dir + `env_${id}.webp` : null,
      background: first(t, 'background', 'bg', 'background_colour', 'background_color') || '#14131a',
      glow: first(t, 'glow', 'glows') || {}, levels: first(t, 'glow_levels', 'levels') || {},      // by material or node name; by what it is ("lamp_level")
    }
  }
  const cameras = {}
  for (const c of list(j.cameras || j.cams, 'theme')) {
    const id = String(first(c, 'theme', 'id', 'name', 'node')).replace(/^cam_/, '')
    cameras[id] = { node: c.node || 'cam_' + id, frame: first(c, 'frame', 'f'), index: first(c, 'path_index', 'index'), position: vec(first(c, 'position', 'pos', 'location')), target: vec(first(c, 'target', 'aim', 'look_at')),
      fovH: first(c, 'fov_x', 'fov_h', 'hfov'), fovV: first(c, 'fov_y', 'fov_v', 'vfov', 'yfov', 'fov'), lens: first(c, 'lens_mm', 'lens'), sensor: first(c, 'sensor_mm', 'sensor') || 36, fstop: first(c, 'fstop', 'f_stop') }
  }
  // the film's path: parallel lists, or one list of { position, target }
  const P = j.path || j.camera_path || {}
  let positions = first(P, 'position', 'positions', 'pos'), targets = first(P, 'target', 'targets', 'aims')
  const rows = Array.isArray(P) ? P : first(P, 'frames', 'samples', 'points')
  if (!positions && Array.isArray(rows)) { positions = rows.map((r) => vec(first(r, 'position', 'pos', 'p'))); targets = rows.map((r) => vec(first(r, 'target', 'aim', 't'))) }
  const firstFrame = first(P, 'first', 'start', 'from') ?? (Array.isArray(rows) && rows[0] ? first(rows[0], 'frame', 'f') : undefined) ?? 0
  const S = j.swing || {}, SP = S.pointer || S, SD = S.drag || {}, M = j.mirror || {}, B = j.ball || {}, D = j.desk || {}
  const objects = list(j.objects, 'node').map((o) => {
    const opens = o.opens !== undefined ? o.opens : o.place !== undefined && !Array.isArray(o.place) ? o.place : o.id
    return { node: o.node, id: String(o.node || o.id).replace(/^obj_/, ''), opens: opens || null, does: String(first(o, 'does', 'action') || ''),
      place: vec(Array.isArray(o.place) ? o.place : o.foot), centre: vec(first(o, 'centre', 'center')), size: vec(o.size), radius: o.radius, pivot: o.pivot, axis: o.axis, stems: o.stems, name: o.name }
  })
  const outline = first(D, 'outline') || first(B, 'edges', 'table_edges', 'outline', 'polygon') || null
  return {
    dir, glb: dir + (j.glb || 'room.glb'), baked, standin: !!j.standin || dir === STANDIN, themes, cameras,
    path: positions && positions.length > 1 ? { first: firstFrame, positions: positions.map(vec), targets: (targets || []).map(vec) } : null,
    swing: { yaw: first(SP, 'yaw_deg', 'yaw') ?? 3, pitch: first(SP, 'pitch_deg', 'pitch') ?? 1.5, pivot: vec(S.pivot),
      from: first(SD, 'from_index') ?? (Array.isArray(S.drag) ? S.drag[0] - firstFrame : null), to: first(SD, 'to_index') ?? (Array.isArray(S.drag) ? S.drag[1] - firstFrame : null), over: first(SD, 'overshoot_index') ?? 3 },
    mirror: { node: first(M, 'node', 'mesh'), material: M.material, height: first(M, 'height', 'y') ?? D.height ?? null, rough: first(M, 'roughness', 'softness') ?? 0.11, coatRough: first(M, 'coat_roughness') ?? 0.05,
      metallic: first(M, 'metallic') ?? 0.25, f0: first(M, 'f0') ?? 0.08, coatF0: first(M, 'coat_f0') ?? 0.04, strength: first(M, 'strength') ?? 1, fit: M.fit || null },      // fit: per theme, how much atlas and how much mirror image make the Cycles desk
    desk: { outline, wall: D.wall && D.wall.centre ? { centre: D.wall.centre, radius: D.wall.radius } : null },
    floorY: j.floor_y ?? null,
    screen: { node: first(j.screen || {}, 'node', 'mesh') || 'screen' },
    ball: { node: first(B, 'node') || 'obj_ball', radius: B.radius },
    objects, pivots: j.pivots || {}, materials: j.materials || {},
    envYaw: first(j, 'env_yaw_deg', 'env_yaw') ?? 0,
  }
}
