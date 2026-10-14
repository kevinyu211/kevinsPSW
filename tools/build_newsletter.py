#!/usr/bin/env python3
"""Build the Daily AI newsletter pages from newsletter/issues.json.

Writes:
  newsletter/index.html            the archive (latest issue, topics, search, month groups)
  newsletter/<date>/index.html     one page per issue, English and 中文 on the same page
  index.html                       the home-page section between the NEWSLETTER markers
  sitemap.xml                      the home page, the archive and every issue

Run it from the repo root after adding or editing issues:  python3 tools/build_newsletter.py
The site itself stays static: the generated HTML is committed.
"""
import html
import json
import math
import re
from datetime import date as Date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://kevinpeiyuanyu.com'
DATA = json.loads((ROOT / 'newsletter' / 'issues.json').read_text(encoding='utf-8'))
ISSUES = sorted(DATA['issues'], key=lambda i: i['date'], reverse=True)

TOPICS = {
    'policy': ('Policy', '监管'),
    'safety': ('Safety', '安全'),
    'agents': ('Agents', '智能体'),
    'models': ('Models', '模型'),
    'chips': ('Chips', '芯片'),
}
WEEKDAY_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
WEEKDAY_ZH = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
            'September', 'October', 'November', 'December']

ARROW = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>'
THEME_BTN = ('<button class="icon-btn theme-toggle" type="button" aria-label="Switch color theme">'
             '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><mask id="moon-mask"><rect width="24" height="24" fill="#fff"></rect>'
             '<circle class="moon-bite" cx="25" cy="1" r="6" fill="#000"></circle></mask></defs>'
             '<circle class="sun-core" cx="12" cy="12" r="5" mask="url(#moon-mask)"></circle><g class="sun-rays">'
             '<path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"></path>'
             '</g></svg></button>')
LANG_TOGGLE = ('<div class="lang-toggle" role="group" aria-label="Language">'
               '<button type="button" data-lang-btn="en" aria-pressed="true">English</button>'
               '<button type="button" data-lang-btn="zh" aria-pressed="false" lang="zh-Hans">中文</button></div>')
HEAD_SCRIPT = """<script>
  (function () {
    var d = document.documentElement;
    try { var t = localStorage.getItem('ky-theme'); if (t === 'dark' || t === 'light') d.setAttribute('data-theme', t); } catch (e) {}
    var l = null;
    try { l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('ky-nl-lang'); } catch (e) {}
    if (l === 'zh') d.setAttribute('data-nl-lang', 'zh');
  })();
</script>"""

esc = html.escape


def inline(md):
    """The small slice of Markdown the issues use: links, bold, italics and escaped characters."""
    s = re.sub(r'\\([\\`*_{}\[\]()#+\-.!$~|>])', lambda m: '\x00%d\x00' % ord(m.group(1)), md)
    s = esc(s, quote=False)
    s = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)',
               lambda m: f'<a href="{esc(m.group(2))}" target="_blank" rel="noopener">{m.group(1)}</a>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', s)
    s = re.sub(r'\x00(\d+)\x00', lambda m: esc(chr(int(m.group(1)))), s)
    return s


def plain(md):
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', md)
    s = re.sub(r'\\(.)', r'\1', s)
    return s.replace('**', '').replace('*', '')


def day(i):
    return Date.fromisoformat(i['date'])


def long_date(i, lang):
    d = day(i)
    if lang == 'zh':
        return f'{d.year}年{d.month}月{d.day}日 · {WEEKDAY_ZH[d.weekday()]}'
    return f'{WEEKDAY_EN[d.weekday()]}, {MONTH_EN[d.month - 1]} {d.day}, {d.year}'


def short_date(i, lang):
    d = day(i)
    return f'{d.month}月{d.day}日' if lang == 'zh' else f'{MONTH_EN[d.month - 1][:3]} {d.day}'


def num(i, lang):
    return f'第 {i["no"]} 期' if lang == 'zh' else f'No. {i["no"]}'


def both(en, zh):
    return f'<span data-pane="en">{en}</span><span data-pane="zh" lang="zh-Hans">{zh}</span>'


def langs(i):
    return [l for l in ('en', 'zh') if l in i]


def read_minutes(v, lang):
    text = ' '.join([v['dek']] + [s['h'] for s in v['stories']] +
                    [b.get('p') or b.get('li') or '' for s in v['stories'] for b in s['body']])
    text = plain(text)
    if lang == 'zh':
        return max(1, math.ceil(len(re.sub(r'\s', '', text)) / 450))
    return max(1, math.ceil(len(text.split()) / 230))


