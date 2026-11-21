/* Kevin Yu · shared site content for every design.
   One source of truth: edit facts here, and every design picks them up.
   Paths are relative to a design folder (designs/<name>/index.html), so assets start with ../../.
   Rules: no client, customer or staff names; never invent numbers; status words stay honest.
   `tags` on a project name what it is built with and what kind of work it is; designs may use them to
   connect projects that share one (optional: a design that ignores them is unaffected). */
window.KY = {
  person: {
    name: 'Kevin Yu',
    alt: ['Peiyuan Yu', '余佩远'],
    line: 'I build AI products and ship them, end to end.',
    short: 'Builder. Co-founder and CTO of Hirvo. Biomedical engineering at Purdue, on a gap year to build full time.',
    since: 'First line of code: mid-2024.',
    places: 'Canada · US · China · Hong Kong',
    languages: 'English and Mandarin',
  },

  /* Categories in the order they should read. */
  categories: [
    { id: 'software', label: 'Software' },
    { id: 'books', label: 'Books & apps' },
    { id: 'film', label: 'Film & media' },
    { id: 'games', label: 'Games' },
    { id: 'health', label: 'Healthcare AI' },
  ],

  /* status: live | testing | building | done | parked */
  projects: [
    {
      id: 'hirvo', title: 'Hirvo', category: 'software', status: 'live', year: '2026',
      tags: ['Next.js', 'TypeScript', 'Supabase', 'Anthropic API', 'Tests & evals', 'Founder'],
      role: 'Co-founder & CTO',
      one: 'Job search for international students that never invents résumé facts.',
      body: [
        'Hirvo knows which US employers sponsor visas, and it rewrites résumés without adding anything that isn’t true.',
        'The first app is live. A bigger rewrite with a new writing engine is in testing.',
      ],
      facts: [
        'Next.js, TypeScript, Supabase, Anthropic API',
        'A fact check flags any claim not in the source résumé',
        'In a 10-user simulated test, a recruiter-style grader preferred the new résumé 8 of 10 times, up from 1',
        'Wrote five spec versions, set up the GitHub org, onboarded engineers',
      ],
      links: [{ label: 'Try the app', href: 'https://resumefit-hirvo-6d2c6d74.vercel.app' }],
      cover: { type: 'img', src: '../../assets/work/hirvo-builder.webp', alt: 'Hirvo résumé builder screen, dark interface' },
      media: [
        { type: 'img', src: '../../assets/work/hirvo-builder.webp', alt: 'Hirvo résumé builder' },
        { type: 'img', src: '../../assets/work/hirvo-visa.webp', alt: 'Hirvo visa sponsor browser listing companies' },
        { type: 'img', src: '../../assets/work/hirvo-dashboard.webp', alt: 'Hirvo dashboard with a live score' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Hirvo is a job-search app for international students. I co-founded it and lead the product and the build as CTO.",
      sections: [{ h: "The problem", p: "International students look for work with two extra hurdles: they need employers who sponsor visas, and they need a résumé that is stronger without being any less true." }, { h: "What I built", p: "Hirvo knows which US employers sponsor visas, and it rewrites résumés without adding anything that isn’t true. A fact check flags any claim that is not in the source résumé. It runs on Next.js, TypeScript, Supabase and the Anthropic API." }, { h: "Where it is now", p: "The first app is live. A bigger rewrite with a new writing engine is in testing: in a 10-user simulated test, a recruiter-style grader preferred the new résumé 8 times out of 10, up from 1. Along the way I wrote five spec versions, set up the GitHub org and onboarded engineers." }],
      stats: [{ n: "8 / 10", l: "grader preferred the rewrite in a 10-user simulated test (up from 1)" }, { n: "5", l: "spec versions written" }, { n: "Live", l: "the first app" }],
    },
    {
      id: 'trade', title: 'Export risk & buyer finder', category: 'software', status: 'live', year: '2026',
      tags: ['Cloudflare Workers', 'Supabase', 'Firecrawl', 'Tests & evals', 'Client work', 'China'],
      role: 'Client work, solo build',
      one: 'Sanctions checks, company research and first-email drafts for an exporter.',
      body: [
        'A bilingual web app for a Chinese export manufacturer. It watches buyers for risk, finds new ones and drafts the first email.',
        'Private client tool. Demo on request.',
      ],
      facts: [
        'Checks clients against 4 sanctions lists (32,592 entries) every day, on its own',
        'Researches any company from public sources, with a quote behind each fact',
        'First buyer search: 20 companies in Chile found, 4 kept, 4 Spanish emails drafted for review',
        'Cloudflare Workers, Supabase, Firecrawl, about 200 tests; works in mainland China without a VPN',
      ],
      links: [],
      private: true,
      cover: { type: 'mock', mock: 'risk', alt: 'Illustration of a risk watch list with placeholder buyer names' },
      media: [{ type: 'mock', mock: 'risk', alt: 'Illustration with placeholder names' }],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "A bilingual web app for a Chinese export manufacturer. It watches buyers for risk, finds new ones and drafts the first email. A private client tool, built solo.",
      sections: [{ h: "The problem", p: "An exporter has to know a buyer is safe to sell to, and it needs new buyers worth writing to, in their own language." }, { h: "What I built", p: "Every day, on its own, the app checks clients against 4 sanctions lists with 32,592 entries. It researches any company from public sources and puts a quote behind each fact, then drafts the first email for review. It runs on Cloudflare Workers, Supabase and Firecrawl, has about 200 tests, and works in mainland China without a VPN." }, { h: "Where it is now", p: "Live with the client. The first buyer search covered 20 companies in Chile: 4 were kept, and 4 Spanish emails were drafted for review. The client stays anonymous; a demo is available on request." }],
      stats: [{ n: "32,592", l: "sanctions entries checked every day" }, { n: "4", l: "sanctions lists" }, { n: "~200", l: "tests" }],
    },
    {
      id: 'court', title: 'Court booking mini program', category: 'software', status: 'testing', year: '2026',
      tags: ['WeChat mini program', 'Tencent CloudBase', 'Client work', 'China'],
      role: 'Client work, WeChat',
      one: 'Book courts, coaches and pick-up games inside WeChat.',
      body: [
        'A WeChat mini program for a basketball venue in China: booking, memberships, check-in and staff tools.',
        'Built on Tencent CloudBase as a template other venues can reuse. Trial versions are in use.',
      ],
      facts: [
        'Entry codes expire in 30 seconds and work once',
        'No double-booking; payments kept as a ledger',
        'Court, coach and pick-up game booking, memberships, staff rosters and reports',
      ],
      links: [],
      cover: { type: 'img', src: '../../assets/work/court-booking.webp', alt: 'Mini program screen: choose a half court from courts A, B and C' },
      media: [
        { type: 'img', src: '../../assets/work/court-booking.webp', alt: 'Choosing half court A1, ¥140 an hour' },
        { type: 'img', src: '../../assets/work/court-pick.webp', alt: 'Picking a half court on courts A, B and C' },
        { type: 'img', src: '../../assets/work/court-confirm.webp', alt: 'Confirming the order: half court A1, 08:00 to 09:00, ¥140' },
        { type: 'img', src: '../../assets/work/court-success.webp', alt: 'Court booked: show the entry code at the front desk' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "A WeChat mini program for a basketball venue in China: booking, memberships, check-in and staff tools, all inside WeChat.",
      sections: [{ h: "The problem", p: "A venue runs on courts, coaches and pick-up games. Every booking has to hold, with no double-booking and a clean record of payments." }, { h: "What I built", p: "Court, coach and pick-up game booking, memberships, staff rosters and reports. Entry codes expire in 30 seconds and work once. Payments are kept as a ledger. It is built on Tencent CloudBase as a template other venues can reuse." }, { h: "Where it is now", p: "In testing. Trial versions are in use at the venue, which stays anonymous." }],
      stats: [{ n: "30 s", l: "entry codes expire, and work once" }, { n: "Ledger", l: "every payment kept as a record" }],
    },
    {
      id: 'uhome', title: 'UHOME', category: 'software', status: 'done', year: '',
      tags: ['Websites', '3D modelling', 'Client work'],
      role: 'Client work, web + 3D',
      one: 'Website and 3D renders for student apartments in Edmonton.',
      body: ['Student apartments near the University of Alberta. I built the website and did the 3D models and renders for the tours.'],
      facts: ['Website build', '3D modelling and rendering'],
      links: [{ label: 'View the demo', href: 'https://claude.ai/artifact/RjEb8CaEnokf4c2rQxTrQ6' }],
      cover: { type: 'mock', mock: 'iso', alt: 'Isometric line drawing of an apartment block' },
      media: [{ type: 'mock', mock: 'iso', alt: 'Isometric line drawing' }],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "UHOME is student housing near the University of Alberta in Edmonton. I built the website and made the 3D models and renders for the tours.",
      sections: [{ h: "What I built", p: "The website, plus the 3D models and renders for the apartment tours." }, { h: "Where it is now", p: "Done. A demo of the site is online." }],
      stats: [],
    },
    {
      id: 'books', title: 'Snuggle Crew books', category: 'books', status: 'live', year: '2025–26',
      tags: ['Snuggle Crew', 'Amazon KDP', 'YouTube', 'Own tools'],
      role: 'Publisher & toolmaker',
      one: 'Nine children’s coloring and story books on Amazon.',
      body: [
        'A small children’s label. Bookflow, my own tool, turns a researched brief into a full Amazon KDP package. I approve every scene and cover.',
        'Read-along videos on YouTube, linked by a QR code inside the book.',
      ],
      facts: ['9 titles live on Amazon', '30 books made in 30 days', 'Cozy Thanksgiving: niche pick to live in 15 days'],
      links: [
        { label: 'Cozy Thanksgiving on Amazon', href: 'https://www.amazon.com/dp/B0HLZFVW8N' },
        { label: 'Read-along video', href: 'https://youtu.be/xhY8zRzaX24' },
        { label: 'bookflowai.site', href: 'https://bookflowai.site' },
      ],
      cover: { type: 'img', src: '../../assets/work/book-star-cover.webp', alt: 'Cover of The Lost Christmas Star, a Snuggle Crew coloring book' },
      media: [
        { type: 'img', src: '../../assets/work/book-star-cover.webp', alt: 'The Lost Christmas Star cover' },
        { type: 'img', src: '../../assets/work/book-crew.webp', alt: 'The Snuggle Crew by a Christmas tree' },
        { type: 'img', src: '../../assets/work/book-hatshop.webp', alt: 'A highland calf and a mouse in a hat shop' },
      ],
      asins: ['B0GW88MRNG', 'B0GV4HY27Y', 'B0GWH8DLTL', 'B0GWH1TLZH', 'B0HGRB281R', 'B0G2B6ZCH4', 'B0HLS6V4NG', 'B0HLZFVW8N'],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Snuggle Crew is a small children’s label: nine coloring and story books, live on Amazon.",
      sections: [{ h: "How a book is made", p: "Bookflow, my own tool, turns a researched brief into a full Amazon KDP package. I approve every scene and every cover." }, { h: "Beyond the page", p: "Each book carries a QR code that opens a read-along video on YouTube." }, { h: "Where it is now", p: "Nine titles are live on Amazon. Thirty books were made in thirty days, and Cozy Thanksgiving went from a niche pick to live in 15 days." }],
      stats: [{ n: "9", l: "titles live on Amazon" }, { n: "30 in 30", l: "books made in thirty days" }, { n: "15 days", l: "from niche pick to live" }],
    },
    {
      id: 'bookflow', title: 'BookFlow', category: 'books', status: 'live', year: '',
      tags: ['Snuggle Crew', 'Amazon KDP', 'Own tools'],
      role: 'Toolmaker',
      one: 'From book idea to KDP upload, in one flow.',
      body: [
        'BookFlow is my own tool for making books for Amazon KDP. It plans the pages, draws consistent line art, makes the cover, writes the book details and exports a KDP-ready interior PDF and A+ Content.',
        'Free while in early access. Sign in with Google.',
      ],
      facts: [
        'Six steps: Plan, Line art, Review, Cover, Book details, Export',
        'Seven KDP trim sizes, 0.125 in cover bleed, embedded fonts',
        'Spine width and full-cover size worked out from the page count',
        'Free while in early access',
      ],
      links: [{ label: 'Open BookFlow', href: 'https://bookflowai.site' }],
      cover: { type: 'mock', mock: 'flow', alt: 'Illustration: the six BookFlow steps, from Plan to Export' },
      media: [{ type: 'mock', mock: 'flow', alt: 'Illustration of the six steps' }],
      /* Article fields: drawn only from the facts above and the tool's public page. */
      intro: "BookFlow is the tool I built to take a book from idea to KDP upload in one flow. It is how the Snuggle Crew books get made.",
      sections: [{ h: "What it does", p: "It plans the pages, draws consistent line art, makes the cover, writes the book details, and exports a KDP-ready interior PDF and A+ Content. Six steps: Plan, Line art, Review, Cover, Book details, Export." }, { h: "Built to KDP’s rules", p: "Seven KDP trim sizes and a 0.125 in cover bleed. Spine width and full-cover size are worked out from the page count. Blank backing pages and embedded fonts are handled, and A+ images are checked against Amazon’s rules." }, { h: "What it makes", p: "Coloring books, story coloring, picture books, activity books, journals, planners, notebooks, log books, guest books and cookbooks." }, { h: "Where it is now", p: "Live at bookflowai.site. Free while in early access; sign in with Google." }],
      stats: [{ n: "6", l: "steps, from Plan to Export" }, { n: "7", l: "KDP trim sizes" }, { n: "0.125 in", l: "cover bleed" }],
    },
    {
      id: 'ipad', title: 'Snuggle Crew Coloring', category: 'books', status: 'building', year: '2026',
      tags: ['Snuggle Crew', 'Swift', 'In-app purchases', 'Tests & evals'],
      role: 'iPad app, Swift',
      one: 'An iPad coloring app for the Snuggle Crew books.',
      body: ['Apple Pencil, five brushes, tap-to-fill and in-app purchases. Built and tested; App Store submission is next.'],
      facts: ['161 app tests', '2 books inside, 84 pages', 'StoreKit 2 purchases'],
      links: [],
      cover: { type: 'img', src: '../../assets/work/ipad-coloring.webp', alt: 'iPad app coloring a Snuggle Crew page' },
      media: [
        { type: 'img', src: '../../assets/work/ipad-coloring.webp', alt: 'Coloring a page' },
        { type: 'img', src: '../../assets/work/ipad-shelf.webp', alt: 'The book shelf' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Snuggle Crew Coloring is an iPad app for the Snuggle Crew books, written in Swift.",
      sections: [{ h: "What I built", p: "Coloring with Apple Pencil, five brushes and tap-to-fill, with in-app purchases on StoreKit 2. Two books are inside, 84 pages in all." }, { h: "Where it is now", p: "Built and tested, with 161 app tests. App Store submission is next." }],
      stats: [{ n: "161", l: "app tests" }, { n: "84", l: "pages, in 2 books" }, { n: "5", l: "brushes" }],
    },
    {
      id: 'yae', title: 'YouAreExtinct', category: 'film', status: 'live', year: '2026',
      tags: ['Claude', 'Higgsfield', 'CapCut', 'YouTube'],
      role: 'Writer, director, editor',
      one: 'Cinematic AI stories about extinct animals.',
      body: [
        'Claude writes a shot-by-shot plan from a reference and drives Higgsfield to make the shots. I cut them in CapCut. The same pipeline makes AI ads for brands.',
      ],
      facts: ['Sabre-toothed cat Shorts: about 6,000 views', 'A T. rex episode in production', 'First paying ad client in progress'],
      links: [{ label: 'Watch the channel', href: 'https://www.youtube.com/@YouAreExtinct' }],
      cover: { type: 'video', src: '../../assets/work/yae-intro.mp4', poster: '../../assets/work/yae-intro-poster.jpg', alt: 'YouAreExtinct channel intro' },
      media: [
        { type: 'yt', id: 'MLlSEwQhaVY', alt: 'Mammoth film' },
        { type: 'yt', id: 'pXjGjmX3PgM', alt: 'Story sample' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "YouAreExtinct makes cinematic AI stories about extinct animals. I write, direct and edit.",
      sections: [{ h: "How a film is made", p: "Claude writes a shot-by-shot plan from a reference and drives Higgsfield to make the shots. I cut them together in CapCut." }, { h: "Beyond the channel", p: "The same pipeline makes AI ads for brands. The first paying ad client is in progress." }, { h: "Where it is now", p: "Live. The sabre-toothed cat Shorts reached about 6,000 views, and a T. rex episode is in production." }],
      stats: [{ n: "~6,000", l: "views on the sabre-toothed cat Shorts" }, { n: "Live", l: "the channel" }],
    },
    {
      id: 'noir', title: 'Noir Hours', category: 'film', status: 'live', year: '2026',
      tags: ['YouTube', 'AI-assisted production'],
      role: 'Music channel',
      one: 'Noir jazz for late-night studying and focus.',
      body: ['Lyric-free, slow and smoky, made with an AI-assisted production workflow. The first mix is live.'],
      facts: ['First mix: No Rush Tonight, 1 h 39 min', 'Animated window-scene loops'],
      links: [{ label: 'Watch No Rush Tonight', href: 'https://youtu.be/8oM1BqovjiY' }],
      cover: { type: 'video', src: '../../assets/work/noir-loop.mp4', poster: '../../assets/work/noir-loop-poster.jpg', alt: 'A rainy noir city window, looping' },
      media: [{ type: 'yt', id: '8oM1BqovjiY', alt: 'No Rush Tonight' }, { type: 'img', src: '../../assets/work/noir-skyline.webp', alt: 'Noir Hours skyline at night' }],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Noir Hours is a music channel: noir jazz for late-night studying and focus.",
      sections: [{ h: "The sound", p: "Lyric-free, slow and smoky, made with an AI-assisted production workflow and set to animated window-scene loops." }, { h: "Where it is now", p: "The first mix is live: No Rush Tonight, 1 hour 39 minutes." }],
      stats: [{ n: "1 h 39 min", l: "the first mix, No Rush Tonight" }],
    },
    {
      id: 'influencers', title: 'AI influencers', category: 'film', status: 'building', year: '2026',
      tags: ['Higgsfield', 'Social video'],
      role: 'With two cofounders',
      one: 'A funny viral character and a classic Instagram persona.',
      body: ['Looks trained on Higgsfield Soul 2.0 so each character stays the same person from post to post. Public handles come later.'],
      facts: ['Funny and viral for TikTok and Reels', 'Ariana, a traditional persona for Instagram'],
      links: [],
      cover: { type: 'img', src: '../../assets/media/influencer-classic.jpg', alt: 'Ariana on a city street at night' },
      media: [
        { type: 'video', src: '../../assets/media/influencer-funny.mp4', poster: '../../assets/media/influencer-funny.jpg', alt: 'The funny character dancing' },
        { type: 'img', src: '../../assets/media/influencer-classic-2.jpg', alt: 'Ariana in a denim jacket' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Two AI characters, built with two cofounders: a funny viral character for TikTok and Reels, and Ariana, a traditional persona for Instagram.",
      sections: [{ h: "How it works", p: "The looks are trained on Higgsfield Soul 2.0, so each character stays the same person from one post to the next." }, { h: "Where it is now", p: "Building. Public handles come later." }],
      stats: [{ n: "2", l: "characters" }, { n: "Soul 2.0", l: "trained looks on Higgsfield" }],
    },
    {
      id: 'stickers', title: 'Sticker Scenes', category: 'games', status: 'testing', year: '2027',
      tags: ['Expo', 'In-app purchases'],
      role: 'iOS game, Expo',
      one: 'A calm, offline sticker-puzzle game.',
      body: ['12 scenes in 4 worlds, 225 sticker placements, one unlock and no ads. Launch planned for early 2027.'],
      facts: ['12 scenes, 4 worlds', 'Expo / React Native', 'One $4.99 unlock, no ads'],
      links: [],
      cover: { type: 'stickers', room: '../../assets/work/sticker-room.webp', stickers: ['../../assets/work/sticker-sunflower.webp', '../../assets/work/sticker-duck.webp', '../../assets/work/sticker-dog.webp', '../../assets/work/sticker-boat.webp'], alt: 'Stickers landing in an empty room' },
      media: [{ type: 'img', src: '../../assets/work/sticker-room.webp', alt: 'An empty room waiting for stickers' }],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Sticker Scenes is a calm, offline sticker-puzzle game for iOS, built with Expo and React Native.",
      sections: [{ h: "The game", p: "Twelve scenes across four worlds, with 225 sticker placements." }, { h: "The deal", p: "One $4.99 unlock and no ads." }, { h: "Where it is now", p: "Building. Launch is planned for early 2027." }],
      stats: [{ n: "12", l: "scenes in 4 worlds" }, { n: "225", l: "sticker placements" }, { n: "$4.99", l: "one unlock, no ads" }],
    },
    {
      id: 'party', title: 'One Too Far', category: 'games', status: 'testing', year: '2026',
      tags: ['Expo'],
      role: 'Party game, Expo',
      one: 'A one-phone party game for 2 to 8 friends.',
      body: ['Four modes, eight characters and an optional punishment deck. A complete test build; not in any store yet.'],
      facts: ['4 modes, 8 characters', 'Resumes an interrupted game'],
      links: [],
      cover: { type: 'img', src: '../../assets/work/party-friends.webp', alt: 'One Too Far: pick your friends screen' },
      media: [
        { type: 'img', src: '../../assets/work/party-friends.webp', alt: 'Pick your friends' },
        { type: 'img', src: '../../assets/work/party-intro.webp', alt: 'How to play' },
      ],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "One Too Far is a one-phone party game for 2 to 8 friends, built with Expo.",
      sections: [{ h: "The game", p: "Four modes, eight characters and an optional punishment deck. If a game is interrupted, it picks up where it left off." }, { h: "Where it is now", p: "A complete test build; not in any store yet." }],
      stats: [{ n: "2–8", l: "players on one phone" }, { n: "4", l: "modes" }, { n: "8", l: "characters" }],
    },
    {
      id: 'duiyao', title: '對藥 medication check', category: 'health', status: 'done', year: '2026',
      tags: ['Hackathon', 'Healthcare', 'Hong Kong'],
      role: 'Hackathon, solo, AIx Origin Hong Kong',
      one: 'Snap a medicine box, match the drug, hear it in Cantonese.',
      body: ['Built solo at Cyberport. It reads discharge sheets and medicine boxes, matches drugs by active ingredient with a rules engine, and reads the result aloud in Cantonese.'],
      facts: ['Rules engine, not a guess', 'Cantonese voice output'],
      links: [],
      cover: { type: 'mock', mock: 'rx', alt: 'Illustration: Panadol and paracetamol 500 mg matched by active ingredient' },
      media: [{ type: 'mock', mock: 'rx', alt: 'Illustration' }],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "對藥 is a medication check: snap a medicine box, match the drug, hear it in Cantonese. Built solo at the AIx Origin hackathon at Cyberport, Hong Kong.",
      sections: [{ h: "What it does", p: "It reads discharge sheets and medicine boxes, matches drugs by active ingredient with a rules engine rather than a guess, and reads the result aloud in Cantonese." }, { h: "Where it is now", p: "Done: a working hackathon demo." }],
      stats: [{ n: "Rules", l: "engine, not a guess" }, { n: "粵語", l: "Cantonese voice output" }],
    },
    {
      id: 'hackathons', title: 'Hackathons', category: 'health', status: 'done', year: '2026',
      tags: ['Hackathon', 'Healthcare', 'Hong Kong', 'China'],
      role: 'Healthcare AI',
      one: 'Healthcare AI builds in Hong Kong and Shanghai.',
      body: ['AIx Origin, Hong Kong (對藥). 复客松 · 华润三九杯, Shanghai: medication confirmation for older adults. Fudan: recognition certificate. I entered team events solo and shipped working demos.'],
      facts: ['AIx Origin', '复客松', 'Fudan'],
      links: [],
      cover: { type: 'mock', mock: 'rx', alt: 'Illustration' },
      media: [],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Healthcare AI builds at hackathons in Hong Kong and Shanghai. I entered team events solo and shipped working demos.",
      sections: [{ h: "The events", p: "AIx Origin, Hong Kong: 對藥, a medication check. 复客松 · 华润三九杯, Shanghai: medication confirmation for older adults. Fudan: a recognition certificate." }],
      stats: [{ n: "3", l: "hackathons, entered solo" }],
    },
    {
      id: 'pindou', title: '拼豆 bead store', category: 'software', status: 'parked', year: '',
      tags: ['WeChat mini program', 'China'],
      role: 'Growth and tech',
      one: 'Social, a mini program and web for a Shanghai bead store.',
      body: ['Just started. I own growth and tech.'],
      facts: [], links: [],
      cover: { type: 'none' }, media: [],
      /* Article fields (optional, added for the Transit design): drawn only from the facts above. */
      intro: "Social, a mini program and the web for a Shanghai bead store.",
      sections: [{ h: "Where it is now", p: "Just started. I own growth and tech." }],
      stats: [],
    },
  ],

  resume: {
    experience: [
      { when: '2026 – now', role: 'Co-founder & CTO', org: 'Hirvo', note: 'Lead product and build: specs, the app, the engineering org.' },
      { when: 'Ongoing', role: 'Independent developer', org: 'Client work', note: 'A live B2B risk tool, a WeChat booking mini program, a real estate site with 3D.' },
      { when: 'Nov 2025 – now', role: 'Publisher', org: 'Snuggle Crew', note: 'Nine books on Amazon, my own tool Bookflow, and an iPad app.' },
      { when: 'Side roles', role: 'Project supervisor, startup advisor', org: '', note: 'Supervised a project for a US company; advised an MCN startup.' },
      { when: '2026', role: 'Healthcare AI hackathons', org: 'AIx Origin · 复客松 · Fudan', note: 'Solo entries, working demos.' },
    ],
    education: [
      { when: 'Now', org: 'Purdue University', note: 'Biomedical engineering, background in statistics. Gap year until spring 2027.' },
      { when: 'Class of 2024', org: 'Shanghai American School', note: '' },
    ],
    skills: [
      ['Build', 'Next.js, TypeScript, Supabase, Cloudflare Workers, Expo, SwiftUI, WeChat mini programs'],
      ['AI', 'Claude Code, Codex, Anthropic API, agents and evals, Firecrawl, ComfyUI on a DGX Spark'],
      ['Media', 'Higgsfield, ElevenLabs, CapCut, 3D modelling'],
      ['Founder ops', 'Product specs, cap tables, SAFEs, 83(b) elections'],
      ['Languages', 'English, Mandarin'],
    ],
  },

  contact: {
    phone: '+1 (765) 421-0237',
    phoneHref: 'tel:+17654210237',
    linkedin: 'https://www.linkedin.com/in/kevin-yu-5b7103327',
    wechatQr: '../../assets/img/wechat-qr.png',
    x: null, /* handle not live yet */
    email: null, /* not decided yet */
    asks: ['Consulting and builds', 'Healthcare AI and AI product roles', 'AI-shot ads for brands'],
  },

  /* The newsletter loads its newest issues from this file at runtime, so new issues show up on their own. */
  newsletter: { index: '../../newsletter/', issues: '../../newsletter/issues.json' },
};
