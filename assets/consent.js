/**
 * Cookie consent banner + Google Consent Mode v2 for owlio.online
 *
 * Firebase Analytics is GA4 underneath: it writes `_ga` / `_ga_<id>` cookies and
 * assigns a pseudonymous client ID. Under the EU ePrivacy Directive that is
 * non-essential storage, so nothing may touch the device before the visitor says yes.
 *
 * Flow:
 *   1. index.html sets Consent Mode defaults to "denied" inline in <head>,
 *      before any other script runs.
 *   2. This file loads, restores a stored decision, and — only on "granted" —
 *      dynamically imports the Firebase module. Deny means Google is never contacted.
 *   3. trackEvent() queues calls until analytics is live, then flushes them.
 *
 * Self-contained: no dependencies, styles injected below. Drop the <script> tag on
 * any page (guides included) and it works.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'owlio_consent_v1';
    var EXPIRY_DAYS = 365;          // re-ask after a year, per EDPB guidance

    // Resolve sibling URLs from this script's own src, so the same tag works from the
    // site root and from /guides/, relative or absolute.
    var BASE = (function () {
        var el = document.currentScript;
        return el ? el.src.replace(/consent\.js(\?.*)?$/, '') : '/assets/';
    })();
    var ANALYTICS_MODULE = BASE + 'firebase-analytics.js';
    var PRIVACY_URL = BASE + '../privacy-policy.html';

    /**
     * false → Firebase is not loaded at all until the visitor accepts (basic consent
     *         mode). Zero requests to Google pre-consent; denied visitors send nothing.
     * true  → Firebase loads immediately with analytics_storage denied (advanced
     *         consent mode). No cookies are written, but cookieless pings still reach
     *         Google, which some EU regulators dislike. Gives you GA4 modelled data.
     */
    var LOAD_BEFORE_CONSENT = false;

    // ── Consent Mode plumbing ────────────────────────────────────────────────
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }

    // Deny everything up front. gtag.js replays dataLayer in order when it eventually
    // loads, so queueing "default denied" here — before any import of the Firebase
    // module — is equivalent to an inline <head> snippet, and keeps each page to one
    // script tag. If you ever add another gtag/GA script to a page, that script must
    // load *after* this one, or move this block back inline into <head>.
    gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        wait_for_update: 500
    });

    function updateConsent(granted) {
        var value = granted ? 'granted' : 'denied';
        gtag('consent', 'update', {
            ad_storage: value,
            ad_user_data: value,
            ad_personalization: value,
            analytics_storage: value
        });
    }

    // ── Stored decision ──────────────────────────────────────────────────────

    function readDecision() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var saved = JSON.parse(raw);
            var age = Date.now() - saved.ts;
            if (age > EXPIRY_DAYS * 864e5) return null;   // expired, ask again
            return saved.status === 'granted' ? 'granted' : 'denied';
        } catch (e) {
            return null;   // private mode, disabled storage, corrupt value
        }
    }

    function writeDecision(status) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: status, ts: Date.now() }));
        } catch (e) {
            /* Storage blocked — the decision holds for this page view only. */
        }
    }

    // ── Analytics loading ────────────────────────────────────────────────────

    var queue = [];
    var loading = false;

    // Capture anything the page fired before we got here (index.html installs a no-op).
    window.trackEvent = function (name, params) {
        queue.push([name, params || {}]);
        flush();
    };

    function flush() {
        if (!window.__owlioAnalytics) return;
        var pending = queue.splice(0, queue.length);
        for (var i = 0; i < pending.length; i++) {
            window.__owlioAnalytics.logEvent(pending[i][0], pending[i][1]);
        }
    }

    function loadAnalytics(granted) {
        if (loading || window.__owlioAnalytics) return;
        loading = true;
        import(ANALYTICS_MODULE)
            .then(function (mod) {
                mod.initAnalytics(granted !== false);
                flush();
            })
            .catch(function () {
                loading = false;   // network/blocker failure — events stay queued
            });
    }

    // ── Banner ───────────────────────────────────────────────────────────────

    var STYLES = [
        '.consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;',
        'max-width:560px;margin:0 auto;background:#fff;color:#1a1a1a;',
        'border:1px solid #e5e3ec;border-radius:16px;padding:20px 22px;',
        'box-shadow:0 12px 40px rgba(26,10,54,.18);',
        'font-family:"Space Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'transform:translateY(140%);transition:transform .35s cubic-bezier(.22,1,.36,1)}',
        '.consent-banner.is-visible{transform:translateY(0)}',
        '.consent-banner h2{margin:0 40px 6px 0;font-size:1rem;font-weight:600;letter-spacing:-.01em}',
        '.consent-banner p{margin:0 0 16px;font-size:.875rem;line-height:1.55;color:#4a4458}',
        '.consent-close{position:absolute;top:14px;right:14px;width:30px;height:30px;',
        'display:flex;align-items:center;justify-content:center;padding:0;',
        'background:none;border:0;border-radius:8px;cursor:pointer;color:#8b8398;',
        'font-size:20px;line-height:1;transition:background .2s ease,color .2s ease}',
        '.consent-close:hover{background:#f6f4fa;color:#1a1a1a}',
        '.consent-close:focus-visible{outline:2px solid #5b2a9e;outline-offset:2px}',
        '.consent-banner a{color:#5b2a9e;text-decoration:underline;text-underline-offset:2px}',
        '.consent-actions{display:flex;gap:10px;flex-wrap:wrap}',
        '.consent-btn{flex:1 1 auto;min-width:130px;padding:11px 18px;border-radius:10px;',
        'font-family:inherit;font-size:.875rem;font-weight:500;cursor:pointer;',
        'border:1px solid transparent;transition:opacity .2s ease,background .2s ease}',
        '.consent-btn:focus-visible{outline:2px solid #5b2a9e;outline-offset:2px}',
        '.consent-accept{background:#5b2a9e;color:#fff}',
        '.consent-accept:hover{opacity:.88}',
        '.consent-reject{background:#fff;color:#1a1a1a;border-color:#d8d4e2}',
        '.consent-reject:hover{background:#f6f4fa}',
        '@media (prefers-reduced-motion:reduce){.consent-banner{transition:none}}',
        '@media (max-width:480px){.consent-banner{padding:18px}.consent-btn{flex:1 1 100%}}'
    ].join('');

    var banner = null;

    function closeBanner() {
        if (!banner) return;
        banner.classList.remove('is-visible');
        var node = banner;
        banner = null;
        setTimeout(function () { node.remove(); }, 400);
    }

    function decide(status) {
        writeDecision(status);
        updateConsent(status === 'granted');
        if (status === 'granted') loadAnalytics(true);
        closeBanner();
    }

    function showBanner() {
        if (banner) return;

        var style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        banner = document.createElement('div');
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.innerHTML =
            '<button type="button" class="consent-close" aria-label="Close and decline">&times;</button>' +
            '<h2>We use cookies</h2>' +
            '<p>We use cookies and similar tracking to understand how the site is used ' +
            'and to improve your browsing experience. Nothing is loaded until you choose, ' +
            'and we never sell your data. ' +
            '<a href="' + PRIVACY_URL + '">Privacy Policy</a></p>' +
            '<div class="consent-actions">' +
            '<button type="button" class="consent-btn consent-accept">Accept</button>' +
            '<button type="button" class="consent-btn consent-reject">Decline</button>' +
            '</div>';

        banner.querySelector('.consent-accept').addEventListener('click', function () { decide('granted'); });
        banner.querySelector('.consent-reject').addEventListener('click', function () { decide('denied'); });

        // Dismissing without choosing can never count as consent, so the X is a decline.
        banner.querySelector('.consent-close').addEventListener('click', function () { decide('denied'); });

        document.body.appendChild(banner);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { banner.classList.add('is-visible'); });
        });
    }

    // Footer "Cookie settings" links call this to change their mind.
    window.openCookieSettings = function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
        updateConsent(false);
        showBanner();
    };

    // ── Boot ─────────────────────────────────────────────────────────────────

    function start() {
        var decision = readDecision();

        if (decision === 'granted') {
            updateConsent(true);
            loadAnalytics(true);
            return;
        }

        if (decision === 'denied') return;   // respect it silently, no banner

        // No decision on file.
        if (LOAD_BEFORE_CONSENT) loadAnalytics(false);
        showBanner();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