def topic(i, lang):
    en, zh = TOPICS[i['topic']]
    return zh if lang == 'zh' else en


def bi(i, render, tag='span', cls=''):
    """Both language versions of a fragment; CSS shows the one picked in the language switch.
    An issue with only one language shows that one either way."""
    ls = langs(i)
    c = f' class="{cls}"' if cls else ''
    if len(ls) == 1:
        lang = ls[0]
        la = ' lang="zh-Hans"' if lang == 'zh' else ''
        return f'<{tag}{c}{la}>{render(lang)}</{tag}>'
    out = []
    for lang in ls:
        la = ' lang="zh-Hans"' if lang == 'zh' else ''
        out.append(f'<{tag}{c} data-pane="{lang}"{la}>{render(lang)}</{tag}>')
    return ''.join(out)


def header(prefix, current):
    cur_home = ' aria-current="page"' if current == 'home' else ''
    cur_nl = ' aria-current="page"' if current == 'archive' else (' aria-current="true"' if current == 'issue' else '')
    return f"""<header class="site-header">
  <div class="bar">
    <a class="brand" href="{prefix}" aria-label="Kevin Yu, home">
      <span class="brand-mark" aria-hidden="true"><i></i></span>
      <span class="brand-name">Kevin Yu</span>
    </a>
    <nav class="nl-nav" aria-label="Site">
      <a href="{prefix}"{cur_home}>Home</a>
      <a href="{prefix}newsletter/"{cur_nl}>Newsletter</a>
      <a href="{prefix}#work">Work</a>
      <a href="{prefix}#contact">Contact</a>
    </nav>
    <div class="bar-actions">{THEME_BTN}</div>
  </div>
  <div class="progress" aria-hidden="true"><span></span></div>
</header>"""


def footer(prefix):
    return f"""<footer class="nl-foot">
  <div class="wrap foot site-footer">
    <span>Daily AI · Kevin Yu · 余佩远</span>
    <a href="{prefix}newsletter/">All issues</a>
    <a href="{prefix}">kevinpeiyuanyu.com</a>
  </div>
</footer>"""


