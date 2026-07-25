#!/usr/bin/env node
/**
 * Static guide generator for owlio.online
 *
 *   content/site.json          global config (brand, urls, colours)
 *   content/guides/<slug>.json one guide, one file
 *        ->  guides/<slug>.html      generated, do not edit by hand
 *        ->  guides/index.html       generated hub
 *        ->  sitemap.xml             regenerated (static pages + guides)
 *
 * Zero dependencies. Run: node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const GUIDES_SRC = path.join(CONTENT, 'guides');
const GUIDES_OUT = path.join(ROOT, 'guides');

// ── helpers ──────────────────────────────────────────────────────────────────

const esc = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Minimal inline markdown: **bold**, *italic*, [text](url). Escapes first. */
const inline = (s = '') =>
    esc(s)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
            `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/** Strip tags + markdown so we can count words and build FAQ schema safely. */
const plain = (s = '') =>
    String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').trim();

const wordCount = (t) => plain(t).split(/\s+/).filter(Boolean).length;

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── shared styles ────────────────────────────────────────────────────────────
// Mirrors index.html tokens exactly. Every generated page shares this block,
// so a change here restyles the entire guide library in one build.

/** Apple logo path data, shared by every download CTA. */
const APPLE_GLYPH =
    'M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z';

const STYLES = `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root { --accent: #5b2a9e; }

        body {
            font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #ffffff;
            color: #4a4a52;
            line-height: 1.6;
        }

        .wrap { max-width: 760px; margin: 0 auto; padding: 3rem 2rem 5rem; }
        .wrap-wide { max-width: 1100px; }

        /* ── Breadcrumb ── */
        .crumb { font-size: 0.85rem; color: #6f6f7a; margin-bottom: 2rem; }
        .crumb a { color: #5f5f6b; text-decoration: none; }
        .crumb a:hover { color: var(--accent); }

        /* ── Masthead ── */
        .eyebrow {
            font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase;
            color: var(--accent); font-weight: 600; margin-bottom: 0.75rem;
        }
        h1 {
            font-size: 2.6rem; font-weight: 700; color: #16161c;
            line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 1rem;
        }
        .standfirst { font-size: 1.15rem; color: #5f5f6b; line-height: 1.65; }
        .byline {
            font-size: 0.85rem; color: #6f6f7a; margin-top: 1.25rem;
            padding-bottom: 2rem; border-bottom: 1px solid #e5e3ec;
        }

        /* ── Body ── */
        h2 {
            font-size: 1.6rem; font-weight: 700; color: #16161c;
            margin: 3rem 0 1rem; letter-spacing: -0.01em;
        }
        h3 { font-size: 1.15rem; font-weight: 600; color: #16161c; margin: 2rem 0 0.75rem; }
        p { margin-bottom: 1.15rem; }
        a { color: var(--accent); }
        strong { color: #16161c; font-weight: 600; }

        ul, ol { margin: 0 0 1.25rem 1.25rem; }
        li { margin-bottom: 0.5rem; }
        li::marker { color: var(--accent); }

        /* ── Day schedule ── */
        .day {
            background-color: #f7f6fa; border: 1px solid #e5e3ec; border-radius: 14px;
            padding: 1.75rem; margin-bottom: 1.25rem;
        }
        .day h3 { margin-top: 0; }
        .day-note {
            font-size: 0.9rem; color: #5f5f6b; font-style: italic;
            margin: -0.25rem 0 1.25rem;
        }
        .stop { display: flex; gap: 1rem; padding: 0.85rem 0; border-top: 1px solid #e5e3ec; }
        .stop:first-of-type { border-top: none; padding-top: 0; }
        .stop-time {
            flex-shrink: 0; width: 92px; font-size: 0.85rem; font-weight: 600;
            color: var(--accent); padding-top: 0.15rem;
        }
        .stop-name { font-weight: 600; color: #16161c; display: block; margin-bottom: 0.2rem; }
        .stop-detail { font-size: 0.95rem; color: #5f5f6b; }

        /* ── Figures, galleries, video ── */
        .fig { margin: 2rem 0; }
        .fig-img {
            width: 100%; height: auto; border-radius: 14px;
            border: 1px solid #e5e3ec; display: block;
        }
        figcaption { font-size: 0.85rem; color: #6f6f7a; margin-top: 0.6rem; line-height: 1.5; }
        figcaption .credit { display: block; color: #6f6f7a; font-size: 0.78rem; margin-top: 0.2rem; }
        figcaption .credit a { color: #6f6f7a; text-decoration: underline; }
        figcaption .credit a:hover { color: var(--accent); }

        .gallery {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem; margin: 2rem 0;
        }
        .gallery .fig { margin: 0; }

        .video {
            position: relative; display: block; width: 100%; padding: 0;
            border: 1px solid #e5e3ec; border-radius: 14px; overflow: hidden;
            background: #000; cursor: pointer; aspect-ratio: 16 / 9;
            font-family: inherit;
        }
        .video img { width: 100%; height: 100%; object-fit: cover; opacity: 0.72; transition: opacity 0.2s; }
        .video:hover img { opacity: 0.9; }
        .video-play {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 64px; height: 64px; border-radius: 50%;
            background: var(--accent); transition: transform 0.2s;
        }
        .video-play::after {
            content: ''; position: absolute; top: 50%; left: 54%;
            transform: translate(-50%, -50%);
            border-style: solid; border-width: 11px 0 11px 18px;
            border-color: transparent transparent transparent #ffffff;
        }
        .video:hover .video-play { transform: translate(-50%, -50%) scale(1.08); }
        .video-title {
            position: absolute; left: 0; right: 0; bottom: 0; padding: 1rem 1.25rem;
            text-align: left; color: #fff; font-size: 0.95rem; font-weight: 600;
            background: linear-gradient(to top, rgba(0, 0, 0, 0.75), transparent);
        }
        .video iframe { width: 100%; height: 100%; border: 0; display: block; }
        .video-loaded { cursor: default; }

        /* ── Callout ── */
        .callout {
            background-color: rgba(91, 42, 158, 0.06);
            border-left: 3px solid var(--accent);
            border-radius: 0 10px 10px 0;
            padding: 1.25rem 1.5rem; margin: 2rem 0;
        }
        .callout p:last-child { margin-bottom: 0; }

        /* ── Table ── */
        .table-scroll { overflow-x: auto; margin: 1.5rem 0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e3ec; }
        th { color: #16161c; font-weight: 600; white-space: nowrap; }
        td { color: #5f5f6b; }

        /* ── FAQ ── */
        .faq-item { border-bottom: 1px solid #e5e3ec; padding: 1.25rem 0; }
        .faq-item:last-child { border-bottom: none; }
        .faq-q { font-weight: 600; color: #16161c; margin-bottom: 0.5rem; }
        .faq-a { color: #5f5f6b; margin-bottom: 0; }

        /* ── CTA ── */
        .cta {
            background-color: #f7f6fa; border: 1px solid #e5e3ec; border-radius: 14px;
            padding: 2.25rem 2.5rem; margin: 3.5rem 0 0;
            display: grid; grid-template-columns: 1fr auto;
            align-items: center; gap: 2rem; overflow: hidden;
        }
        .cta h2 { margin-top: 0; font-size: 1.5rem; }
        .cta p { color: #5f5f6b; margin: 0 0 1.5rem; }
        /* Matches the homepage CTA — text button, not the store badge image. */
        .cta-btn {
            display: inline-flex; align-items: center; gap: 0.55rem;
            height: 56px; padding: 0 1.7rem; border-radius: 12px;
            background: var(--accent); color: #ffffff;
            font-family: inherit; font-size: 1rem; font-weight: 600;
            text-decoration: none; white-space: nowrap;
            transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .cta-btn:hover {
            background: #4a2183; transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(91, 42, 158, 0.22);
        }
        .cta-btn svg {
            width: 1.15em; height: 1.15em; fill: currentColor;
            flex-shrink: 0; margin-top: -0.12em;
        }

        /* Mirrors the homepage hero pairing. */
        .cta-shots { display: flex; align-items: center; justify-content: center; }
        .cta-shots img { width: auto; flex-shrink: 0; }
        .cta-shots img:nth-child(1) {
            height: 300px; position: relative; z-index: 2;
            filter: drop-shadow(0 12px 22px rgba(22, 22, 28, 0.16));
        }
        .cta-shots img:nth-child(2) {
            height: 258px; position: relative; z-index: 1; margin-left: -32px;
            filter: drop-shadow(0 8px 16px rgba(22, 22, 28, 0.10));
        }

        /* ── Related ── */
        .related { margin-top: 3.5rem; padding-top: 2rem; border-top: 1px solid #e5e3ec; }
        .related h2 { font-size: 1.2rem; margin-top: 0; }

        /* ── City cards ── */
        .city-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem; margin-top: 2.5rem;
        }
        .city-card {
            background-color: #f7f6fa; border: 1px solid #e5e3ec; border-radius: 14px;
            padding: 1.75rem; display: block; text-decoration: none;
            transition: border-color 0.2s, transform 0.2s;
        }
        .city-card:hover { border-color: var(--accent); transform: translateY(-3px); }
        .city-card h2 {
            font-size: 1.35rem; font-weight: 700; color: #16161c;
            margin: 0 0 0.15rem; letter-spacing: -0.01em;
        }
        .city-country {
            font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase;
            color: var(--accent); font-weight: 600; margin-bottom: 1.1rem;
        }
        .city-summary { color: #5f5f6b; font-size: 0.95rem; margin: 0; }
        .city-more {
            color: var(--accent); font-size: 0.9rem; font-weight: 600;
            margin: 1.1rem 0 0;
        }

        /* ── Footer ── */
        footer {
            text-align: center; padding: 2.5rem 2rem; border-top: 1px solid #e5e3ec;
            color: #6f6f7a; font-size: 0.9rem;
        }
        footer a { color: #5f5f6b; text-decoration: none; }
        footer a:hover { color: var(--accent); }

        @media (max-width: 768px) {
            .wrap { padding: 2rem 1.25rem 3.5rem; }
            h1 { font-size: 1.9rem; }
            h2 { font-size: 1.35rem; }
            .standfirst { font-size: 1.05rem; }
            .city-grid { grid-template-columns: 1fr; }
            .stop { flex-direction: column; gap: 0.25rem; }
            .stop-time { width: auto; }
            .day { padding: 1.5rem; }
            .cta {
                grid-template-columns: 1fr; gap: 1.75rem;
                padding: 1.75rem 1.5rem; text-align: center;
            }
            .cta-shots img:nth-child(1) { height: 240px; }
            .cta-shots img:nth-child(2) { height: 206px; margin-left: -26px; }
        }`;

// ── head ─────────────────────────────────────────────────────────────────────

function head(site, { title, description, url, ogTitle, jsonld, image }) {
    const img = image || {
        url: `${site.baseUrl}assets/appicon.png`,
        width: 1024, height: 1024, alt: `${site.name} app icon`,
    };
    return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" href="${site.assetPath}appicon.png">
    <link rel="apple-touch-icon" href="${site.assetPath}appicon.png">
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <meta name="description" content="${esc(description)}">
    <meta name="author" content="${esc(site.author.name)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
    <meta name="theme-color" content="${site.themeColor}">

    <link rel="canonical" href="${url}">

    <meta name="apple-itunes-app" content="app-id=${site.appStoreId}">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${esc(site.name)}">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${esc(ogTitle || title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${img.url}">
    <meta property="og:image:width" content="${img.width}">
    <meta property="og:image:height" content="${img.height}">
    <meta property="og:image:alt" content="${esc(img.alt)}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(ogTitle || title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${img.url}">
    <meta name="twitter:image:alt" content="${esc(img.alt)}">

    <script type="application/ld+json">
${JSON.stringify(jsonld, null, 4).split('\n').map(l => '    ' + l).join('\n')}
    </script>
    <style>${STYLES}
    </style>
</head>`;
}

const footer = (site, prefix) => `    <footer>
        <p>&copy; ${new Date().getFullYear()} ${esc(site.name)} &mdash; <a href="${prefix}index.html">Home</a> &middot;
            <a href="${prefix}guides/index.html">City Guides</a> &middot;
            <a href="${prefix}terms.html">Terms</a> &middot; <a href="${prefix}privacy-policy.html">Privacy</a> &middot;
            <a href="${prefix}support.html">Support</a>
        </p>
    </footer>`;

// ── section renderers ────────────────────────────────────────────────────────

const paras = (body) => (Array.isArray(body) ? body : [body])
    .map(p => `        <p>${inline(p)}</p>`).join('\n');

const RENDER = {
    prose: (s) => [
        s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
        paras(s.body),
    ].filter(Boolean).join('\n'),

    list: (s) => {
        const tag = s.ordered ? 'ol' : 'ul';
        return [
            s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
            s.intro && `        <p>${inline(s.intro)}</p>`,
            `        <${tag}>`,
            s.items.map(i => `            <li>${inline(i)}</li>`).join('\n'),
            `        </${tag}>`,
        ].filter(Boolean).join('\n');
    },

    day: (s) => [
        `        <div class="day">`,
        `            <h3>${inline(s.heading)}</h3>`,
        s.note && `            <p class="day-note">${inline(s.note)}</p>`,
        (s.stops || []).map(st => [
            `            <div class="stop">`,
            `                <div class="stop-time">${esc(st.time)}</div>`,
            `                <div><span class="stop-name">${inline(st.name)}</span>`,
            `                    <span class="stop-detail">${inline(st.detail)}</span></div>`,
            `            </div>`,
        ].join('\n')).join('\n'),
        `        </div>`,
    ].filter(Boolean).join('\n'),

    callout: (s) => `        <div class="callout">\n${paras(s.body)}\n        </div>`,

    image: (s) => [
        s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
        `        <figure class="fig">`,
        figImg(s, 'fig-img'),
        figCaption(s),
        `        </figure>`,
    ].filter(Boolean).join('\n'),

    gallery: (s) => [
        s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
        `        <div class="gallery">`,
        ...s.images.map(im => [
            `            <figure class="fig">`,
            figImg(im, 'fig-img', 3),
            figCaption(im, 3),
            `            </figure>`,
        ].filter(Boolean).join('\n')),
        `        </div>`,
    ].filter(Boolean).join('\n'),

    // Click-to-load facade. Nothing is requested from YouTube until the user
    // opts in, which keeps the page fast and avoids setting third-party cookies
    // on arrival. The iframe uses youtube-nocookie.com.
    video: (s) => {
        const poster = s.poster
            ? `../assets/guides/${s.poster}`
            : `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`;
        return [
            s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
            `        <figure class="fig">`,
            `            <button class="video" type="button" data-yt="${esc(s.youtubeId)}"`,
            `                aria-label="Play video: ${esc(s.title)}">`,
            `                <img src="${poster}" alt="" width="480" height="360" loading="lazy" decoding="async">`,
            `                <span class="video-play" aria-hidden="true"></span>`,
            `                <span class="video-title">${esc(s.title)}</span>`,
            `            </button>`,
            figCaption(s),
            `        </figure>`,
        ].filter(Boolean).join('\n');
    },

    table: (s) => [
        s.heading && `        <h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>`,
        `        <div class="table-scroll">`,
        `            <table>`,
        `                <thead><tr>${s.columns.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>`,
        `                <tbody>`,
        s.rows.map(r => `                    <tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n'),
        `                </tbody>`,
        `            </table>`,
        `        </div>`,
    ].filter(Boolean).join('\n'),
};

const slugify = (s) => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** <img> with explicit dimensions so the layout never shifts while it loads. */
function figImg(im, cls, indent = 2) {
    const pad = '    '.repeat(indent + 1);
    return [
        `${pad}<img class="${cls}" src="../assets/guides/${im.src}"`,
        `${pad}    alt="${esc(im.alt)}" width="${im.width}" height="${im.height}"`,
        `${pad}    loading="lazy" decoding="async">`,
    ].join('\n');
}

/**
 * Caption + attribution.
 *
 * Renders full TASL attribution — author, Source, Licence — with the author
 * linked to the source page and the licence linked to its deed. CC licences
 * require visible attribution next to the work and require noting whether the
 * work was modified, hence the `modified` field. This is a compliance feature,
 * not decoration: dropping the links breaks the licence.
 */
function figCaption(im, indent = 2) {
    if (!im.caption && !im.credit) return null;
    const pad = '    '.repeat(indent + 1);
    const link = (text, href) => href
        ? `<a href="${href}" target="_blank" rel="noopener nofollow">${esc(text)}</a>`
        : esc(text);

    let credit = '';
    if (im.credit) {
        // Title first: CC 2.0 and 3.0 require retaining the work's title when one
        // is supplied. (4.0 dropped that, but most Commons files predate it.)
        const head = im.workTitle
            ? `${link(im.workTitle, im.creditUrl)} by ${esc(im.credit)}`
            : link(im.credit, im.creditUrl);
        const parts = [head];
        if (im.license) parts.push(link(im.license, im.licenseUrl));
        credit = `<span class="credit">Photo: ${parts.join(' &middot; ')}` +
            `${im.modified ? `, ${esc(im.modified)}` : ''}</span>`;
    }
    return `${pad}<figcaption>${im.caption ? inline(im.caption) : ''}${credit}</figcaption>`;
}

// ── guide page ───────────────────────────────────────────────────────────────

function renderGuide(site, g, all) {
    const url = `${site.baseUrl}guides/${g.slug}.html`;
    const words = (g.sections || []).reduce((n, s) => {
        let t = [s.heading, s.intro].filter(Boolean).join(' ');
        if (s.body) t += ' ' + (Array.isArray(s.body) ? s.body.join(' ') : s.body);
        if (s.items) t += ' ' + s.items.join(' ');
        if (s.stops) t += ' ' + s.stops.map(x => `${x.name} ${x.detail}`).join(' ');
        if (s.rows) t += ' ' + s.rows.flat().join(' ');
        return n + wordCount(t);
    }, 0) + (g.faq || []).reduce((n, f) => n + wordCount(f.q + ' ' + f.a), 0);

    const graph = [
        {
            '@type': 'Article',
            '@id': `${url}#article`,
            headline: g.title,
            description: g.metaDescription,
            datePublished: g.datePublished,
            dateModified: g.dateModified || g.datePublished,
            author: { '@id': `${site.baseUrl}#author` },
            publisher: { '@id': `${site.baseUrl}#author` },
            image: g.heroImage
                ? `${site.baseUrl}assets/guides/${g.heroImage.src}`
                : `${site.baseUrl}assets/appicon.png`,
            mainEntityOfPage: url,
            isPartOf: { '@id': `${site.baseUrl}#website` },
            wordCount: words,
        },
        {
            '@type': 'BreadcrumbList',
            '@id': `${url}#breadcrumb`,
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: site.baseUrl },
                { '@type': 'ListItem', position: 2, name: 'City Guides', item: `${site.baseUrl}guides/` },
                { '@type': 'ListItem', position: 3, name: g.title, item: url },
            ],
        },
    ];

    // FAQPage is emitted ONLY when the questions are rendered in visible text below.
    if (g.faq && g.faq.length) {
        graph.push({
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: g.faq.map(f => ({
                '@type': 'Question',
                name: plain(f.q),
                acceptedAnswer: { '@type': 'Answer', text: plain(f.a) },
            })),
        });
    }

    // VideoObject is emitted ONLY for video you own and host on this page.
    // Marking up someone else's embedded YouTube video to chase video rich
    // results is a structured-data violation — hence the explicit opt-in.
    for (const s of g.sections || []) {
        if (s.type === 'video' && s.owned) {
            graph.push({
                '@type': 'VideoObject',
                '@id': `${url}#video-${s.youtubeId}`,
                name: s.title,
                description: s.description || s.caption || s.title,
                uploadDate: s.uploadDate || g.datePublished,
                thumbnailUrl: s.poster
                    ? `${site.baseUrl}assets/guides/${s.poster}`
                    : `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`,
                embedUrl: `https://www.youtube-nocookie.com/embed/${s.youtubeId}`,
                ...(s.duration ? { duration: s.duration } : {}),
            });
        }
    }

    const hasVideo = (g.sections || []).some(s => s.type === 'video');

    const related = (g.related || [])
        .map(slug => all.find(x => x.slug === slug))
        .filter(Boolean);

    const body = [
        `    <div class="wrap">`,
        `        <nav class="crumb"><a href="../index.html">Home</a> &rsaquo; <a href="index.html">City Guides</a> &rsaquo; ${esc(g.title)}</nav>`,
        g.eyebrow && `        <p class="eyebrow">${esc(g.eyebrow)}</p>`,
        `        <h1>${inline(g.title)}</h1>`,
        g.standfirst && `        <p class="standfirst">${inline(g.standfirst)}</p>`,
        `        <p class="byline">Updated ${fmtDate(g.dateModified || g.datePublished)} &middot; ${Math.max(1, Math.round(words / 220))} min read</p>`,
        g.heroImage ? [
            `        <figure class="fig">`,
            // Hero is above the fold, so it loads eagerly with high priority.
            `            <img class="fig-img" src="../assets/guides/${g.heroImage.src}"`,
            `                alt="${esc(g.heroImage.alt)}" width="${g.heroImage.width}" height="${g.heroImage.height}"`,
            `                fetchpriority="high" decoding="async">`,
            figCaption(g.heroImage),
            `        </figure>`,
        ].filter(Boolean).join('\n') : null,
        ...(g.sections || []).map(s => {
            const fn = RENDER[s.type];
            if (!fn) throw new Error(`${g.slug}: unknown section type "${s.type}"`);
            return fn(s);
        }),
        g.faq && g.faq.length ? [
            `        <h2 id="faq">${esc(g.faqHeading || 'Common questions')}</h2>`,
            ...g.faq.map(f => [
                `        <div class="faq-item">`,
                `            <p class="faq-q">${inline(f.q)}</p>`,
                `            <p class="faq-a">${inline(f.a)}</p>`,
                `        </div>`,
            ].join('\n')),
        ].join('\n') : null,
        g.cta !== false ? cta(site, g) : null,
        related.length ? [
            `        <div class="related">`,
            `            <h2>Keep planning</h2>`,
            `            <ul>`,
            ...related.map(r => `                <li><a href="${r.slug}.html">${esc(r.title)}</a></li>`),
            `            </ul>`,
            `        </div>`,
        ].join('\n') : null,
        `    </div>`,
    ].filter(Boolean).join('\n');

    return `<!DOCTYPE html>
<!-- GENERATED by build.js — do not edit. Source: content/guides/ -->
<html lang="en">

${head(site, {
        title: g.titleTag || g.title,
        description: g.metaDescription,
        url,
        ogTitle: g.ogTitle,
        image: g.heroImage && {
            url: `${site.baseUrl}assets/guides/${g.heroImage.src}`,
            width: g.heroImage.width, height: g.heroImage.height, alt: g.heroImage.alt,
        },
        jsonld: { '@context': 'https://schema.org', '@graph': graph },
    })}

<body>
${body}
${footer(site, '../')}
${hasVideo ? VIDEO_SCRIPT + '\n' : ''}</body>

</html>
`;
}

function cta(site, g) {
    const c = g.cta || {};
    return [
        `        <div class="cta">`,
        `            <div class="cta-copy">`,
        `                <h2>${esc(c.heading || 'Tailored to your trip')}</h2>`,
        `                <p>${esc(c.body || 'Plan your trip around your real arrival and departure times.')}</p>`,
        `                <a class="cta-btn" href="${site.appStoreUrl}"`,
        `                    onclick="if(window.trackEvent)trackEvent('app_download_click',{app_store:'app_store',placement:'guide_${g.slug}'});"><svg`,
        `                        viewBox="0 0 384 512" aria-hidden="true" focusable="false"><path`,
        `                        d="${APPLE_GLYPH}" /></svg>Download iOS App</a>`,
        `            </div>`,
        // Same overlapping screenshot pair as the homepage hero.
        `            <div class="cta-shots">`,
        `                <img src="../assets/tp_sg1.png" width="1072" height="2215" loading="lazy" decoding="async"`,
        `                    alt="${esc(site.name)} home screen — enter a city, your dates and a pace to generate a plan">`,
        `                <img src="../assets/tp_sg2.png" width="1072" height="2215" loading="lazy" decoding="async"`,
        `                    alt="${esc(site.name)} day-by-day itinerary with timed stops">`,
        `            </div>`,
        `        </div>`,
    ].join('\n');
}

/** Swaps the facade for the real player on click. Emitted only when a video exists. */
const VIDEO_SCRIPT = `    <script>
        document.querySelectorAll('.video').forEach(function (el) {
            el.addEventListener('click', function () {
                var f = document.createElement('iframe');
                f.src = 'https://www.youtube-nocookie.com/embed/' + el.dataset.yt + '?autoplay=1&rel=0';
                f.title = el.querySelector('.video-title').textContent;
                f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
                f.allowFullscreen = true;
                var w = document.createElement('div');
                w.className = 'video video-loaded';
                w.appendChild(f);
                el.replaceWith(w);
            }, { once: true });
        });
    </script>`;

const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});

// ── hub page ─────────────────────────────────────────────────────────────────

function renderHub(site, guides) {
    const url = `${site.baseUrl}guides/`;
    const sorted = [...guides].sort((a, b) =>
        (b.dateModified || b.datePublished).localeCompare(a.dateModified || a.datePublished));

    const graph = [
        {
            '@type': 'CollectionPage',
            '@id': `${url}#collection`,
            name: 'City Guides',
            description: site.hub.metaDescription,
            url,
            isPartOf: { '@id': `${site.baseUrl}#website` },
        },
        {
            '@type': 'ItemList',
            '@id': `${url}#list`,
            itemListElement: sorted.map((g, i) => ({
                '@type': 'ListItem', position: i + 1, name: g.title,
                url: `${site.baseUrl}guides/${g.slug}.html`,
            })),
        },
        {
            '@type': 'BreadcrumbList',
            '@id': `${url}#breadcrumb`,
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: site.baseUrl },
                { '@type': 'ListItem', position: 2, name: 'City Guides', item: url },
            ],
        },
    ];

    // One guide per city. Cities sort alphabetically and the whole card is the link.
    const cities = [...guides].sort((a, b) => a.city.localeCompare(b.city));

    const cards = cities.map(g => [
        `            <a class="city-card" href="${g.slug}.html">`,
        `                <h2>${esc(g.city)}</h2>`,
        g.country && `                <p class="city-country">${esc(g.country)}</p>`,
        `                <p class="city-summary">${esc(g.cardSummary || g.standfirst || g.metaDescription)}</p>`,
        `                <p class="city-more">${esc(g.cardLabel || 'Read the guide')} &rarr;</p>`,
        `            </a>`,
    ].filter(Boolean).join('\n')).join('\n');

    return `<!DOCTYPE html>
<!-- GENERATED by build.js — do not edit. Source: content/guides/ -->
<html lang="en">

${head(site, {
        title: site.hub.titleTag,
        description: site.hub.metaDescription,
        url,
        jsonld: { '@context': 'https://schema.org', '@graph': graph },
    })}

<body>
    <div class="wrap wrap-wide">
        <nav class="crumb"><a href="../index.html">Home</a> &rsaquo; City Guides</nav>
        <p class="eyebrow">${esc(site.hub.eyebrow)}</p>
        <h1>${esc(site.hub.h1)}</h1>
        <p class="standfirst">${esc(site.hub.standfirst)}</p>
        <div class="city-grid">
${cards || '            <p>No guides published yet.</p>'}
        </div>
    </div>
${footer(site, '../')}
</body>

</html>
`;
}

// ── sitemap ──────────────────────────────────────────────────────────────────

function renderSitemap(site, guides) {
    const today = new Date().toISOString().slice(0, 10);
    const entry = (loc, mod, freq, pri) =>
        `    <url>\n        <loc>${loc}</loc>\n        <lastmod>${mod}</lastmod>\n` +
        `        <changefreq>${freq}</changefreq>\n        <priority>${pri}</priority>\n    </url>`;

    const rows = [
        ...site.staticPages.map(p => entry(site.baseUrl + p.path, p.lastmod || today, p.changefreq, p.priority)),
        entry(`${site.baseUrl}guides/`, today, 'weekly', '0.6'),
        ...[...guides]
            .sort((a, b) => a.slug.localeCompare(b.slug))
            .map(g => entry(`${site.baseUrl}guides/${g.slug}.html`,
                g.dateModified || g.datePublished, 'monthly', '0.8')),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join('\n')}
</urlset>
`;
}

// ── validation ───────────────────────────────────────────────────────────────

const REQUIRED = ['slug', 'title', 'titleTag', 'metaDescription', 'primaryQuery',
    'datePublished', 'city', 'sections'];

function validate(g, file, seen) {
    const errs = [];
    for (const k of REQUIRED) if (!g[k]) errs.push(`missing "${k}"`);
    if (g.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) errs.push(`slug "${g.slug}" must be lowercase-hyphenated`);
    if (g.slug && seen.has(g.slug)) errs.push(`duplicate slug "${g.slug}"`);
    if (g.titleTag && g.titleTag.length > 60) errs.push(`titleTag is ${g.titleTag.length} chars (max 60)`);
    if (g.metaDescription) {
        const n = g.metaDescription.length;
        if (n < 120 || n > 160) errs.push(`metaDescription is ${n} chars (want 120-160)`);
    }
    if (g.datePublished && !/^\d{4}-\d{2}-\d{2}$/.test(g.datePublished)) errs.push('datePublished must be YYYY-MM-DD');
    if (errs.length) throw new Error(`${file}:\n  - ${errs.join('\n  - ')}`);
    seen.add(g.slug);
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
    const site = read(path.join(CONTENT, 'site.json'));

    if (!fs.existsSync(GUIDES_SRC)) fs.mkdirSync(GUIDES_SRC, { recursive: true });
    fs.mkdirSync(GUIDES_OUT, { recursive: true });

    const files = fs.readdirSync(GUIDES_SRC).filter(f => f.endsWith('.json')).sort();
    const seen = new Set();
    const guides = files.map(f => {
        const g = read(path.join(GUIDES_SRC, f));
        validate(g, `content/guides/${f}`, seen);
        return g;
    });

    // Warn on dangling related-slugs rather than failing the build.
    for (const g of guides) {
        for (const r of g.related || []) {
            if (!guides.some(x => x.slug === r)) {
                console.warn(`  ! ${g.slug}: related slug "${r}" does not exist — link dropped`);
            }
        }
    }

    for (const g of guides) {
        const out = path.join(GUIDES_OUT, `${g.slug}.html`);
        fs.writeFileSync(out, renderGuide(site, g, guides));
        console.log(`  guides/${g.slug}.html`);
    }

    fs.writeFileSync(path.join(GUIDES_OUT, 'index.html'), renderHub(site, guides));
    console.log(`  guides/index.html`);

    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(site, guides));
    console.log(`  sitemap.xml (${site.staticPages.length + guides.length + 1} urls)`);

    console.log(`\nBuilt ${guides.length} guide${guides.length === 1 ? '' : 's'}.`);
}

try {
    main();
} catch (e) {
    console.error(`\nBuild failed — ${e.message}\n`);
    process.exit(1);
}
