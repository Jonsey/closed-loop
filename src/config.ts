/** Public site configuration. Nothing here is secret. */

/**
 * Cloudflare Turnstile site key (public — the widget renders it in the page).
 * Override at build time with PUBLIC_TURNSTILE_SITE_KEY, e.g. Cloudflare's
 * always-pass test key 1x00000000000000000000AA for `wrangler dev`.
 */
export const TURNSTILE_SITE_KEY: string = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFAMSNTlTVhsZyP9';

/** The published contact address. Email Routing forwards it. */
export const CONTACT_EMAIL = 'hello@closed-loop.dev';
