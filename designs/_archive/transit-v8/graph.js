/* Kevin Metro · the knowledge graph
   Every place is a node. Two places are connected when their projects share a tag (what they are built
   with, or what kind of work they are), or when they are neighbours on a line. Nothing here is listed by
   hand: give a new project its `tags` in ../shared/content.js and it connects itself.
   Pure logic: no drawing. */

// how a shared tag is said. A tag without an entry reads "Both use <tag>".
const SAY = {
  'Snuggle Crew': 'Same brand: Snuggle Crew', Hackathon: 'Both built at hackathons', Healthcare: 'Both healthcare', 'Hong Kong': 'Both built for Hong Kong',
  China: 'Both built for China', 'Client work': 'Both client work', Founder: 'Founder work', YouTube: 'Both on YouTube', 'Tests & evals': 'Both have tests and evals',
  'In-app purchases': 'Both sell in-app purchases', 'Own tools': 'Both use my own tools', Websites: 'Both websites', 'Social video': 'Both social video',
  'AI-assisted production': 'Both AI-assisted production', 'WeChat mini program': 'Both WeChat mini programs', '3D modelling': 'Both use 3D modelling',
};
export const sayTag = (tag) => SAY[tag] || `Both use ${tag}`;

/* The Skills view: every tag, grouped the way the résumé groups skills. A tag not listed lands in Work. */
export const TAG_GROUPS = [
  ['Build', ['Next.js', 'TypeScript', 'Supabase', 'Cloudflare Workers', 'Expo', 'Swift', 'WeChat mini program', 'Tencent CloudBase', 'Websites', 'In-app purchases', 'Own tools']],
  ['AI', ['Anthropic API', 'Claude', 'Firecrawl', 'Tests & evals', 'AI-assisted production']],
  ['Media', ['Higgsfield', 'CapCut', 'YouTube', '3D modelling', 'Social video', 'Amazon KDP', 'Snuggle Crew']],
  ['Work', ['Founder', 'Client work', 'China', 'Hong Kong', 'Hackathon', 'Healthcare']],
];

export function buildGraph({ places, projById, net, lineName }) {
  const tagsOf = (d) => [...new Set((d.projects || []).flatMap((id) => (projById[id] && projById[id].tags) || []))];
  const T = Object.fromEntries(places.map((d) => [d.id, tagsOf(d)]));
  const all = [...new Set(places.flatMap((d) => T[d.id]))];
  const groups = TAG_GROUPS.map(([g, list]) => [g, list.filter((t) => all.includes(t))]);
  const known = new Set(TAG_GROUPS.flatMap(([, l]) => l)); const extra = all.filter((t) => !known.has(t)); if (extra.length) groups[groups.length - 1][1].push(...extra);
  // neighbours on a line: the places at the next station each way, on every line the station serves
  const nextOn = (d) => {
    const out = [];
    net.stById[d.station].lines.forEach((lid) => {
      const l = net.byId[lid]; const n = l.stations.length; const i = l.stations.findIndex((p) => p.id === d.station);
      [i - 1, i + 1].forEach((j) => { if (l.closed) j = (j + n) % n; if (j < 0 || j >= n || j === i) return; places.filter((x) => x.station === l.stations[j].id).forEach((x) => out.push({ place: x, line: lid })); });
    });
    return out;
  };
  /* The connections of one place, best first: shared tags (most first), then line neighbours.
     Each: { place, reason, tags, line, score }. Places at the same station come first of all. */
  function connections(id, max = 5) {
    const d = places.find((x) => x.id === id); if (!d) return [];
    const mine = T[id]; const out = new Map();
    places.forEach((x) => {
      if (x.id === id) return; const shared = T[x.id].filter((t) => mine.includes(t));
      if (shared.length) out.set(x.id, { place: x, tags: shared, reason: sayTag(shared[0]) + (shared.length > 1 ? ` + ${shared.length - 1} more` : ''), score: shared.length * 10 });
    });
    nextOn(d).forEach(({ place, line }) => { const e = out.get(place.id); if (e) { e.score += 1; e.line = e.line || line; } else out.set(place.id, { place, tags: [], line, reason: `Next on ${lineName(line)}`, score: 3 }); });
    places.filter((x) => x.station === d.station && x.id !== id).forEach((x) => { const e = out.get(x.id); if (e) e.score += 100; else out.set(x.id, { place: x, tags: [], reason: 'At this station', score: 100 }); });
    return [...out.values()].sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name)).slice(0, max);
  }
  const byTag = (tag) => places.filter((d) => T[d.id].includes(tag));
  // the stations a station is connected to, for the thin arcs in 2D
  const linked = (sid) => [...new Set(places.filter((d) => d.station === sid).flatMap((d) => connections(d.id, 6).filter((c) => c.tags.length).map((c) => c.place.station)))].filter((s) => s !== sid);
  return { tagsOf: (id) => T[id] || [], groups, connections, byTag, linked, all };
}
