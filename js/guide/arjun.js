// STAND-IN: replaced by the final character art. Same API: createArjun() -> { el, pose, face, point, mouth, look, destroy }.
export function createArjun() {
  const el = document.createElement('div')
  el.className = 'ga'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = `<svg viewBox="0 0 100 160" style="height:var(--ga-h,150px);display:block;overflow:visible">
    <ellipse cx="50" cy="157" rx="24" ry="3" fill="rgba(0,0,0,.18)"/>
    <g class="ga-b"><rect x="30" y="80" width="40" height="52" rx="14" fill="#1d2a52"/><rect x="36" y="128" width="11" height="28" rx="5" fill="#2b2f3a"/><rect x="53" y="128" width="11" height="28" rx="5" fill="#2b2f3a"/>
    <g class="ga-arm" style="transform-box:fill-box;transform-origin:10% 10%"><rect x="64" y="84" width="30" height="10" rx="5" fill="#c58a5e"/></g>
    <circle cx="50" cy="48" r="32" fill="#c58a5e"/><path d="M18 44 C20 14 76 6 84 40 C70 26 46 22 30 40 Z" fill="#14100f"/>
    <circle cx="40" cy="52" r="3.4" fill="#1b1311"/><circle cx="62" cy="52" r="3.4" fill="#1b1311"/>
    <ellipse class="ga-m" cx="51" cy="66" rx="8" ry="2" fill="#5a1f1f"/></g></svg>`
  const arm = el.querySelector('.ga-arm'), m = el.querySelector('.ga-m')
  let deg = 0, dir = 1
  return {
    el,
    pose(name) { el.dataset.pose = name },
    face(d) { dir = d < 0 ? -1 : 1; el.style.transform = dir < 0 ? 'scaleX(-1)' : '' },
    point(d) { deg = d; arm.style.transform = `rotate(${-d}deg)` },
    mouth(v) { m.setAttribute('ry', (2 + 6 * Math.max(0, Math.min(1, v))).toFixed(2)) },
    look() {},
    destroy() { el.remove() },
  }
}
