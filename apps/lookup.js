'use strict'
// AI Arjun: a lookup over Arjun's own notes. Not a chatbot, no model, no network.
//
//   AIARJUN.ask("What is AERIS?") -> { kind, title, overview[], facts[], tags[], links[], more[], related[], sources[], disclosure }
//
// Where the words come from (gen/data.js and gen/engine.js are generated from these files, never typed by hand):
//   projects.js          a project's title, description, meta line, tags and links
//   TrackRecordRow.jsx   the results and their links
//   profile.js           the profile links (GitHub, Medium, LinkedIn, email)
//   aiArjun.js           his rule engine: every other answer, the privacy deflections, the "I don't know" path
// Rules it keeps:
//   1. It only ever returns sentences that are already in those files.
//   2. A link is shown only if it is in the data. A project with no repo link gets no repo link.
//   3. AERIS never gets a video link, whatever the data says (LINK_RULES below).
//   4. If nothing matches it says NOT_FOUND and offers the nearest thing it does know.
//   5. Every answer carries DISCLOSURE.
;(function (root) {
  const DISCLOSURE = "A lookup over Arjun's own notes, not a general chatbot."
  const NOT_FOUND = "I don't have that in my notes."
  // kinds of link that must never be shown for a project, even if someone adds one to the data
  const LINK_RULES = { aeris: { never: ['video'] } }
  const VIDEO_HREF = /youtube\.com|youtu\.be|vimeo\.com|\.mp4(\?|$)|\.webm(\?|$)/i
  // his engine's topic ids -> project ids in projects.js
  const ENGINE_TO_PROJECT = { aeris: 'aeris', secondlook: 'second-look', ghostbus: 'ghostbus', memproject: 'mem', folio: 'folio', shaderoute: 'shade-route', debate: 'explainers', battery: 'battery-framework' }
  // names people use that are not the title in projects.js (both are written in that project's own entry)
  const EXTRA_ALIASES = { explainers: ['debate club'], 'battery-framework': ['battery framework'] }
  // the engine's own lead-ins when it is reaching: those answers are treated as "not in my notes, nearest is ..."
  const REACHING = [
    'Closest thing I can actually speak to: ',
    "Not totally sure what you're asking, but here's my best match. ",
    "Part of that I don't have anything on, so I won't guess. What I can tell you: ",
    "Hmm, that's not something I've said or put on this site, so don't take it as fact. What I have actually said: ",
  ]
  const PRIVATE_TOPICS = new Set(['age', 'personal'])
  const RECORD_WORDS = /\b(results?|track record|awards?|placements?|achievements?|wins?|won|trophies|prizes?)\b/
  const RECORD_ONLY = new Set('results result track record awards award placements placement achievements achievement wins win won prizes prize trophies hackathon hackathons competition competitions so far any have has he his all list got get anything ever'.split(' '))
  const STOP = new Set('a an the and or but of to for in on at by with from as is are was were be been am do does did you your i me my we it its this that what whats which who when where how why can could would should tell show give about into project projects arjun arjuns'.split(' '))

  const norm = (s) => (s || '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 0; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return d[a.length][b.length]
  }

  function make(DATA, ENGINE) {
    const SITE = DATA.site
    const byId = Object.fromEntries(DATA.projects.map((p) => [p.id, p]))
    const abs = (href) => (/^(https?:|mailto:)/.test(href) ? href : SITE + (href.startsWith('/') ? '' : '/') + href)
    const show = (href) => abs(href).replace(/^https?:\/\//, '').replace(/^mailto:/, '').replace(/\/$/, '')

    // ---- project names -------------------------------------------------------------------------
    const ALIASES = []
    for (const p of DATA.projects) {
      const names = new Set([norm(p.title), norm(p.title).replace(/^the /, ''), norm(p.id.replace(/-/g, ' ')), ...(EXTRA_ALIASES[p.id] || [])])
      for (const n of [...names]) if (n.includes(' ')) names.add(n.replace(/ /g, ''))
      for (const n of names) if (n) ALIASES.push({ name: n, id: p.id })
    }
    ALIASES.sort((a, b) => b.name.length - a.name.length)   // "second reader" before "second look" before "mem"
    function findProjects(q) {
      const padded = ' ' + q + ' ', tokens = q.split(' '), hits = []
      for (const a of ALIASES) {
        let at = padded.indexOf(' ' + a.name + ' ')
        if (at < 0 && !a.name.includes(' ') && a.name.length >= 5) {            // one typo allowed in a long single word
          const t = tokens.find((w) => w.length >= 5 && lev(w, a.name) <= 1)
          if (t) at = padded.indexOf(' ' + t + ' ')
        }
        if (at >= 0 && !hits.some((h) => h.id === a.id)) hits.push({ id: a.id, at })
      }
      return hits.sort((a, b) => a.at - b.at).map((h) => byId[h.id])
    }

    // ---- links ---------------------------------------------------------------------------------
    const KIND_LABEL = { live: 'Live', code: 'Code', video: 'Film', store: 'Store', mail: 'Email', article: 'Article', profile: 'Profile' }
    const link = (kind, label, href, from) => ({ kind, kindLabel: KIND_LABEL[kind] || kind, label, href: abs(href), shown: show(href), from })
    function projectLinks(p) {
      const never = (LINK_RULES[p.id] || {}).never || []
      return (p.links || [])
        .filter((l) => !never.includes(l.kind) && !(never.includes('video') && VIDEO_HREF.test(l.href)))
        .map((l) => link(l.kind, l.label, l.href, 'projects.js'))
    }
    const P = DATA.profile.links
    const profileLinks = {
      github: () => link('code', 'GitHub profile', P.github, 'profile.js'),
      medium: () => link('article', 'Writing on Medium', P.medium, 'profile.js'),
      linkedin: () => link('profile', 'LinkedIn', P.linkedin, 'profile.js'),
      email: () => link('mail', 'Email Arjun', 'mailto:' + P.email, 'profile.js'),
      site: () => link('live', 'Portfolio', SITE + '/', 'vite.config.js'),
    }
    const rec = Object.fromEntries(DATA.record.map((r) => [r.id, r]))
    const recordLink = (r) => (r.href ? link(VIDEO_HREF.test(r.href) ? 'video' : 'article', r.title + ': ' + (r.cta || 'Open').toLowerCase(), r.href, 'TrackRecordRow.jsx') : null)
    // which links go with which of his engine's topics (every href comes from the data)
    const TOPIC_LINKS = {
      contact: () => [profileLinks.email(), profileLinks.linkedin(), profileLinks.github()],
      hirewhy: () => [profileLinks.email(), profileLinks.site()],
      writing: () => [recordLink(rec.medium), profileLinks.medium()],
      samsung: () => [recordLink(rec.samsung), ...projectLinks(byId['battery-framework']).filter((l) => l.kind === 'live')],
      hackathons: () => [rec.peddiehacks, rec.rlchacks, rec.oregonhacks].map(recordLink),
      projects: () => [profileLinks.site(), profileLinks.github()],
      thissite: () => [profileLinks.site(), profileLinks.github()],
    }

    const questionFor = (p) => 'What is ' + p.title + '?'
    const related = (skipId) => {
      const out = DATA.projects.filter((p) => p.id !== skipId).slice(0, 3).map(questionFor)
      for (const s of ENGINE.SUGGESTIONS) if (out.length < 5 && !out.includes(s) && !(skipId === 'aeris' && /aeris/i.test(s))) out.push(s)
      return out
    }
    const base = (query) => ({ query, disclosure: DISCLOSURE, overview: [], facts: [], tags: [], links: [], more: [], related: [], sources: [] })

    function projectAnswer(query, p, others) {
      const r = base(query)
      r.kind = 'project'; r.id = p.id; r.title = p.title; r.visual = p.visual || null
      r.overview = [p.description]
      r.facts = p.meta.split(' · ').map((s) => s.trim()).filter(Boolean)
      r.tags = p.tags.slice()
      r.links = projectLinks(p)
      r.linkNote = r.links.length === 1 ? 'That is the only link in his notes for ' + p.title + '.' : r.links.length === 0 ? 'There is no link in his notes for ' + p.title + '.' : ''
      r.moreLinks = [profileLinks.github(), profileLinks.medium()]
      r.sources = ['projects.js']
      const topicId = Object.keys(ENGINE_TO_PROJECT).find((k) => ENGINE_TO_PROJECT[k] === p.id)
      const topic = topicId && ENGINE.topics.find((t) => t.id === topicId)
      if (topic) { r.more = [topic.a].concat(topic.more ? [topic.more] : []); r.sources.push('aiArjun.js') }   // "in his words", shown on request
      r.related = (others || []).map(questionFor).concat(related(p.id)).slice(0, 5)
      return r
    }
    function recordAnswer(query, lead) {
      const r = base(query)
      r.kind = 'record'; r.title = 'Results'
      // his engine's sentence, then any result he added since (a `line` in data_additions.json: his own words, first person)
      r.overview = lead ? [lead].concat(DATA.record.filter((x) => x.line).map((x) => x.line)) : []
      r.facts = DATA.record.filter((x) => x.id !== 'medium').map((x) => x.title + ': ' + x.summary + (x.project ? ' (' + x.project + ')' : ''))
      r.links = DATA.record.map(recordLink).filter(Boolean)
      r.sources = ['TrackRecordRow.jsx'].concat(lead ? ['aiArjun.js'] : [])
      r.related = related()
      return r
    }
    function nearest(q) {
      const words = q.split(' ').filter((w) => w.length >= 4 && !STOP.has(w))
      let best = null, score = 0
      for (const p of DATA.projects) {
        const text = ' ' + norm([p.title, p.meta, p.tags.join(' '), p.description].join(' ')) + ' '
        const s = words.filter((w) => text.includes(' ' + w + ' ')).length
        if (s > score) { best = p; score = s }
      }
      return best
    }
    function unknown(query, q, near) {
      const r = base(query)
      r.kind = 'unknown'; r.title = NOT_FOUND
      const p = nearest(q)
      if (near) { r.overview = ['The nearest thing I do know: ' + near]; r.sources = ['aiArjun.js'] }
      else if (p) { r.overview = ['The nearest thing I do know is ' + p.title + ': ' + p.description]; r.links = projectLinks(p); r.sources = ['projects.js'] }
      else r.overview = ['I only know what Arjun has written down: his projects, his results, his skills and tools, and how to reach him.']
      r.related = (p && !near ? [questionFor(p)] : []).concat(related(p && p.id)).slice(0, 5)
      return r
    }

    return function ask(query) {
      query = String(query == null ? '' : query).trim()
      const q = norm(query)
      if (!q) { const r = base(query); r.kind = 'empty'; r.title = 'Ask about Arjun'; r.overview = ['Type a question, for example "What is AERIS?"']; r.related = related(); return r }
      const eng = ENGINE.ask(query)

      // 1. privacy wins over everything: his engine's own deflection, and nothing else
      if (PRIVATE_TOPICS.has(eng.intent)) {
        const r = base(query); r.kind = 'private'; r.title = 'Kept private'; r.overview = [eng.text]; r.links = [profileLinks.email()]; r.sources = ['aiArjun.js']; r.related = related(); return r
      }
      // 2. a project named in the question: answered from projects.js
      const named = findProjects(q)
      if (named.length) return projectAnswer(query, named[0], named.slice(1))
      // 3. the results: only when the question is about nothing else ("who won the world cup" is not about him)
      const reach = REACHING.find((l) => eng.text.startsWith(l))
      const sure = eng.intent && !reach
      const recordOnly = RECORD_WORDS.test(q) && q.split(' ').every((w) => STOP.has(w) || RECORD_ONLY.has(w))
      if (recordOnly || (sure && eng.intent === 'hackathons')) return recordAnswer(query, sure && (eng.intent === 'samsung' || eng.intent === 'hackathons') ? eng.text : '')
      // 4. a plain hello: his engine's own greeting
      if (eng.text === ENGINE.leads.GREETING_REPLY) { const r = base(query); r.kind = 'greeting'; r.title = 'Hello'; r.overview = [eng.text]; r.sources = ['aiArjun.js']; r.related = related(); return r }
      //    nothing in his notes (his engine said so, or was only reaching)
      if (!eng.intent) return unknown(query, q, '')
      if (reach) return unknown(query, q, eng.text.slice(reach.length))
      // 5. one of his engine's topics that is really a project
      if (ENGINE_TO_PROJECT[eng.intent] && byId[ENGINE_TO_PROJECT[eng.intent]]) return projectAnswer(query, byId[ENGINE_TO_PROJECT[eng.intent]], [])
      // 6. any other topic: his engine's own sentence
      const r = base(query)
      r.kind = 'topic'; r.id = eng.intent; r.title = query.replace(/^./, (c) => c.toUpperCase())
      r.overview = [eng.text]
      const topic = ENGINE.topics.find((t) => t.id === eng.intent)
      if (topic && topic.more && topic.more !== eng.text) r.more = [topic.more]
      r.links = (TOPIC_LINKS[eng.intent] ? TOPIC_LINKS[eng.intent]() : []).filter(Boolean)
      r.sources = ['aiArjun.js']
      r.related = related()
      return r
    }
  }

  const api = { make, DISCLOSURE, NOT_FOUND, LINK_RULES }
  if (root.DATA && root.ARJUN_ENGINE) api.ask = make(root.DATA, root.ARJUN_ENGINE)
  root.AIARJUN = api
})(typeof window !== 'undefined' ? window : globalThis)