def page(prefix, title, desc, canonical, body, extra_head=''):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Kevin Yu">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{SITE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F4F1">
<link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap">
<link rel="stylesheet" href="{prefix}assets/css/main.css">
<link rel="stylesheet" href="{prefix}assets/css/newsletter.css">
{HEAD_SCRIPT}
{extra_head}</head>
<body class="nl-page">
<a class="skip" href="#main">Skip to content</a>
{header(prefix, 'archive' if prefix == '../' else 'issue')}
<main id="main">
{body}
</main>
{footer(prefix)}
<script src="{prefix}assets/js/newsletter.js" defer></script>
</body>
</html>
"""


# ---------- Issue pages ----------
def story_html(s, n, lang):
    body = []
    items = []
    for b in s['body']:
        if 'li' in b:
            items.append(f'<li>{inline(b["li"])}</li>')
            continue
        if items:
            body.append(f'<ul>{"".join(items)}</ul>')
            items = []
        body.append(f'<p>{inline(b["p"])}</p>')
    if items:
        body.append(f'<ul>{"".join(items)}</ul>')
    src = ''
    if s['sources']:
        links = ''.join(f'<a href="{esc(x["u"])}" target="_blank" rel="noopener">{inline(x["t"])}</a>' for x in s['sources'])
        src = f'<p class="nl-sources"><b>{"来源" if lang == "zh" else "Sources"}</b>{links}</p>'
    return f"""<section class="nl-story">
        <span class="nl-story-n">{n:02d}</span>
        <div><h2>{inline(s['h'])}</h2>{''.join(body)}{src}</div>
      </section>"""


def issue_page(i, older, newer):
    prefix = '../../'

    def article(lang):
        v = i[lang]
        zh = lang == 'zh'
        stories = '\n      '.join(story_html(s, n, lang) for n, s in enumerate(v['stories'], 1))
        mins = read_minutes(v, lang)
        meta = (f'<time datetime="{i["date"]}">{long_date(i, lang)}</time><span class="sep">·</span>'
                f'<span class="topic">{topic(i, lang)}</span><span class="sep">·</span>'
                + (f'<span>{mins} 分钟读完</span>' if zh else f'<span>{mins} min read</span>'))
        credit = ('每天早上，我团队里负责新闻的智能体 Andrew 整理当天 AI 圈的变化，每条都附原始来源。'
                  if zh else
                  'Every morning Andrew, the news-desk agent on my team, files this brief on what changed in AI. Every story links to its sources.')
        return f"""<header class="nl-head">
        <div class="nl-head-top"><p class="nl-meta">{meta}</p></div>
        <h1 class="nl-h1">{inline(v['title'])}</h1>
        <p class="nl-dek">{inline(v['dek'])}</p>
      </header>
      {stories}
      <p class="nl-credit">{credit} <a href="{prefix}#how">{'看看我的 AI 团队怎么运作' if zh else 'How my AI team works'}</a></p>"""

    panes = bi(i, article, 'div')
    toggle = LANG_TOGGLE if len(langs(i)) > 1 else ''

    def pager_link(j, cls, label_en, label_zh):
        if not j:
            return '<span></span>'
        t = bi(j, lambda l: inline(j[l]['title']), 'b')
        lab = (f'<span data-pane="en">{label_en}</span><span data-pane="zh" lang="zh-Hans">{label_zh}</span>')
        return (f'<a class="{cls}" href="../{j["date"]}/"><span>{ARROW if cls == "prev" else ""}'
                f'{lab} · {both(num(j, "en"), num(j, "zh"))}{ARROW if cls == "next" else ""}</span>{t}</a>')

    pager = (f'<nav class="nl-pager" aria-label="More issues">{pager_link(older, "prev", "Previous issue", "上一期")}'
             f'{pager_link(newer, "next", "Next issue", "下一期")}</nav>')
    lead = i.get('en') or i.get('zh')
    title = f'{plain(lead["title"])} · Daily AI No. {i["no"]}'
    desc = plain(lead['dek'])[:300]
    canonical = f'{SITE}/newsletter/{i["date"]}/'
    ld = {
        '@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': plain(lead['title']),
        'datePublished': i['date'], 'inLanguage': ['en', 'zh-Hans'] if len(langs(i)) > 1 else ('en' if 'en' in i else 'zh-Hans'),
        'author': {'@type': 'Person', 'name': 'Kevin Yu', 'url': SITE + '/'},
        'isPartOf': {'@type': 'Periodical', 'name': 'Daily AI', 'url': SITE + '/newsletter/'},
        'url': canonical, 'description': desc,
    }
    extra = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n'
    body = f"""  <article class="wrap nl-article">
    <div class="nl-head-top">
      <p class="nl-crumbs"><a href="../">Daily AI</a><span aria-hidden="true">/</span><span>{both(num(i, 'en'), num(i, 'zh'))}</span></p>
      {toggle}
    </div>
    {panes}
    {pager}
    <p class="nl-back"><a class="btn btn-line btn-sm" href="../"><span data-pane="en">All issues</span><span data-pane="zh" lang="zh-Hans">全部期数</span></a></p>
  </article>"""
    return page(prefix, title, desc, canonical, body, extra)


# ---------- Archive ----------
def search_text(i):
    parts = [i['date'], topic(i, 'en'), topic(i, 'zh')]
    for l in langs(i):
        v = i[l]
        parts += [v['title'], v['dek']] + [s['h'] for s in v['stories']]
    return esc(plain(' '.join(parts)).lower())


def row(i):
    d = day(i)
    date_html = bi(i, lambda l: (f'<b>{d.month}月{d.day}日</b><span>{WEEKDAY_ZH[d.weekday()]}</span>' if l == 'zh'
                                 else f'<b>{MONTH_EN[d.month - 1][:3]} {d.day}</b><span>{WEEKDAY_EN[d.weekday()]}</span>'),
                   'time', 'nl-date')
    date_html = date_html.replace('<time class="nl-date"', f'<time datetime="{i["date"]}" class="nl-date"')
    main = bi(i, lambda l: f'<h3>{inline(i[l]["title"])}</h3><p>{inline(i[l]["dek"])}</p>', 'div', 'nl-row-main')
    meta = bi(i, lambda l: (f'<span class="topic">{topic(i, l)}</span><span>{num(i, l)} · '
                            + (f'{len(i[l]["stories"])} 条' if l == 'zh' else f'{len(i[l]["stories"])} stories') + '</span>'),
              'div', 'nl-row-meta')
    return (f'<a class="nl-row" href="{i["date"]}/" data-topic="{i["topic"]}" data-search="{search_text(i)}">'
            f'{date_html}{main}{meta}{ARROW}</a>')


def feature(i, href, eyebrow_new=True):
    def inner(l):
        v = i[l]
        zh = l == 'zh'
        stories = ''.join(f'<li>{inline(s["h"])}</li>' for s in v['stories'])
        new = f'<span class="new">{"最新一期" if zh else "Latest issue"}</span>' if eyebrow_new else ''
        return f"""<div class="nl-feature-main">
          <p class="nl-eyebrow">{new}<span>{num(i, l)}</span><span>{long_date(i, l)}</span><span class="topic">{topic(i, l)}</span></p>
          <h2>{inline(v['title'])}</h2>
          <p class="nl-dek">{inline(v['dek'])}</p>
          <span class="nl-read">{'阅读这一期' if zh else 'Read the issue'} {ARROW}</span>
        </div>
        <div class="nl-inside">
          <p class="nl-inside-label">{'本期内容' if zh else 'In this issue'}</p>
          <ol>{stories}</ol>
        </div>"""
    return f'<a class="nl-feature" href="{href}">{bi(i, inner, "div", "nl-feature-pane")}</a>'


def archive_page():
    latest = ISSUES[0]
    counts = {k: sum(1 for i in ISSUES if i['topic'] == k) for k in TOPICS}
    chips = [f'<button class="nl-chip" type="button" data-topic-btn="all" aria-pressed="true">'
             f'<span data-pane="en">All</span><span data-pane="zh" lang="zh-Hans">全部</span><i>{len(ISSUES)}</i></button>']
    for k, (en, zh) in TOPICS.items():
        chips.append(f'<button class="nl-chip" type="button" data-topic-btn="{k}" aria-pressed="false">'
                     f'<span data-pane="en">{en}</span><span data-pane="zh" lang="zh-Hans">{zh}</span><i>{counts[k]}</i></button>')
    months = {}
    for i in ISSUES:
        months.setdefault(i['date'][:7], []).append(i)
    groups = []
    for ym, items in months.items():
        y, m = map(int, ym.split('-'))
        groups.append(f"""<section class="nl-month" aria-label="{MONTH_EN[m - 1]} {y}">
      <div class="nl-month-head"><h2><span data-pane="en">{MONTH_EN[m - 1]} {y}</span><span data-pane="zh" lang="zh-Hans">{y}年{m}月</span></h2>
        <span><span data-pane="en">{len(items)} issues</span><span data-pane="zh" lang="zh-Hans">{len(items)} 期</span></span></div>
      {''.join(row(i) for i in items)}
    </section>""")
    first, last = ISSUES[-1], ISSUES[0]
    stories = sum(len(i[l]['stories']) for i in ISSUES for l in langs(i) if l == 'en' or 'en' not in i)
    body = f"""  <section class="wrap nl-mast">
    <div class="nl-mast-grid">
      <div>
        <p class="kicker"><span class="kicker-n">Newsletter</span><span data-pane="en">by Kevin Yu</span><span data-pane="zh" lang="zh-Hans">余佩远</span></p>
        <h1 class="nl-name">Daily <em>AI</em></h1>
        <p class="nl-sub" data-pane="en">A short, sourced read on what changed in AI, every morning, in English and 中文. Policy, safety, agents, models and chips, with a link to every source.</p>
        <p class="nl-sub" data-pane="zh" lang="zh-Hans">每天早上一份简短的 AI 动态，中英双语。监管、安全、智能体、模型和芯片，每条新闻都附原始来源。</p>
      </div>
      <div class="nl-mast-side">{LANG_TOGGLE}</div>
    </div>
    <div class="nl-stats">
      <div><b>{len(ISSUES)}</b><span data-pane="en">issues</span><span data-pane="zh" lang="zh-Hans">期</span></div>
      <div><b>{stories}</b><span data-pane="en">stories</span><span data-pane="zh" lang="zh-Hans">条新闻</span></div>
      <div><b>2</b><span data-pane="en">languages</span><span data-pane="zh" lang="zh-Hans">种语言</span></div>
      <div><b>{both(short_date(first, 'en'), short_date(first, 'zh'))}</b><span data-pane="en">first issue</span><span data-pane="zh" lang="zh-Hans">第一期</span></div>
    </div>
  </section>

  <section class="wrap" aria-label="Latest issue">
    {feature(latest, f'{latest["date"]}/')}
  </section>

  <section class="wrap" aria-labelledby="archive-title">
    <h2 class="sr-only" id="archive-title">All issues</h2>
    <div class="nl-tools">
      <div class="nl-topics" role="group" aria-label="Topics">{''.join(chips)}</div>
      <label class="nl-search"><span class="sr-only">Search issues</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>
        <input type="search" placeholder="Search issues" data-ph-en="Search issues" data-ph-zh="搜索标题和内容" autocomplete="off">
      </label>
    </div>
    <div data-nl-archive>
      {''.join(groups)}
      <p class="nl-empty" hidden><span data-pane="en">No issues match. Try another word or topic.</span><span data-pane="zh" lang="zh-Hans">没有找到相关期数，换个关键词或话题试试。</span></p>
    </div>
  </section>"""
    desc = (f'Daily AI by Kevin Yu: a short, sourced read on what changed in AI, in English and 中文. '
            f'{len(ISSUES)} issues since {MONTH_EN[day(first).month - 1]} {day(first).year}.')
    return page('../', 'Daily AI · Newsletter by Kevin Yu', desc, f'{SITE}/newsletter/', body)


# ---------- Home-page section ----------
def home_section():
    latest = ISSUES[0]

    def recent_row(i):
        t = bi(i, lambda l: f'<b>{inline(i[l]["title"])}</b><span class="topic">{topic(i, l)}</span>', 'span')
        d = bi(i, lambda l: short_date(i, l), 'span')
        return f'<a href="newsletter/{i["date"]}/"><time datetime="{i["date"]}">{d}</time>{t}</a>'

    return f"""  <!-- NEWSLETTER:START (generated by tools/build_newsletter.py) -->
  <section class="section newsletter" id="newsletter" aria-labelledby="newsletter-title">
    <div class="wrap">
      <div class="section-head section-head-row">
        <div class="head-main">
          <p class="kicker"><span class="kicker-n">04</span>What I write</p>
          <h2 id="newsletter-title" data-split>Daily AI, in English and 中文.</h2>
          <p class="section-sub">Every morning Andrew, the news-desk agent on my team, files a short, sourced brief on what changed in AI. {len(ISSUES)} issues so far, each with a link to every source.</p>
        </div>
        {LANG_TOGGLE}
      </div>
      <div class="newsletter-grid" data-reveal>
        {feature(latest, f'newsletter/{latest["date"]}/')}
        <div class="nl-recent">
          <p class="nl-recent-label"><span data-pane="en">Earlier issues</span><span data-pane="zh" lang="zh-Hans">往期</span></p>
          {''.join(recent_row(i) for i in ISSUES[1:6])}
          <a class="btn btn-ink" href="newsletter/"><span data-pane="en">All {len(ISSUES)} issues</span><span data-pane="zh" lang="zh-Hans">全部 {len(ISSUES)} 期</span> {ARROW}</a>
        </div>
      </div>
    </div>
  </section>
  <!-- NEWSLETTER:END -->
