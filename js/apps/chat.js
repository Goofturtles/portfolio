// Contact: WhatsApp's layout, closely (film/SPEC.md "Contact is WhatsApp's layout"). References, with the measurements
// in film/ref/ui/board/INDEX.md "chat": board/chat/01-whatsapp-light-conversation.jpg (rail, list, header, notice,
// bubbles, composer), 03 (the centred date chip), 04 and 05 (dark list, selected row, composer).
// Anatomy: the icon rail; the chat list (title, search field, filter chips, rows with a round picture, the name, the
// last message and its time); the conversation (header with a status line, the plain ground in WhatsApp's own colour,
// incoming bubbles on the left and the visitor's own on the right, the tail on the first of a run, the time inside
// each bubble and a tick on outgoing ones, the centred date chip and notice); the composer whose mic becomes Send.
// Never WhatsApp's name, logo or doodle wallpaper.
// It is honest that it is not live chat: Arjun's bubbles are his own words from his notes (the lookup's answers to
// "Who is Arjun?" and "How can I contact you?"), the times are the visitor's own clock when each bubble appeared,
// nothing says "online", and a typed message is only sent when the visitor presses "Send as email", which opens their
// own email app with the text filled in.
import { el, reduced, wait } from '../config.js'
import { line } from '../icons.js'
import { esc, host, FACE } from './common.js'

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function mount(box, ctx) {
  const P = window.DATA.profile, L = P.links, ask = window.AIARJUN.ask
  const words = (q) => { const r = ask(q); return r.kind === 'unknown' ? [] : r.overview }
  const face = `<span class="ct-face" aria-hidden="true">${FACE}</span>`      // his own photo
  const CHATS = [{ id: 'email', name: P.name, pic: face, sub: L.email, says: [...words('Who is Arjun?'), ...words('How can I contact you?')], fine: P.privacyNote, write: true },
    ...[['linkedin', 'LinkedIn', L.linkedin], ['github', 'GitHub', L.github], ['medium', 'Medium', L.medium], ['youtube', 'YouTube', 'https://www.youtube.com/@AER-S']].map(([id, name, href]) => ({ id, name, pic: PIX(id, 48), sub: host(href), href }))]
  const root = box.appendChild(el('div', 'ct'))
  root.innerHTML = `<nav class="ct-rail" aria-label="Sections"><button type="button" class="on" data-rail="chats" aria-label="Chats" title="Chats">${line('chats', 24)}</button>` +
    `<a href="mailto:${esc(L.email)}" aria-label="Write an email to Arjun" title="Write an email to Arjun">${line('mail24', 24)}</a><i></i><button type="button" data-rail="about" aria-label="About Arjun" title="About Arjun">${face}</button></nav>` +
    `<aside class="ct-chats"><h3>Chats</h3><label class="ct-find">${line('search16', 16)}<input type="search" autocomplete="off" spellcheck="false" placeholder="Search" aria-label="Search chats"></label>` +
    `<div class="ct-chips" role="group" aria-label="Filter chats">${[['all', 'All'], ['email', 'Email'], ['links', 'Links']].map(([id, n], i) => `<button type="button" data-chip="${id}" aria-pressed="${!i}">${n}</button>`).join('')}</div>` +
    `<div class="ct-rows" role="list">${CHATS.map((c, i) => `<button type="button" role="listitem" data-chat="${i}" style="--i:${i}"><span class="ct-av">${c.pic}</span><span class="ct-rw"><span><b>${esc(c.name)}</b><time></time></span><em>${esc(c.sub)}</em></span></button>`).join('')}</div></aside>` +
    `<section class="ct-talk" aria-label="Conversation"><header><button type="button" class="ct-back" aria-label="Back to chats">${line('back24', 24)}</button><span class="ct-av"></span><span class="ct-who"><b></b><em></em></span></header>` +
    `<div class="ct-logs"></div><div class="ct-foot"></div></section>`
  const $ = (s) => root.querySelector(s), logs = $('.ct-logs'), foot = $('.ct-foot'), rows = [...root.querySelectorAll('[data-chat]')]
  const made = new Map()                                           // chat -> its log: a conversation keeps its bubbles, and their times
  let cur = -1

  function add(log, cls, html, i) {
    const run = /him|me/.test(cls) && !(log.lastElementChild && log.lastElementChild.classList.contains(cls.split(' ')[0])) ? ' first' : ''
    const b = log.appendChild(el('div', 'ct-b ' + cls + run, html))
    log.scrollTop = log.scrollHeight
    if (i != null && /him|me/.test(cls) && !/typing/.test(cls)) { rows[i].querySelector('time').textContent = now(); rows[i].querySelector('em').textContent = b.querySelector('.ct-tx') ? b.querySelector('.ct-tx').textContent : CHATS[i].sub }
    return b
  }
  const said = (text) => `<span class="ct-tx">${text}</span><small><time>${now()}</time></small>`
  // his bubbles arrive one at a time behind the typing dots, once; after that they are simply there
  async function play(c, i, log) {
    add(log, 'sys', `${line('lock', 12)}Not live chat. Arjun's words here are from his own notes, and sending opens your email app.`)
    add(log, 'day', 'Today')
    if (c.href) { add(log, 'him card', `<a href="${esc(c.href)}" target="_blank" rel="noopener">${PIX(c.id, 40)}<span><b>${esc(c.name)}</b><i>${esc(c.sub)}</i></span>${line('go', 16)}</a><small><time>${now()}</time></small>`); return }
    const slow = !!log.offsetParent && !reduced()                  // on a phone the conversation is not on screen until its chat is tapped
    for (const s of c.says) {
      if (slow) { const dots = add(log, 'him typing', '<i></i><i></i><i></i>'); await wait(650 + Math.min(900, s.length * 6)); dots.remove(); if (!log.isConnected) return }
      add(log, 'him', said(esc(s)), i)
    }
    if (c.fine) add(log, 'sys', esc(c.fine))
  }
  function open(n, show = true) {
    const c = CHATS[n]
    cur = n
    for (const b of rows) b.toggleAttribute('aria-current', +b.dataset.chat === n)
    $('.ct-talk header .ct-av').innerHTML = c.pic; $('.ct-who b').textContent = c.name
    $('.ct-who em').innerHTML = c.write ? '<span>Not live chat</span><span>Sending opens your email app</span>' : `<span>${esc(c.sub)}</span>`
    if (show) root.classList.add('open')
    for (const l of logs.children) l.hidden = true
    let log = made.get(n)
    if (!log) { log = logs.appendChild(el('div', 'ct-log')); log.tabIndex = 0; made.set(n, log); if (show || !!logs.offsetParent) play(c, n, log); else made.delete(n), log.remove() }
    else log.hidden = false
    foot.innerHTML = c.write ? `<form class="ct-in"><textarea rows="1" aria-label="Your message to Arjun" placeholder="Type a message"></textarea><button type="submit" aria-label="Type a message first" title="Type a message first">${line('mic', 24)}${line('send24', 24)}</button></form>`
      : `<a class="wbtn ct-open" href="${esc(c.href)}" target="_blank" rel="noopener">Open ${esc(c.name)}${line('go', 16)}</a>`
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return
    if (b.dataset.chat) open(+b.dataset.chat)
    else if (b.classList.contains('ct-back')) { root.classList.remove('open'); (root.querySelector('[data-chat][aria-current]') || rows[0]).focus({ preventScroll: true }) }
    else if (b.dataset.rail === 'about') ctx.act('about')
    else if (b.dataset.chip) {
      for (const k of root.querySelectorAll('[data-chip]')) k.setAttribute('aria-pressed', k === b)
      rows.forEach((r, i) => { r.hidden = b.dataset.chip === 'email' ? !CHATS[i].write : b.dataset.chip === 'links' ? !!CHATS[i].write : false })
    } else if (b.classList.contains('ct-mail')) {
      const a = el('a'); a.href = `mailto:${L.email}?subject=${encodeURIComponent('Hello Arjun')}&body=${encodeURIComponent(b.dataset.text)}`
      a.click()                                                    // the visitor's own email app, with the message filled in
      b.closest('.ct-b').innerHTML = 'Your email app should have opened with this message. It is sent only when you press send there.'
    }
  })
  $('.ct-find input').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); rows.forEach((r, i) => { r.hidden = !!q && !(CHATS[i].name + ' ' + CHATS[i].sub).toLowerCase().includes(q) }) })
  foot.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches('textarea')) { e.preventDefault(); e.target.form.requestSubmit() } })
  foot.addEventListener('input', (e) => {
    const t = e.target, send = t.form.querySelector('button'), has = !!t.value.trim()
    t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'
    t.form.classList.toggle('has', has); send.setAttribute('aria-label', has ? 'Send' : 'Type a message first'); send.title = has ? 'Send' : 'Type a message first'
  })
  foot.addEventListener('submit', (e) => {
    e.preventDefault()
    const box = e.target.querySelector('textarea'), text = box.value.trim(), log = made.get(cur)
    if (!text || !log) return box.focus()
    add(log, 'me', `<span class="ct-tx">${esc(text).replace(/\n/g, '<br>')}</span><small><time>${now()}</time>${line('tick', 16)}</small>`, cur)
    add(log, 'sys', `Not sent yet: this is not live chat. <button type="button" class="ct-mail">Send as email</button>`).querySelector('.ct-mail').dataset.text = text
    box.value = ''; box.style.height = 'auto'; e.target.classList.remove('has')
  })

  open(0, false)
  // the first conversation starts when it is first seen (a window shows it at once; a phone when its row is tapped)
  const seen = new IntersectionObserver((list) => { if (list.some((x) => x.isIntersecting) && !made.has(0) && cur === 0) open(0, false) })
  seen.observe(logs)
  return {
    title: 'Contact',
    show() {},
    focus() { (root.querySelector('.ct-in textarea') || rows[0]).focus({ preventScroll: true }) },
  }
}
