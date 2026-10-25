// His things on the room's wall: his own photo, a frame of one of his films and his results, framed and hung like a
// small gallery row on the round wall above the desk, each with a soft light of its own behind it; and the word
// "Theme" printed on the lamp's shade. The pictures come from his previous portfolio (js/room3d/_wall_art.py makes
// them: portfolio-v2's portrait.jpg, the GhostBus film frame record/ghostbus-city.jpg, and his results typeset word
// for word from his data). Reference for how they must sit in the render: film/SPEC.md "How the film's look survives
// being live" (the room has no live lights: everything is the bake). So the frames are lit BY the bake: every pixel of
// a frame reads the wall's own light-atlas texel right behind it (both themes, mixed as the room's light blends),
// divides out the plaster's colour and so receives exactly the light the wall receives there, turned for which way
// the surface faces. Their shadow on the wall is offset and softened the way the bake's light falls across the wall
// round each frame (measured from the atlas itself, on the graphics card), the glass shows the theme's panorama
// faintly, sliding as the camera moves, and nothing is brighter than the wall round it (the lit wall, once the
// frame's own backlight is on it). The backlight is a hidden LED strip: warm-neutral light tinted by the theme's own
// light, falling off over 10 to 20 cm round the frame, a little stronger at the top.
// The photo is the one frame that opens: his résumé, in the page (js/resume.js). It says so the way a real frame
// would: a small engraved brass plate under the picture, its light breathing very slowly, and pointed at it leans
// off the wall toward the eye with its light rising; its name tip reads "Résumé". It is one more of the room's
// objects for picking and hover (added to things.js's own list at run time, so things.js is not touched); its click
// and Enter (a focusable button kept over it) are handled here.
import * as THREE from 'three'
import { makeTree } from './pick.js'
import { Damp } from './motion.js'
import { GLASS_LAYER } from './post.js'

const DIR = 'media/room3d/wall/'
// The row: where its middle is on the round wall (degrees round room3d.json desk.wall's centre, 0 = facing the room
// along +z, + toward +x), the height of the frames' common centre line above the desk top, and the gap between frames.
// The pictures' band is set by the room's own cameras: at every theme's resting view the wall shows from the desk to
// about 0.45 m above it, between the lamp and the vase (measured from the four homes at 16:9), so the row hangs where
// small art hangs over a real desk: its foot 17 to 21 cm above the top, clear of the lamp and the laptop's lid.
const ROW = { deg: -12.5, y: 0.29, gap: 0.042 }
// left to right. w, h: outside of the frame (metres). win: the mat's window (the picture's shape); none: the print
// fills the frame. up: the window sits this much above the middle (a mat is weighted at the foot, as framers do).
// plate: a brass plate on the mat [width, height, its middle's height]. The film frame is on the right, by the vase:
// from the day camera the flowers pass in front of it (a picture behind a flower), never in front of the results' type.
const PIECES = [
  { id: 'record', src: 'record.jpg', w: 0.19, h: 0.25, win: null, up: 0 },
  { id: 'portrait', src: 'portrait.jpg', w: 0.19, h: 0.25, win: [0.112, 0.1493], up: 0.0145, plate: [0.08, 0.018, -0.0856], opens: 'resume' },
  { id: 'still', src: 'still.jpg', w: 0.235, h: 0.168, win: [0.159, 0.0894], up: 0.002 },
]
// the moulding (a thin painted frame): face width, depth from the wall to its face, how far its back stands off the
// wall (bumpers), the round on its outer arris, the bevel on its inner edge; then the glass and the mat
const FACE = 0.014, DEPTH = 0.02, OFF = 0.004, ARRIS = 0.0012, BEVEL = 0.0028
const ZF = OFF + DEPTH, ZG = ZF - 0.006, ZM = ZG - 0.0025, MAT = 0.0016, TUCK = 0.003, BRASS = 0.0011
// albedo, linear: the paint (a deep ink, the scene's own Matte_ink family), the mat (a warm white a shade under the
// plaster, whose glb colour is 0.66 / 0.61 / 0.62, so it never outshines the wall), and the print's white point
// (the paper's own white, 0.88, comes out a shade under the plaster too)
const PAINT = [0.042, 0.038, 0.05], BOARD = [0.625, 0.612, 0.594], PAPER = 0.7
const MARGIN = 0.3                                              // how far round a frame its shadow and its light reach on the wall
const TILT = THREE.MathUtils.degToRad(3), BREATH = 6.5           // the photo pointed at: leans this far; its light breathes once in this many seconds
const TIP = ['Résumé', 'Click to open his résumé']
// the lamp's word: how high on the shade (share of its height from the foot), how big (metres), its ink as a filter
const LAMP_WORD = { at: 0.5, w: 0.054, h: 0.019, ink: [0.74, 0.71, 0.83] }

