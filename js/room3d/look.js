// The room's look: one small shader per material kind of the contract. Reference: film/SPEC.md, "How the film's look
// survives being live" (the light is baked in Cycles into atlases, one set per theme, and drawn unlit through the
// second UV set, so the film's camera sees the Cycles picture), the film's own frames in film/ref/frames/P2/ for
// what the desk, the glass, the lamp and the screen do, and why.zero.university's "baked, not simulated"
// (webgl-story-template/docs/BREAKDOWN.md, section 7). Every shader writes the film's display values straight to
// the screen: there is no tone curve and no colour conversion after the atlas. A theme change is uMix going 0 to 1
// between two themes' atlases and panoramas.
import * as THREE from 'three'
import { retry } from '../config.js'

const VERT = `
precision highp float;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix, uMirrorVP;
in vec3 position; in vec3 normal; in vec2 uv; in vec2 uv1;
#ifdef INSTANCED
in mat4 instanceMatrix;
#endif
out vec2 vUv; out vec2 vLm; out vec3 vN; out vec3 vW; out vec4 vProj;
void main() {
  mat4 m = modelMatrix;
#ifdef INSTANCED
  m = m * instanceMatrix;
#endif
  vec4 w = m * vec4(position, 1.);
  vUv = uv; vLm = uv1; vW = w.xyz; vN = mat3(m) * normal;
  vProj = uMirrorVP * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

// what every kind shares: the baked light (or, until the bake exists, a plain sky-and-sun shade of the surface's own
// colour), the hover light, the fade of something the camera is about to fly through, and the room's panorama
const HEAD = `
precision highp float;
precision highp sampler2D;
uniform vec3 cameraPosition;
uniform sampler2D uLmA, uLmB, uEnvA, uEnvB, uMap;
uniform float uMix, uHover, uFade, uEnvYaw, uCut, uBloomPass, uSpill;
uniform vec3 uScrC, uScrN;
uniform vec2 uDepth;
uniform vec4 uBall;
uniform vec3 uLightDir, uColor, uSkyA, uSkyB, uSunA, uSunB, uSunDir, uLampPos, uLampA, uLampB;
in vec2 vUv; in vec2 vLm; in vec3 vN; in vec3 vW; in vec4 vProj;
out vec4 frag;
vec3 base(vec3 N) {
#ifdef UNBAKED
  vec3 c = uColor;
  #ifdef USE_MAP
  c *= texture(uMap, vUv).rgb;
  #endif
  vec3 L = uLampPos - vW;
  float d2 = dot(L, L);
  vec3 lamp = min(mix(uLampA, uLampB, uMix) * (.5 + .5 * max(dot(N, L * inversesqrt(d2)), 0.)) * .02 / (d2 + .02), vec3(.6));
  return c * (mix(uSkyA, uSkyB, uMix) * mix(.5, 1., N.y * .5 + .5) + mix(uSunA, uSunB, uMix) * max(dot(N, uSunDir), 0.) + lamp);
#else
  // the egg's own soft shadow on whatever is just under it: the bake leaves it out, because the egg rolls
  float under = uBall.y - uBall.w - vW.y;
  float blob = smoothstep(1.9, .25, length(vW.xz - uBall.xz) / uBall.w) * smoothstep(.08, .0, under) * step(1.1 * uBall.w, length(vW - uBall.xyz));      // not on the egg itself
  return mix(texture(uLmA, vLm).rgb, texture(uLmB, vLm).rgb, uMix) * (1. - .34 * blob);
#endif
}
vec3 env(vec3 d, float lod) {
  vec2 e = vec2(atan(d.x, -d.z) / 6.28318530718 + .5 + uEnvYaw, .5 - asin(clamp(d.y, -1., 1.)) / 3.14159265359);
  return mix(textureLod(uEnvA, e, lod).rgb, textureLod(uEnvB, e, lod).rgb, uMix);
}
vec3 hoverLight(vec3 c, vec3 N, vec3 V) {
  float nl = max(dot(N, uLightDir), 0.), rim = pow(1. - max(dot(N, V), 0.), 3.);
  c += uHover * ((.035 + .1 * nl) * mix(c, vec3(1., .97, .92), .45) + .04 * rim);      // pointed at: a gentle lift of its own light, no glare
  // the desktop on the laptop (js/laptop.js): the lit screen's own cool light on what is in front of it, falling off with distance
  if (uSpill > 0.) {
    vec3 d = vW - uScrC;
    float r2 = dot(d, d), ir = inversesqrt(r2), front = dot(d, uScrN) * ir;
    if (front > 0.) c += uSpill * c * vec3(.8, .88, 1.) * front * max(dot(N, -d * ir), 0.) * .016 / (r2 + .016);
  }
  return c;
}
// beside the colour goes how far away it is: the desk's mirror softens by it (x: metres x this) and the lens focuses
// by it (y: this / metres, because blur out of focus is linear in one over the distance)
float far() { float d = length(vW - cameraPosition); return uDepth.x > 0. ? clamp(d * uDepth.x, 0., 1.) : clamp(uDepth.y / max(d, .001), 0., 1.); }
void cut() {
#ifdef ALPHA_CUT
  if (texture(uMap, vUv).a < uCut) discard;
#endif
  if (uFade < .999 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) > uFade) discard;
}
#define FRAME vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vW);
`
const FRAG = {
  baked: `void main() { cut(); FRAME
  frag = vec4(hoverLight(base(N), N, V) * (1. - uBloomPass), far()); }`,

  // light atlas plus the room mirrored in the surface, as sharp as its roughness allows. The panorama has no laptop
  // in it, so the laptop's screen is found by the mirrored ray itself: the trackpad, the keys, the egg and the card
  // show the picture that is on the screen, where the panorama alone would show the bright wall behind it.
  gloss: `uniform float uRough, uF0, uMetal, uLit; uniform sampler2D uImg; uniform vec3 uScrR, uScrU; uniform vec2 uCoverQ, uOffQ;