"""


def main():
    out = ROOT / 'newsletter'
    (out / 'index.html').write_text(archive_page(), encoding='utf-8')
    for n, i in enumerate(ISSUES):
        older = ISSUES[n + 1] if n + 1 < len(ISSUES) else None
        newer = ISSUES[n - 1] if n > 0 else None
        d = out / i['date']
        d.mkdir(exist_ok=True)
        (d / 'index.html').write_text(issue_page(i, older, newer), encoding='utf-8')

    home = ROOT / 'index.html'
    s = home.read_text(encoding='utf-8')
    s = re.sub(r'  <!-- NEWSLETTER:START.*?<!-- NEWSLETTER:END -->\n', lambda m: home_section(), s, flags=re.S)
    home.write_text(s, encoding='utf-8')

    urls = [(SITE + '/', ISSUES[0]['date']), (SITE + '/newsletter/', ISSUES[0]['date'])]
    urls += [(f'{SITE}/newsletter/{i["date"]}/', i['date']) for i in ISSUES]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f'  <url>\n    <loc>{u}</loc>\n    <lastmod>{m}</lastmod>\n  </url>' for u, m in urls]
    sm.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(sm) + '\n', encoding='utf-8')
    print(f'Built {len(ISSUES)} issues, the archive, the home section and the sitemap.')


if __name__ == '__main__':
    main()