const COMMON = `
precision highp float;
precision highp sampler2D;
uniform sampler2D uLmA, uLmB, uEnvA, uEnvB;
uniform float uMix, uEnvYaw, uGlowK;
uniform vec2 uWallO, uWallU, uWallV;
uniform vec3 uPlaster;
const float GLOW = .45;                                           // the backlight's light just past the frame's edge, as the bake counts light (the day's wall gets about 1.2)
vec3 lin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
vec3 srgb(vec3 c) { return pow(max(c, 0.), vec3(1. / 2.2)); }
float lum(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
// the wall's baked colour (display values) at a point of the frame's plane, metres right and up from its middle
vec3 wallAt(vec2 p, float lod) { vec2 q = uWallO + p.x * uWallU + p.y * uWallV; return mix(textureLod(uLmA, q, lod).rgb, textureLod(uLmB, q, lod).rgb, uMix); }
// which way the light falls along the wall here, from the bake: the relative change of light per metre, pointing to
// where it is brighter (toward the open room, toward the tube light)
vec2 sun() {
  float c = lum(lin(wallAt(vec2(0.), 5.)));
  float gx = lum(lin(wallAt(vec2(.16, 0.), 5.))) - lum(lin(wallAt(vec2(-.16, 0.), 5.)));
  float gy = lum(lin(wallAt(vec2(0., .14), 5.))) - lum(lin(wallAt(vec2(0., -.14), 5.)));
  return vec2(gx / .32, gy / .28) / max(c, 1e-4);
}
// the backlight's colour: a warm-neutral LED, half taken over by the colour of the theme's own light here
vec3 glowTint() {
  vec3 E = lin(wallAt(vec2(0.), 4.)) / uPlaster, warm = vec3(1., .8, .6) / .8366;
  return mix(warm, E / max(lum(E), 1e-4), .38);
}
`
const ART_VERT = `${COMMON}
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
in vec3 position, normal; in vec2 uv; in float part;
out vec3 vL, vNl, vW, vN; out vec2 vUv; flat out float vPart; flat out vec2 vSun; flat out vec3 vTint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  vL = position; vNl = normal; vW = w.xyz; vN = mat3(modelMatrix) * normal; vUv = uv; vPart = part; vSun = sun(); vTint = glowTint();
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const ART_FRAG = `${COMMON}
uniform vec3 cameraPosition, uPaint, uBoard;
uniform sampler2D uMap, uPlate;
uniform vec2 uOpen, uDepth;
uniform vec3 uWin;
uniform vec4 uPlateBox;
uniform float uHover, uFade, uBloomPass, uPaper, uInner;
in vec3 vL, vNl, vW, vN; in vec2 vUv; flat in float vPart; flat in vec2 vSun; flat in vec3 vTint;
out vec4 frag;
vec3 env(vec3 d, float lod) {
  vec2 e = vec2(atan(d.x, -d.z) / 6.28318530718 + .5 + uEnvYaw, .5 - asin(clamp(d.y, -1., 1.)) / 3.14159265359);
  return mix(textureLod(uEnvA, e, lod).rgb, textureLod(uEnvB, e, lod).rgb, uMix);
}
float far() { float d = length(vW - cameraPosition); return uDepth.x > 0. ? clamp(d * uDepth.x, 0., 1.) : clamp(uDepth.y / max(d, .001), 0., 1.); }
// the shade a rim casts on what lies just inside it: deepest under the edge the light comes over, none on the far side
float rim(vec2 p, vec2 h, vec2 s, float w) {
  vec4 d = max(vec4(h.y - p.y, p.y + h.y, p.x + h.x, h.x - p.x), 0.);      // to the top, bottom, left, right edges
  vec4 k = vec4(.12 + .33 * max(s.y, 0.), .05 + .3 * max(-s.y, 0.), .07 + .3 * max(-s.x, 0.), .07 + .3 * max(s.x, 0.));
  return 1. - dot(k, exp(-d / w));
}
void main() {
  if (uFade < .999 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) > uFade) discard;
  vec3 W = wallAt(vL.xy, 2.5), E = lin(W) / uPlaster;                  // the light the wall gets right here
  vec3 led = vTint * GLOW * uGlowK;                                     // the backlight, as it is at the frame's edge
  float g = length(vSun);
  vec2 s = normalize(vec2(vSun.x, vSun.y + 1.2));                      // light comes over the top, tipped toward the bright side
  vec3 n = normalize(vNl), a, V = normalize(cameraPosition - vW), N = normalize(vN);
  float k = 1., sheen = 0.;
  if (vPart < .5) {                                                    // the painted moulding
    a = uPaint;
    k = mix(clamp(.68 + .22 * n.y - .2 * max(-n.y, 0.) + .2 * dot(n.xy, normalize(vSun + 1e-5)) * min(g / 3., 1.), .3, 1.04), 1., max(n.z, 0.));
    k *= mix(.5, 1., smoothstep(${OFF.toFixed(4)}, ${(OFF + DEPTH * 0.75).toFixed(4)}, vL.z));      // its sides darken where they meet the wall
    E = E * k + led * .12 * max(1. - n.z, 0.);                         // the strip is behind it: against its light the frame stays a dark edge
    k = 1.; sheen = .35;
  } else if (vPart < 1.5) {                                            // the mat's face
    a = uBoard; k = rim(vL.xy, uOpen, s, .0055);
  } else if (vPart < 2.5) {                                            // the mat's bevel: its white core, lit by the way it faces
    a = uBoard; k = clamp(.86 + .3 * n.y + .1 * dot(n.xy, s), .55, 1.) * rim(vL.xy, uOpen, s, .0055);
  } else if (vPart < 3.5) {                                            // the picture: a print, its white a shade under the plaster
    a = lin(texture(uMap, vUv).rgb) * uPaper;
    k = uWin.x > 0. ? rim(vL.xy - vec2(0., uWin.z), uWin.xy, s, .0013) * rim(vL.xy, uOpen, s, .0055) : rim(vL.xy, uOpen, s, .0055);
  } else {                                                             // the brass plate: brushed, the letters cut and filled black
    vec2 q = (vL.xy - uPlateBox.xy) / uPlateBox.zw + .5;
    float cut = n.z > .5 ? texture(uPlate, vec2(q.x, 1. - q.y)).r : 0.;
    vec3 brass = vec3(.83, .6, .3);
    vec3 shine = vec3(lum(lin(env(reflect(-V, N), 3.5)))) * .35 + E * uPlaster * .7;      // brushed: the room's brightness in it, never the room's hue
    vec3 c = srgb(mix(brass * shine, vec3(.006, .005, .004) * E, cut));
    frag = vec4(c * (1. + .08 * uHover) * (1. - uBloomPass), far());
    return;
  }
  if (vPart > .5) E += led * (.1 + .05 * clamp(vL.y / uOpen.y, -1., 1.));       // the picture lifted a little by its spill, more at the top
  if (uInner > 0. && vPart > .5 && vPart < 3.5) {                     // the résumé's frame alone: lit from within, as a lightbox
    vec4 dd = max(vec4(uOpen.y - vL.y, vL.y + uOpen.y, vL.x + uOpen.x, uOpen.x - vL.x), 0.);
    float edge = min(dot(vec4(1.2, .75, 1., 1.), exp(-dd / .013)), 1.4);      // a hidden strip under the lip: strongest along it, most from the top
    E += led * uInner * (.16 + .42 * edge) * (vPart > 2.5 ? .6 : 1.);           // the mat a touch brighter, the photo a little lifted
    k = mix(k, 1., .65 * uInner);                                     // and the lip's own shade mostly filled by it
  }
  vec3 c = srgb(a * E * k);
  if (sheen > 0.) {                                                    // satin paint: a soft sheen of the room on its edges
    float f = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
    c += env(reflect(-V, N), 4.) * f * sheen * min(1., lum(W) * 1.6);
  }
  c *= 1. + .08 * uHover;
  float top = lum(srgb(lin(W) + uPlaster * led * 1.15));               // never brighter than the wall round it, with its light on it
  if (lum(c) > top) c *= top / lum(c);
  frag = vec4(c * (1. - uBloomPass), far());
}`

// the glass in front of each picture: the panorama's room seen in it, by Fresnel, faint; over what is behind it
const GLASS_VERT = `
precision highp float;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
in vec3 position, normal;
out vec3 vW, vN;
void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`
const GLASS_FRAG = `
precision highp float;
uniform vec3 cameraPosition;
uniform sampler2D uEnvA, uEnvB;
uniform float uMix, uEnvYaw, uHover, uBloomPass;
in vec3 vW, vN;
out vec4 frag;
vec3 env(vec3 d, float lod) {
  vec2 e = vec2(atan(d.x, -d.z) / 6.28318530718 + .5 + uEnvYaw, .5 - asin(clamp(d.y, -1., 1.)) / 3.14159265359);
  return mix(textureLod(uEnvA, e, lod).rgb, textureLod(uEnvB, e, lod).rgb, uMix);
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  float f = .08 + .92 * pow(1. - abs(dot(N, V)), 5.);                  // picture glass: two faces, about 8 % straight on
  vec3 e = env(reflect(-V, N), .8);
  frag = vec4((e * f + uHover * .012) * (1. - uBloomPass), f);
}`

// each frame's shadow and light on the wall: a patch laid on the wall itself. Its colour is added and its alpha
// multiplies what is there (the room's light kept), so the result is the wall's own picture with the frame's shadow
// taken out of the room's light and the backlight added to it, as light adds on plaster: lin(wall) x kept + plaster x LED.
const PATCH_VERT = `${COMMON}
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
in vec3 position; in vec2 local;
out vec2 vP; flat out vec3 vOff; flat out vec3 vTint;
void main() {
  vec2 g = sun();
  float k = length(g);
  vec2 off = vec2(0., -.004) - (k > 1e-4 ? g / k : vec2(0.)) * clamp(k * .003, 0., .012);
  vOff = vec3(off, .006 + .02 / (1. + k));                          // where the shadow falls, and how soft it is
  vTint = glowTint();
  vP = local;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.);
}`
const PATCH_FRAG = `${COMMON}
uniform vec2 uHalf;
uniform float uLift;
in vec2 vP; flat in vec3 vOff; flat in vec3 vTint;
out vec4 frag;
float box(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
void main() {
  float blur = vOff.z, top = smoothstep(0., uHalf.y, vP.y);
  float fall = 1. - smoothstep(-blur * .6, blur * 1.4, box(vP - vOff.xy, uHalf, .003));
  float touch = exp(-max(box(vP, uHalf, .0015), 0.) / .0035) * (1. - .7 * uLift * top);      // leaning, its top leaves the wall
  float keep = 1. - .3 * fall * fall - .2 * touch;                  // the room's light kept, as a display value
  float d = max(box(vP, uHalf, .004), 0.);
  float side = .95 + .2 * clamp(vP.y / (uHalf.y + .05), -1., 1.) + .3 * uLift * top;
  // brightest just past the edge, half by 6.5 cm, a fifth by 13 cm, gone by 29 cm: a strip of light behind the frame
  float G = GLOW * uGlowK * side * (.6 + .4 * smoothstep(0., .012, d)) / (1. + d * d / .0042) * (1. - smoothstep(.12, .29, d));
  vec3 W = wallAt(vP, 1.5);
  G *= 1. + .8 * smoothstep(.3, .8, lum(lin(W)));                    // turned up in a bright room, so it still shows by day
  vec3 lit = lin(W) * pow(keep, 2.2) + uPlaster * vTint * G;
  vec3 base = W * keep, room = max(1. - base, vec3(1e-3));
  frag = vec4(room * (1. - exp(-max(srgb(lit) - base, 0.) / room)), keep);      // the added light eases into what headroom is left: it never reaches white
}`

// "Theme" on the lamp's shade: a filter over the lit shade, so it stays the same share darker however bright it is
const WORD_VERT = `
precision highp float;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
in vec3 position; in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }`
const WORD_FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uInk;
uniform float uFade;
in vec2 vUv;
out vec4 frag;
void main() {
  if (uFade < .999 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) > uFade) discard;
  float m = texture(uMap, vUv, .6).r;                               // a little soft: printed on a lit diffuser
  frag = vec4(mix(vec3(1.), uInk, m), 1.);
}`