void main() { cut(); FRAME
  float f = uF0 + (1. - uF0) * pow(1. - max(dot(N, V), 0.), 5.) * (1. - uRough) * (1. - .5 * uRough);
  vec3 R = reflect(-V, N), e = env(R, uRough * 7.);
  float dn = dot(R, uScrN);
  if (dn < -.001) {
    float t = dot(uScrC - vW, uScrN) / dn;
    vec3 h = vW + R * t - uScrC;
    vec2 q = vec2(dot(h, uScrR), dot(h, uScrU));
    float hit = step(0., t) * smoothstep(1.1, .9, max(abs(q.x), abs(q.y)));
    e = mix(e, textureLod(uImg, (q * vec2(.5, -.5) + .5) * uCoverQ + uOffQ, 2. + uRough * 6.).rgb * uLit, hit);
  }
  vec3 c = base(N) + e * f * (1. - .7 * uRough) * mix(vec3(1.), uColor, uMetal);
  frag = vec4(hoverLight(c, N, V) * (1. - uBloomPass), far()); }`,

  // the desk top: a real mirror image of the room (mirror.js draws it). How much atlas and how much mirror is the mix
  // Blender measured against its own Cycles frame at each theme's home view, in linear light (room3d.json mirror.fit),
  // carried to other angles by Fresnel. The image is soft the way lacquer is: sharp where a thing meets the desk and
  // drawn out downward the further the mirrored thing is behind the surface (the mirror's picture carries that distance).
  // Faces that are not the flat top (the rim) mirror the panorama instead.
  mirror: `uniform sampler2D uMirror; uniform vec2 uTexel, uFitA, uFitB; uniform vec4 uLacquer; uniform float uSpread;
vec3 lin(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
// one sample of the mirror's picture for a place whose own image is d metres behind the desk: a thing much nearer
// the surface than that (a card lying on the desk beside the image of the far wall) is sharp, and does not leak in
vec4 tap(vec2 p, float lod, float here, float d, float w) {
  vec4 c = textureLod(uMirror, p, lod);
  w *= clamp((c.a * 8. - here + .03) / (d + .03), .02, 1.);
  return vec4(c.rgb * w, w);
}
vec3 smear(vec2 p, float r, float here, float d) {
  float s = r * .5, lod = log2(max(s, 1.));
  vec2 o = vec2(0., uTexel.y * s);
  vec4 c = tap(p, lod, here, d, .2270)
    + tap(p + o, lod, here, d, .1945) + tap(p - o, lod, here, d, .1945) + tap(p + o * 2., lod, here, d, .1216) + tap(p - o * 2., lod, here, d, .1216)
    + tap(p + o * 3., lod, here, d, .0541) + tap(p - o * 3., lod, here, d, .0541) + tap(p + o * 4., lod, here, d, .0163) + tap(p - o * 4., lod, here, d, .0163);
  return c.rgb / c.a;
}
void main() { FRAME
  vec2 p = vProj.xy / vProj.w * .5 + .5;
  float top = smoothstep(.7, .95, N.y), x = pow(1. - max(dot(N, V), 0.), 5.);
  vec2 fit = mix(uFitA, uFitB, uMix);
  float wm = min(1., fit.y * (.33 + .67 * x) / .48) * uLacquer.w,      // .48: Schlick at 75 degrees, the middle of the desk from a home camera
    wa = min(1., fit.x * (1. - wm) / (1. - fit.y));
  float here = length(vW - cameraPosition), there = textureLod(uMirror, p, 0.).a * 8.;
  float d = max(there - here, 0.), r = clamp(uLacquer.x * uLacquer.y * d / max(there, .2) * uSpread, 0., 28.);
  vec3 img = mix(env(reflect(-V, N), 2.5), mix(smear(p, r, here, d), smear(p, r * .22, here, d), uLacquer.z), top);
  vec3 c = pow(lin(base(N)) * wa + lin(img) * wm, vec3(1. / 2.2));
  frag = vec4(c * (1. - uBloomPass), far()); }`,

  // convincing but cheap: what is really behind the glass shows through it, under a soft wash of the room bent by
  // the glass (the panorama far along the refracted ray: a tint, not a picture, because the panorama is the room seen
  // from the middle of the desk and would put the wrong wall behind a tumbler), and its mirror image, strongest at
  // the edges, so the flutes draw their own streaks and they move as the eye does. A liquid is a colour filter: it
  // multiplies what is really behind it (its material blends that way; front and back each take half), so the vase is
  // magenta against the day's white wall and violet against the blue one, as in Cycles. uSpan: the liquid's foot and
  // top, and how strong its colour is (0 = plain glass).
  glass: `uniform vec3 uTintLo, uTintHi, uSpan; uniform float uIor;
void main() { FRAME
  float f = .04 + .96 * pow(1. - abs(dot(N, V)), 5.);
  vec3 through = env(refract(-V, N, 1. / uIor), 4.5), shine = env(reflect(-V, N), 1.5) * f, c;
  float a;
  if (uSpan.z > 0.) {
    frag = vec4(mix(vec3(1.), sqrt(mix(uTintLo, uTintHi, smoothstep(uSpan.x, uSpan.y, vW.y))), uSpan.z), 1.);
    return;
  } else {
    a = clamp(.05 + .6 * f, 0., 1.);
    c = through * uColor * a * .7 + shine * .55;
  }
  c += uHover * (.04 + .1 * f);
  frag = vec4(c * (1. - uBloomPass), a); }`,

  // a lamp shade, the tube light, the ring: the baked surface lifted by its own light; alone in the bloom's picture
  glow: `uniform vec3 uGlowColor; uniform float uGlow;
void main() { cut(); FRAME
  vec3 g = uGlowColor * uGlow;
#ifdef UNBAKED
  g *= vec3(.84, .83, 1.);                                                        // until the atlas brings the shade's own colour: the film's lavender
#endif
  vec3 c = hoverLight(base(N), N, V);
  c += g * (.34 + .16 * pow(max(dot(N, V), 0.), 2.)) * (1. - min(c, vec3(1.)));      // lifted toward its own light, never past white
  frag = vec4(mix(c, c * min(uGlow, 1.2) * mix(vec3(1.), g / max(uGlow, .001), .5), uBloomPass), far()); }`,

  // the laptop's screen: the site's own desktop wallpaper, moving exactly as js/bloom.js moves it, so the desktop
  // that takes over at the end of the dive is the same picture in the same place
  // Round it sits the lid's black glass edge with rounded corners, as on the film's laptop; the edge closes as the
  // camera dives, so the picture alone fills the view at the end.
  screen: `uniform sampler2D uImg, uFold; uniform vec2 uCoverQ, uOffQ, uCoverV, uOffV, uVis, uScrSize, uDesk; uniform float uTurn, uDive, uLit, uWake; uniform vec4 uPanel[5], uPanelK[5];
const float TAU = 6.28318530718;
float box(vec2 p, vec2 half_, float r) { vec2 d = abs(p) - (half_ - r); return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
void main() { FRAME
  float open = 1. - uDive;
  vec2 pm = (vUv - .5) * uScrSize, glass = uScrSize * .5 - .0072 * open;      // metres from the middle of the lid; half the lit part
  if (open > .001 && box(pm, uScrSize * .5, .009 * open) > 0.) discard;
  float edge = box(pm, glass, .0045 * open + .00001), lit = 1. - smoothstep(-.5, .5, edge / max(fwidth(edge), 1e-6));
  vec2 a = (pm / (glass * 2.) + .5) * uCoverQ + uOffQ, b = ((vUv - .5) / uVis + .5) * uCoverV + uOffV;
  vec2 q = mix(a, b, uDive);
  vec3 m = texture(uFold, q).rgb;
  vec2 fold = m.rg * 2. - 1.;
  float t = TAU * uTurn;
  float s1 = sin(t + TAU * (q.x * .9 + q.y * .6)), s2 = sin(2. * t + TAU * (q.y * 1.3 - q.x * .5) + 1.7), s3 = sin(t - TAU * (q.x * 1.6 + q.y * .2) + 4.1);
  vec2 d = (fold * (.0052 * s1 + .00234 * s2) + vec2(.0022 * s3, .00264 * s1 * s3)) * m.b;
  vec3 c = texture(uImg, q + d).rgb;
  // The desktop on the laptop (js/laptop.js) is glass: under each of its panels (uPanel: its box in the desktop's own
  // pixels; uPanelK: corner radius, how much it shows) the wallpaper is frosted (a wide soft sample from the smaller
  // mip levels, its colour lifted) and, in a band along the panel's edge, bent: drawn from a little beyond the edge, as
  // a thick glass edge pulls in what is just outside it. Here on the screen itself, so it costs nothing extra a frame.
  vec2 dp = (pm / (glass * 2.) + .5) * uDesk;
  float fr = 0., rim = 0.;
  vec2 bent = vec2(0.);
  for (int i = 0; i < 5; i++) {
    vec4 R = uPanel[i], K = uPanelK[i];
    if (K.y <= .001) continue;
    vec2 ctr = (R.xy + R.zw) * .5, hs = (R.zw - R.xy) * .5, o = dp - ctr;
    float sd = box(o, hs, K.x);
    if (sd >= 0.) continue;
    vec2 n = normalize(vec2(box(o + vec2(1., 0.), hs, K.x) - box(o - vec2(1., 0.), hs, K.x), box(o + vec2(0., 1.), hs, K.x) - box(o - vec2(0., 1.), hs, K.x)) + 1e-5);
    rim = pow(max(0., 1. + sd / 24.), 2.);                        // 1 at the edge, 0 from 24 px in
    bent = n * 18. * rim;
    fr = K.y;
  }
  if (fr > 0.) {
    // the rim is thick clear glass: there the picture is sharper and bent; inside it is frosted
    float lod = mix(4.6, 1.4, rim);
    vec2 qb = q + d + bent / uDesk * uCoverQ, s = mix(7., 1.5, rim) / uDesk * uCoverQ;
    vec3 f = (textureLod(uImg, qb + s * vec2(1., .4), lod) + textureLod(uImg, qb + s * vec2(-.4, 1.), lod) + textureLod(uImg, qb - s * vec2(1., .4), lod) + textureLod(uImg, qb - s * vec2(-.4, 1.), lod)).rgb * .25;
    f = mix(vec3(dot(f, vec3(.2126, .7152, .0722))), f, 1.6) * (1.05 + .12 * rim);
    c = mix(c, f, fr);
  }
  float l = dot(c, vec3(.2126, .7152, .0722));
  c *= 1. + .075 * m.b * sin(t + TAU * (l * 1.4 + q.x * .7 - q.y * .4));
  float f = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  c = mix(vec3(.012, .012, .016), c * mix(uLit, 1., max(uDive, uWake)), lit) + env(reflect(-V, N), 2.5) * f * .55 * open + uHover * .05 * open;
  frag = vec4(mix(c, c * .16 * lit, uBloomPass), far()); }`,
}

const display = (color) => { const c = color.clone().convertLinearToSRGB(); return new THREE.Vector3(c.r, c.g, c.b) }      // a glTF colour as the values the screen shows
const hex = (h) => {                                              // a background colour from the json, as display values
  if (Array.isArray(h)) return new THREE.Vector3(...h.slice(0, 3).map((x) => (Math.max(...h) > 1 ? x / 255 : x)))
  const s = String(h).replace('#', '').padEnd(6, '0')
  return new THREE.Vector3(parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255)
}

// How strongly something glows in a theme: the json's value under one of its names (material, mesh, node), else the
// level the json gives by what it is ("lamp_level" for anything with "lamp" in its name), else dark.
function level(theme, names) {
  for (const n of names) if (theme.glow[n] != null) return +theme.glow[n]
  for (const [key, v] of Object.entries(theme.levels)) { const what = key.split('_')[0].toLowerCase(); if (names.some((n) => String(n).toLowerCase().includes(what))) return Math.min(1.5, +v) }
  return 0
}

// A liquid whose colour the export does not carry (in Blender it is a procedural gradient): the vase as Cycles draws
// it in this room (film/renders/P2/room3d-ref/cycles_day.png), violet at the foot going to magenta at the top, as display values. Any other liquid (ior 1.33) takes its glTF colour.
const LIQUIDS = { P2VaseLiquid: { lo: [0.56, 0.3, 0.76], hi: [0.86, 0.3, 0.55], solid: 1 } }

function pixel(r, g, b) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

export function createLook(renderer, contract, small) {
  const gl = renderer.getContext(), maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE), aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const size = small || maxTex < 4096 ? 2048 : 4096
  const grey = pixel(128, 128, 128), nAtlas = Math.max(1, ...Object.values(contract.themes).map((t) => t.atlases))
  // uniforms every material shares by reference
  const U = {
    uMix: { value: 0 }, uBloomPass: { value: 0 }, uBall: { value: new THREE.Vector4(0, -99, 0, 0.03) }, uDepth: { value: new THREE.Vector2(0, 0) }, uTurn: { value: 0 }, uDive: { value: 0 }, uWake: { value: 0 }, uSpill: { value: 0 }, uDesk: { value: new THREE.Vector2(1, 1) },
    uPanel: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, uPanelK: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, uEnvYaw: { value: contract.envYaw / 360 },
    uLightDir: { value: new THREE.Vector3(0.25, 0.8, 0.55).normalize() }, uSunDir: { value: new THREE.Vector3(0.55, 0.62, 0.56).normalize() },
    uEnvA: { value: grey }, uEnvB: { value: grey }, uSkyA: { value: new THREE.Vector3(1, 1, 1) }, uSkyB: { value: new THREE.Vector3(1, 1, 1) },
    uSunA: { value: new THREE.Vector3() }, uSunB: { value: new THREE.Vector3() },
    uMirror: { value: grey }, uMirrorVP: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    // the lacquer: its roughness, how far a rough mirror smears per metre behind it (set by eye against the Cycles frames), the share of the sharp coat, its strength
    uLacquer: { value: new THREE.Vector4(contract.mirror.rough, 0.3, 0.4, contract.mirror.strength) }, uFitA: { value: new THREE.Vector2(0.65, 0.58) }, uFitB: { value: new THREE.Vector2(0.65, 0.58) }, uSpread: { value: 1000 },
    uScrC: { value: new THREE.Vector3(0, -99, 0) }, uScrN: { value: new THREE.Vector3(0, 0, 1) }, uScrR: { value: new THREE.Vector3(1, 0, 0) }, uScrU: { value: new THREE.Vector3(0, 1, 0) }, uScrSize: { value: new THREE.Vector2(0.3, 0.2) },
    uLampPos: { value: new THREE.Vector3(0, 10, 0) }, uLampA: { value: new THREE.Vector3() }, uLampB: { value: new THREE.Vector3() },
    uImg: { value: grey }, uFold: { value: pixel(128, 128, 0) }, uLit: { value: 1 },
    uCoverQ: { value: new THREE.Vector2(1, 1) }, uOffQ: { value: new THREE.Vector2() }, uCoverV: { value: new THREE.Vector2(1, 1) }, uOffV: { value: new THREE.Vector2() }, uVis: { value: new THREE.Vector2(1, 1) },
  }
  const lmA = Array.from({ length: nAtlas }, () => ({ value: grey })), lmB = Array.from({ length: nAtlas }, () => ({ value: grey }))
  const still = { uHover: { value: 0 }, uFade: { value: 1 } }       // for everything that is not an object
  const loaded = new Map(), made = new Map(), glows = []
  let pair = [null, null]

  async function picture(src, { mips = true, wrap = false } = {}) {
    const blob = await retry(async (n) => { const r = await fetch(src + (n > 1 ? '?try=' + n : '')); if (!r.ok) throw new Error(src + ' ' + r.status); return r.blob() })
    let image
    try { image = await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) } catch (e) {
      image = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(blob) })
    }
    const t = new THREE.Texture(image)
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = mips
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = aniso
    if (wrap) t.wrapS = THREE.RepeatWrapping
    t.needsUpdate = true
    renderer.initTexture(t)                                    // uploaded now, not in the middle of a move
    return t
  }

  // a theme's atlases and panorama, decoded and on the graphics card before anything shows them
  function loadTheme(id) {
    if (!loaded.has(id)) {
      const t = contract.themes[id]
      const bg = hex(t.background), light = t.ui === 'light' || (bg.x + bg.y + bg.z) / 3 > 0.55
      const job = Promise.all([
        Promise.all(contract.baked ? Array.from({ length: t.atlases }, (_, n) => picture(t.atlas(n, size))) : []),
        t.env ? picture(t.env, { wrap: true }).catch(() => null) : null,
      ]).then(([lm, env]) => ({ id, lm, env: env || pixel(bg.x * 255, bg.y * 255, bg.z * 255), bg,
        sky: bg.clone().lerp(new THREE.Vector3(1, 1, 1), light ? 0.5 : 0.25).multiplyScalar(light ? 0.78 : 0.7), sun: light ? new THREE.Vector3(0.36, 0.34, 0.3) : bg.clone().multiplyScalar(0.5),
        lamp: new THREE.Vector3(0.81, 0.81, 1).multiplyScalar(1.6 * level(t, ['lamp'])) }))
      job.catch(() => loaded.delete(id))
      loaded.set(id, job)
    }
    return loaded.get(id)
  }
  // which two themes the room is between (both loaded), and how far
  async function setPair(a, b) {
    const [A, B] = await Promise.all([loadTheme(a), loadTheme(b)])
    pair = [A, B]
    for (let n = 0; n < nAtlas; n++) { lmA[n].value = A.lm[n] || A.lm[0] || grey; lmB[n].value = B.lm[n] || B.lm[0] || grey }
    U.uEnvA.value = A.env; U.uEnvB.value = B.env
    U.uFitA.value.set(...fitOf(a)); U.uFitB.value.set(...fitOf(b))
    U.uSkyA.value = A.sky; U.uSkyB.value = B.sky; U.uSunA.value = A.sun; U.uSunB.value = B.sun; U.uLampA.value = A.lamp; U.uLampB.value = B.lamp
    for (const g of glows) { g.a = g.of(contract.themes[a]); g.b = g.of(contract.themes[b]) }
    setMix(U.uMix.value)
    for (const [id, job] of loaded) if (id !== a && id !== b && small) { loaded.delete(id); job.then((t) => { t.lm.forEach((x) => x.dispose()); t.env.dispose() }) }      // a phone keeps two themes in memory, not four
  }
  function fitOf(id) { const f = (contract.mirror.fit || {})[id] || {}; return [f.atlas ?? 0.65, f.mirror ?? 0.58] }
  function setMix(k) {
    U.uMix.value = k
    for (const g of glows) g.u.value = g.a + (g.b - g.a) * k
    if (pair[0]) { const c = pair[0].bg.clone().lerp(pair[1].bg, k); renderer.setClearColor(new THREE.Color().setRGB(c.x, c.y, c.z, THREE.LinearSRGBColorSpace), 0) }      // alpha 0: where nothing is, is as far as can be (see far())
  }

  // the material for one mesh: its kind from the glb (extras.kind), the object's own hover and fade
  function dress(mesh, group = still, role = null) {
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const told = { ...(contract.materials[src.userData.src] || contract.materials[src.name] || {}), ...src.userData }      // the glb's extras, then the json's table by material name
    const kind = role || (FRAG[told.kind] ? told.kind : 'baked')
    const atlas = Math.min(nAtlas - 1, src.userData.atlas ?? mesh.userData.atlas ?? 0), inst = !!mesh.isInstancedMesh
    const key = [kind, src.uuid, atlas, inst, group === still ? 0 : group.id].join('|')
    if (!made.has(key)) {
      const cutout = !!src.map && (src.alphaTest > 0 || (src.transparent && kind !== 'glass'))
      const defines = {}
      if (!contract.baked) defines.UNBAKED = ''
      if (!contract.baked && src.map) defines.USE_MAP = ''
      if (cutout) defines.ALPHA_CUT = ''
      if (inst) defines.INSTANCED = ''
      if (src.map) { src.map.colorSpace = THREE.NoColorSpace; src.map.needsUpdate = true }
      const rough = told.rough ?? told.roughness ?? src.roughness ?? 0.4, metal = told.metallic ?? src.metalness ?? 0
      const u = { ...U, uLmA: lmA[atlas], uLmB: lmB[atlas], uHover: group.uHover, uFade: group.uFade, uMap: { value: src.map || grey }, uCut: { value: src.alphaTest || 0.5 },
        uColor: { value: display(src.color || new THREE.Color(1, 1, 1)) }, uRough: { value: rough }, uF0: { value: 0.04 + 0.76 * metal }, uMetal: { value: metal } }
      if (kind === 'glass') {
        const wet = LIQUIDS[told.src] || LIQUIDS[src.name] || (Math.abs((told.ior ?? 1.5) - 1.33) < 0.02 ? { lo: u.uColor.value.toArray(), hi: u.uColor.value.toArray(), solid: 1 } : null)
        const box = new THREE.Box3().setFromObject(mesh)
        u.uIor = { value: told.ior ?? 1.5 }
        u.uTintLo = { value: new THREE.Vector3(...(wet ? wet.lo : [1, 1, 1])) }; u.uTintHi = { value: new THREE.Vector3(...(wet ? wet.hi : [1, 1, 1])) }
        u.uSpan = { value: new THREE.Vector3(box.min.y, box.max.y, wet ? wet.solid : 0) }
        mesh.renderOrder = wet ? 1 : 2                           // the liquid first, then its glass over it
        if (wet) mesh.userData.filter = true
      }
      if (kind === 'glow') {
        const e = src.emissive && src.emissive.r + src.emissive.g + src.emissive.b > 0 ? src.emissive : src.color || new THREE.Color(1, 1, 1)
        u.uGlowColor = { value: display(e) }; u.uGlow = { value: 0 }
        const names = [told.src, src.name, mesh.name, mesh.parent && mesh.parent.name, group.id && 'obj_' + group.id, group.id].filter((n) => n != null)
        glows.push({ u: u.uGlow, a: 0, b: 0, of: (t) => level(t, names) })
      }
      const m = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: HEAD + FRAG[kind], uniforms: u, defines, side: src.side })
      if (kind === 'glass') {                                    // laid over what is behind it; the distance beside the colour stays that of what is behind
        m.transparent = true; m.depthWrite = false; m.side = THREE.DoubleSide
        m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -8      // a glass's base lies in the desk's own plane: drawn a hair nearer, so the two never fight over the same pixels
        m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor
        if (mesh.userData.filter) { m.blendSrc = THREE.DstColorFactor; m.blendDst = THREE.ZeroFactor }      // a liquid multiplies what is behind it
      }
      m.userData.kind = kind
      made.set(key, m)
    }
    mesh.material = made.get(key)
    mesh.userData.kind = kind
    return kind
  }

  // where the laptop's screen is now, for everything that mirrors it and for its own black edge
  function seeScreen(f) {
    U.uScrC.value.copy(f.center); U.uScrN.value.copy(f.normal); U.uScrSize.value.set(f.width, f.height)
    U.uScrR.value.copy(f.right).multiplyScalar(2 / f.width); U.uScrU.value.copy(f.up).multiplyScalar(2 / f.height)
  }

  return { U, size, loadTheme, setPair, setMix, dress, picture, seeScreen, seeBall: (centre, radius) => U.uBall.value.set(centre.x, centre.y, centre.z, radius), pair: () => pair, materials: () => [...made.values()] }
}