// ---- the frame, as geometry, in its own space: x right, y up, z out of the wall (z = 0 the wall at its middle) ----
function framed(p) {
  const pos = [], nor = [], uv = [], part = [], idx = []
  const add = (pts, n, k, uvs) => {
    const i = pos.length / 3, e1 = new THREE.Vector3().subVectors(pts[1], pts[0]), e2 = new THREE.Vector3().subVectors(pts[2], pts[0])
    const flip = e1.cross(e2).dot(n) < 0                       // front faces wind anticlockwise as seen along their normal
    pts.forEach((v, j) => { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); part.push(k); uv.push(...(uvs ? uvs[j] : [0, 0])) })
    idx.push(...(flip ? [i, i + 2, i + 1, i, i + 3, i + 2] : [i, i + 1, i + 2, i, i + 2, i + 3]))
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const hw = p.w / 2, hh = p.h / 2
  // the moulding: one profile (inset from the outer edge, height off the wall) swept round with mitred corners
  const r = ARRIS
  const prof = [[0, OFF], [0, ZF - r], [r * 0.293, ZF - r * 0.293], [r, ZF], [FACE - BEVEL, ZF], [FACE, ZF - BEVEL], [FACE, ZM]]
  const sides = [[0, 1], [1, 0], [0, -1], [-1, 0]]                 // outward: top, right, bottom, left
  const corner = (o, u, end) => {                                   // the two ends of one side of the rectangle inset by u
    const a = hw - u, b = hh - u
    if (o[1] === 1) return end ? V(a, b, 0) : V(-a, b, 0)
    if (o[0] === 1) return end ? V(a, -b, 0) : V(a, b, 0)
    if (o[1] === -1) return end ? V(-a, -b, 0) : V(a, -b, 0)
    return end ? V(-a, b, 0) : V(-a, -b, 0)
  }
  for (const o of sides) {
    for (let i = 0; i < prof.length - 1; i++) {
      const [u0, z0] = prof[i], [u1, z1] = prof[i + 1], du = u1 - u0, dz = z1 - z0, l = Math.hypot(du, dz)
      const nu = -dz / l, nz = du / l                                // the profile's normal: -u is outward
      const n = V(-nu * o[0], -nu * o[1], nz).normalize()
      const a0 = corner(o, u0, 0).setZ(z0), a1 = corner(o, u0, 1).setZ(z0), b1 = corner(o, u1, 1).setZ(z1), b0 = corner(o, u1, 0).setZ(z1)
      add([a0, a1, b1, b0], n, 0)
    }
  }
  const ox = hw - FACE, oy = hh - FACE, mx = ox + TUCK, my = oy + TUCK      // the opening inside the lip; the mat runs under it
  const Z = V(0, 0, 1)
  if (p.win) {
    const wx = p.win[0] / 2, wy = p.win[1] / 2, c = p.up, fx = wx + MAT, fy = wy + MAT      // the window at the back of the mat, and at its face
    add([V(-mx, c + fy, ZM), V(mx, c + fy, ZM), V(mx, my, ZM), V(-mx, my, ZM)], Z, 1)
    add([V(-mx, -my, ZM), V(mx, -my, ZM), V(mx, c - fy, ZM), V(-mx, c - fy, ZM)], Z, 1)
    add([V(-mx, c - fy, ZM), V(-fx, c - fy, ZM), V(-fx, c + fy, ZM), V(-mx, c + fy, ZM)], Z, 1)
    add([V(fx, c - fy, ZM), V(mx, c - fy, ZM), V(mx, c + fy, ZM), V(fx, c + fy, ZM)], Z, 1)
    const zb = ZM - MAT, s = Math.SQRT1_2
    add([V(-fx, c + fy, ZM), V(fx, c + fy, ZM), V(wx, c + wy, zb), V(-wx, c + wy, zb)], V(0, -s, s), 2)
    add([V(-fx, c - fy, ZM), V(fx, c - fy, ZM), V(wx, c - wy, zb), V(-wx, c - wy, zb)], V(0, s, s), 2)
    add([V(-fx, c - fy, ZM), V(-fx, c + fy, ZM), V(-wx, c + wy, zb), V(-wx, c - wy, zb)], V(s, 0, s), 2)
    add([V(fx, c - fy, ZM), V(fx, c + fy, ZM), V(wx, c + wy, zb), V(wx, c - wy, zb)], V(-s, 0, s), 2)
    // the picture behind the window, a little larger than it (its edge is under the mat); v = 0 is the image's top
    const e = 0.003, zp = zb - 0.0003, U = (x) => (x + wx) / (2 * wx), W = (y) => (c + wy - y) / (2 * wy)
    add([V(-wx - e, c - wy - e, zp), V(wx + e, c - wy - e, zp), V(wx + e, c + wy + e, zp), V(-wx - e, c + wy + e, zp)], Z, 3,
      [[U(-wx - e), W(c - wy - e)], [U(wx + e), W(c - wy - e)], [U(wx + e), W(c + wy + e)], [U(-wx - e), W(c + wy + e)]])
  } else {
    // a print that fills the frame: the sheet is the opening, its edge tucked under the lip
    const U = (x) => (x + ox) / (2 * ox), W = (y) => (oy - y) / (2 * oy)
    add([V(-mx, -my, ZM), V(mx, -my, ZM), V(mx, my, ZM), V(-mx, my, ZM)], Z, 3, [[U(-mx), W(-my)], [U(mx), W(-my)], [U(mx), W(my)], [U(-mx), W(my)]])
  }
  if (p.plate) {                                                    // the brass plate on the mat: its face and its four edges
    const [pw, ph, py] = p.plate, x = pw / 2, y0 = py - ph / 2, y1 = py + ph / 2, z1 = ZM + BRASS
    add([V(-x, y0, z1), V(x, y0, z1), V(x, y1, z1), V(-x, y1, z1)], Z, 4)
    add([V(-x, y1, ZM), V(x, y1, ZM), V(x, y1, z1), V(-x, y1, z1)], V(0, 1, 0), 4)
    add([V(-x, y0, ZM), V(x, y0, ZM), V(x, y0, z1), V(-x, y0, z1)], V(0, -1, 0), 4)
    add([V(-x, y0, ZM), V(-x, y1, ZM), V(-x, y1, z1), V(-x, y0, z1)], V(-1, 0, 0), 4)
    add([V(x, y0, ZM), V(x, y1, ZM), V(x, y1, z1), V(x, y0, z1)], V(1, 0, 0), 4)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('part', new THREE.Float32BufferAttribute(part, 1))
  g.setIndex(idx)
  g.computeBoundingSphere(); g.computeBoundingBox()
  const glass = new THREE.PlaneGeometry(2 * ox + 0.004, 2 * oy + 0.004).translate(0, 0, ZG)
  return { art: g, glass, open: [ox, oy] }
}

let current = null                                              // one wall per page: a remount takes the last one's listeners away

export function createWall(scene, look, things, contract, camera) {
  if (current) current.dispose()
  const none = { ready: Promise.resolve(), update() {}, dispose() {}, group: null }
  const ring = contract.desk && contract.desk.wall
  if (!ring) return none
  const [cx, cz] = ring.centre, R = ring.radius, deskY = contract.mirror.height ?? 0
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3()
  rc.near = 0; rc.far = R * 2
  // a point on the wall: the ray from the wall's axis outward, through angle t (radians) at height y
  const radial = (t, y, target) => { o.set(cx, y, cz); d.set(Math.sin(t), 0, Math.cos(t)); rc.set(o, d); return rc.intersectObject(target, true)[0] || null }
  const first = radial(THREE.MathUtils.degToRad(ROW.deg), deskY + ROW.y, scene)
  const wall = first && first.object
  const lm = wall && wall.material && wall.material.uniforms
  if (!wall || !lm || !lm.uLmA || !first.uv1) return none          // not the baked round wall this was made for: hang nothing
  // the plaster's own colour (its glTF colour, which look.js holds as display values), linear: what the atlas is divided by
  const c0 = lm.uColor ? lm.uColor.value : new THREE.Vector3(0.9, 0.9, 0.9)
  const plaster = new THREE.Vector3(...[c0.x, c0.y, c0.z].map((x) => Math.max(0.05, Math.pow(x, 2.2))))
  const css = document.querySelector('link[data-wall]') || Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/wall.css' })
  css.dataset.wall = ''; if (!css.isConnected) document.head.append(css)

  const group = new THREE.Group(), patches = new THREE.Group()
  group.name = 'wall_art'; patches.name = 'wall_art_light'
  const U = look.U, made = [], loads = []
  const total = PIECES.reduce((s, p) => s + p.w, 0) + ROW.gap * (PIECES.length - 1)
  let along = -total / 2, photo = null
  const plateTex = look.picture(DIR + 'plate.png').catch(() => null)
  for (const p of PIECES) {
    const mid = along + p.w / 2
    along += p.w + ROW.gap
    const t = THREE.MathUtils.degToRad(ROW.deg) + mid / R, y = deskY + ROW.y
    const hit = radial(t, y, wall)
    if (!hit || !hit.uv1) continue
    const N = new THREE.Vector3(Math.sin(t), 0, Math.cos(t)), T = new THREE.Vector3(Math.cos(t), 0, -Math.sin(t)), Y = new THREE.Vector3(0, 1, 0)
    const at = hit.point.clone()
    // the wall's light-atlas coordinates as a straight map of the frame's plane (the wall is a smooth cylinder, its
    // atlas laid along it, so over one frame the map is linear): at the middle, and per metre right and up
    const uvAt = (x, yy) => { const h = radial(t + x / R, y + yy, wall); return h && h.uv1 ? h.uv1.clone() : null }
    const r1 = uvAt(0.1, 0), l1 = uvAt(-0.1, 0), u1 = uvAt(0, 0.1), d1 = uvAt(0, -0.1)
    if (!r1 || !l1 || !u1 || !d1) continue
    const glowK = { value: 1 }
    const wallMap = { uWallO: { value: hit.uv1.clone() }, uWallU: { value: r1.sub(l1).multiplyScalar(1 / 0.2) }, uWallV: { value: u1.sub(d1).multiplyScalar(1 / 0.2) }, uPlaster: { value: plaster }, uGlowK: glowK }
    const shared = { uLmA: lm.uLmA, uLmB: lm.uLmB, uMix: U.uMix, uEnvA: U.uEnvA, uEnvB: U.uEnvB, uEnvYaw: U.uEnvYaw, uDepth: U.uDepth, uBloomPass: U.uBloomPass }
    const geo = framed(p)
    const hover = { uHover: { value: 0 }, uFade: { value: 1 } }
    const blank = new THREE.DataTexture(new Uint8Array([232, 228, 222, 255]), 1, 1); blank.needsUpdate = true
    const art = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: ART_VERT, fragmentShader: ART_FRAG, side: THREE.FrontSide,
      uniforms: { ...shared, ...wallMap, ...hover, uMap: { value: blank }, uPlate: { value: blank }, uPaint: { value: new THREE.Vector3(...PAINT) }, uBoard: { value: new THREE.Vector3(...BOARD) }, uPaper: { value: PAPER },
        uInner: { value: p.opens ? 1 : 0 }, uOpen: { value: new THREE.Vector2(...geo.open) }, uWin: { value: p.win ? new THREE.Vector3(p.win[0] / 2, p.win[1] / 2, p.up) : new THREE.Vector3() },
        uPlateBox: { value: p.plate ? new THREE.Vector4(0, p.plate[2], p.plate[0], p.plate[1]) : new THREE.Vector4(0, 0, 1, 1) } } })
    const glass = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, uniforms: { ...shared, uHover: hover.uHover },
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
    const node = new THREE.Group()
    node.name = 'wall_' + p.id
    node.matrix.makeBasis(T, Y, N).setPosition(at)
    node.matrix.decompose(node.position, node.quaternion, node.scale)
    const artMesh = new THREE.Mesh(geo.art, art), glassMesh = new THREE.Mesh(geo.glass, glass)
    glassMesh.layers.set(GLASS_LAYER)                               // like the room's own glass: never hides a glow
    node.add(artMesh, glassMesh)
    node.visible = false
    group.add(node)

    // the shadow and the backlight on the wall: a grid over the frame and a margin round it, every point put on the
    // wall itself (a hair off it), so it follows the curve exactly
    const hx = p.w / 2 + MARGIN, hy = p.h / 2 + MARGIN, nx = 30, ny = 26, pos = [], loc = [], idx = []
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const lx = -hx + (2 * hx * i) / nx, ly = -hy + (2 * hy * j) / ny, ta = t + Math.atan2(lx, R)
      const w = radial(ta, y + ly, wall)
      const q = w ? w.point.addScaledVector(d.set(Math.sin(ta), 0, Math.cos(ta)), 0.0006) : at.clone().addScaledVector(T, lx).addScaledVector(Y, ly)
      pos.push(q.x, q.y, q.z); loc.push(lx, ly)
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1; idx.push(a, b, e, a, e, c) }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('local', new THREE.Float32BufferAttribute(loc, 2)); sg.setIndex(idx)
    sg.computeBoundingSphere()
    const lift = { value: 0 }
    const sm = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: PATCH_VERT, fragmentShader: PATCH_FRAG, side: THREE.DoubleSide, forceSinglePass: true,      // applied once, not once a side
      uniforms: { ...shared, ...wallMap, uHalf: { value: new THREE.Vector2(p.w / 2, p.h / 2) }, uLift: lift },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
    const patch = new THREE.Mesh(sg, sm)
    patch.layers.set(GLASS_LAYER)
    patch.visible = false
    patches.add(patch)

    loads.push(look.picture(DIR + p.src).then((tex) => { art.uniforms.uMap.value = tex }))
    if (p.plate) loads.push(plateTex.then((tex) => { if (tex) art.uniforms.uPlate.value = tex }))
    const piece = { id: p.id, node, art: artMesh, glass: glassMesh, patch, hover, glowK, lift, at, normal: N, size: [p.w, p.h], rest: node.matrix.clone(), opens: p.opens || null }
    made.push(piece)
    if (p.opens) photo = piece
  }
  scene.add(group, patches)
  group.updateMatrixWorld(true); patches.updateMatrixWorld(true)

  // ---- "Theme" on the lamp's shade, facing the middle of the four resting cameras, laid on the shade itself ----
  const lamp = things && things.by && things.by('themes')
  let shade = null
  if (lamp) lamp.node.traverse((m) => { if (!shade && m.isMesh && m.userData.kind === 'glow') shade = m })
  if (shade) {
    const box = new THREE.Box3().setFromObject(shade), axis = box.getCenter(new THREE.Vector3())
    let sx = 0, sz = 0
    for (const c of Object.values(contract.cameras)) if (c.position) { const v = new THREE.Vector3(c.position[0] - axis.x, 0, c.position[2] - axis.z).normalize(); sx += v.x; sz += v.z }
    const face = Math.atan2(sx, sz), yMid = box.min.y + (box.max.y - box.min.y) * LAMP_WORD.at, far = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
    const all = new THREE.Raycaster(); all.layers.enableAll()
    const onShade = (ang, yy) => { o.set(axis.x + Math.sin(ang) * far * 2, yy, axis.z + Math.cos(ang) * far * 2); d.set(-Math.sin(ang), 0, -Math.cos(ang)); all.set(o, d); return all.intersectObject(shade, false)[0] || null }
    const mid = onShade(face, yMid), rad = mid ? Math.hypot(mid.point.x - axis.x, mid.point.z - axis.z) : 0
    if (mid && rad > 0.01) {
      const span = LAMP_WORD.w / rad, nx = 24, ny = 4, pos = [], uv = [], idx = []
      let ok = true
      for (let j = 0; j <= ny && ok; j++) for (let i = 0; i <= nx; i++) {
        const ang = face - span / 2 + (span * i) / nx, yy = yMid + LAMP_WORD.h / 2 - (LAMP_WORD.h * j) / ny, h = onShade(ang, yy)
        if (!h) { ok = false; break }
        const q = h.point.addScaledVector(d.set(Math.sin(ang), 0, Math.cos(ang)), 0.0004)
        lamp.node.worldToLocal(q)
        pos.push(q.x, q.y, q.z); uv.push(i / nx, j / ny)
      }
      if (ok) {
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1; idx.push(a, c, e, a, e, b) }
        const wg = new THREE.BufferGeometry()
        wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setIndex(idx)
        wg.computeBoundingSphere()
        const wm = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: WORD_VERT, fragmentShader: WORD_FRAG, side: THREE.DoubleSide, forceSinglePass: true,
          uniforms: { uMap: { value: new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1) }, uInk: { value: new THREE.Vector3(...LAMP_WORD.ink) }, uFade: lamp.group.uFade },
          transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
          blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
        wm.uniforms.uMap.value.needsUpdate = true
        const word = new THREE.Mesh(wg, wm)
        word.name = 'themes_Word'; word.layers.set(GLASS_LAYER); word.visible = false
        lamp.node.add(word)
        word.updateMatrixWorld(true)
        loads.push(look.picture(DIR + 'theme.png').then((tex) => { wm.uniforms.uMap.value = tex; word.visible = true }))
      }
    }
  }

  // ---- the photo answers like the room's objects; its click and its Enter open the résumé ----
  let rec = null, time = 0, tipT = 0, tipShown = false, press = null
  const room = document.getElementById('room'), tip = room && room.querySelector('.rtip')
  const listeners = []
  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); listeners.push([target, type, fn, opt]) }
  let key = null
  if (photo && things && Array.isArray(things.records)) {
    const centre = photo.at.clone().addScaledVector(photo.normal, ZF), bound = Math.hypot(...photo.size) / 2
    rec = { id: photo.opens, node: photo.node, opens: null, does: 'his photo on the wall: opens his résumé in the page (wall.js)', group: { id: 'wall_' + photo.id, uHover: photo.hover.uHover, uFade: photo.hover.uFade },
      hover: new Damp(0, 0.2), lift: new Damp(0, 0.18), rest: photo.node.position.clone(), restQ: photo.node.quaternion.clone(), centre, radius: photo.size[0] / 2, bound,
      onDesk: false, forced: 0, sweepAt: -1, liftBy: 0, meshes: [{ mesh: photo.art, tree: makeTree(photo.art.geometry) }] }
    things.records.push(rec)
  }
  // the top middle of the photo's frame and its box, on the page (CSS px of the room)
  const v = new THREE.Vector3(), corners = []
  const onPage = () => {
    const g = photo.art.geometry.boundingBox, w = room.clientWidth, h = room.clientHeight
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? g.max.x : g.min.x, i & 2 ? g.max.y : g.min.y, i & 4 ? g.max.z : g.min.z).applyMatrix4(photo.art.matrixWorld).project(camera)
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    corners.length = 0; corners.push(x0, y0, x1, y1)
    return corners
  }
  // its name tip: the room's own tip (js/room.js's .rtip), placed the way room.js places one
  const showTip = () => {
    if (!tip) return
    const [x0, y0, x1] = onPage(), w = room.clientWidth, h = room.clientHeight
    tip.innerHTML = `<b>${TIP[0]}</b><i>${TIP[1]}</i>`
    tip.hidden = false
    const tw = tip.offsetWidth, th = tip.offsetHeight, x = Math.max(8, Math.min(w - tw - 8, (x0 + x1) / 2 - tw / 2)), y = Math.max(8, Math.min(h - 56 - th, y0 - th - 10))
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    requestAnimationFrame(() => tip.classList.add('on'))
  }
  const hideTip = () => { if (tip && tipShown) { tip.classList.remove('on'); tip.hidden = true } tipShown = false }
  // from: what the keyboard goes back to when it closes (the key button; nothing after a click on the canvas)
  const open = (from) => { hideTip(); import('../resume.js').then((m) => m.openResume(from)).catch((e) => console.warn('The résumé viewer could not open.', e)) }
  const usable = () => room && room.classList.contains('in') && room.classList.contains('live3d') && !room.hidden && !document.documentElement.dataset.resume
  if (rec && room) {
    // a click is a press that never became a drag (js/room3d/input.js's rule: 6 px with a mouse, 10 with a finger)
    on(document, 'pointerdown', (e) => { if (e.target instanceof HTMLCanvasElement && e.target.classList.contains('r3d') && (e.pointerType !== 'mouse' || e.button === 0)) press = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0, touch: e.pointerType === 'touch', canvas: e.target } }, true)
    on(document, 'pointermove', (e) => { if (press && e.pointerId === press.id) press.far = Math.max(press.far, Math.hypot(e.clientX - press.x, e.clientY - press.y)) }, true)
    on(document, 'pointerup', (e) => {
      const p = press
      press = null
      if (!p || e.pointerId !== p.id || p.far > (p.touch ? 10 : 6) || !usable()) return
      const r = p.canvas.getBoundingClientRect(), hit = things.pick(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2)
      if (hit && hit.rec === rec) p.touch ? setTimeout(() => open(), 200) : open()
    }, true)
    on(document, 'pointercancel', () => { press = null }, true)
    // Enter (and a tap of the keyboard's Space) on a button kept over the photo, for whoever moves by keyboard
    key = document.createElement('button')
    key.type = 'button'; key.className = 'wall-key'; key.setAttribute('aria-label', 'Résumé: open his résumé')
    on(key, 'click', () => { if (usable()) open(key) })
    on(key, 'focus', () => { place(); if (usable()) { showTip(); tipShown = true } })
    on(key, 'blur', () => hideTip())
    room.append(key)
  }
  function place() {
    if (!key || !photo) return
    const [x0, y0, x1, y1] = onPage()
    Object.assign(key.style, { left: x0.toFixed(1) + 'px', top: y0.toFixed(1) + 'px', width: (x1 - x0).toFixed(1) + 'px', height: (y1 - y0).toFixed(1) + 'px' })
  }

  // every frame (stage.js): the photo's light breathes and rises when pointed at, and the frame leans off the wall
  const pivot = new THREE.Matrix4(), turn = new THREE.Matrix4(), back = new THREE.Matrix4(), m4 = new THREE.Matrix4()
  let leaned = -1
  function update(dt) {
    time += dt
    if (!photo) return
    const h = rec ? rec.hover.x : 0
    photo.glowK.value = 1 + 0.05 * Math.sin((time * Math.PI * 2) / BREATH) + 0.4 * h
    photo.lift.value = h
    if (Math.abs(h - leaned) > 1e-4) {                              // about its foot: the top comes off the wall toward the eye
      leaned = h
      const py = -photo.size[1] / 2
      m4.copy(photo.rest).multiply(pivot.makeTranslation(0, py, OFF)).multiply(turn.makeRotationX(TILT * h)).multiply(back.makeTranslation(0, -py, -OFF))
      m4.decompose(photo.node.position, photo.node.quaternion, photo.node.scale)
    }
    if (rec && things.hot === rec && usable()) { tipT += dt; if (!tipShown && tipT > 0.35) { showTip(); tipShown = true } } else if (!(key && document.activeElement === key)) { tipT = 0; tipShown = false }
    if (key && document.activeElement === key) place()
  }

  const ready = Promise.all(loads).then(() => { for (const p of made) { p.node.visible = true; p.patch.visible = true } }).catch(() => {})      // a picture that never came: the wall stays bare
  const api = {
    group, patches, pieces: made, record: rec, ready, update,
    set visible(v) { group.visible = patches.visible = v },
    dispose() { for (const [t, type, fn, opt] of listeners) t.removeEventListener(type, fn, opt); if (key) key.remove(); if (current === api) current = null },
  }
  current = api
  window.__r3dWall = api                                         // for site/tools checks only
  return api
}
