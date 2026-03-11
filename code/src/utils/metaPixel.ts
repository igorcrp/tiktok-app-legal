/**
 * Meta Pixel tracking utilities.
 * Centralizes currency/value logic and Advanced Matching for consistent event tracking.
 * All fbq() calls are guarded with typeof checks to be safe against AdBlockers.
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

/** Safe fbq wrapper — no-op if Pixel is blocked or not loaded yet */
function safeFbq(...args: Parameters<typeof window.fbq>): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

/**
 * Simple SHA-256 hash for Advanced Matching.
 * Meta requires lowercase, trimmed, hashed values.
 */
async function sha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the checkout params (value + currency) based on the user's
 * detected locale stored in localStorage (set via ?ref=br or timezone detection).
 */
export function getCheckoutParams(): { value: number; currency: string } {
  const storedCurrency = localStorage.getItem('checkout_currency') || 'usd';
  const isBRL = storedCurrency === 'brl';
  return {
    value: isBRL ? 187.00 : 39.00,
    currency: isBRL ? 'BRL' : 'USD',
  };
}

/**
 * Builds Advanced Matching params from user data.
 * Hashes PII fields (email, name) before sending to Meta.
 * Returns a plain object — Meta processes the hashed values server-side.
 */
export async function buildAdvancedMatchingParams(user?: {
  email?: string | null;
  full_name?: string | null;
}): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  if (!user) return params;

  if (user.email) {
    params.em = await sha256(user.email);
  }

  if (user.full_name) {
    const parts = user.full_name.trim().split(' ');
    if (parts.length >= 1) params.fn = await sha256(parts[0]);
    if (parts.length >= 2) params.ln = await sha256(parts[parts.length - 1]);
  }

  return params;
}

// ─── Core Events ────────────────────────────────────────────────────────────

/**
 * Fires fbq('track', 'InitiateCheckout') with the correct value/currency
 * for the Premium plan, optionally enriched with Advanced Matching data.
 */
export async function fireInitiateCheckout(user?: {
  email?: string | null;
  full_name?: string | null;
}): Promise<void> {
  const checkoutParams = getCheckoutParams();
  const advancedParams = await buildAdvancedMatchingParams(user);
  safeFbq('track', 'InitiateCheckout', { ...checkoutParams, ...advancedParams });
}

/**
 * Fires fbq('track', 'CompleteRegistration') with value 0.00,
 * optionally enriched with Advanced Matching data.
 */
export async function fireCompleteRegistration(user?: {
  email?: string | null;
  full_name?: string | null;
}): Promise<void> {
  const { currency } = getCheckoutParams();
  const advancedParams = await buildAdvancedMatchingParams(user);
  safeFbq('track', 'CompleteRegistration', { value: 0.00, currency, ...advancedParams });
}

/**
 * Fires fbq('track', 'Purchase') with the given value/currency.
 * Used on Stripe checkout success return.
 */
export function firePurchase(value: number, currency: string): void {
  safeFbq('track', 'Purchase', { value, currency });
}

// ─── Micro-Conversion Events ─────────────────────────────────────────────────

/**
 * Fires fbq('track', 'ViewContent') when the user enters a key area.
 * @param contentName - Human-readable label for what was viewed (e.g. 'Dashboard', 'DaytradePage')
 */
export function fireViewContent(contentName: string): void {
  safeFbq('track', 'ViewContent', { content_name: contentName });
}

/**
 * Fires fbq('track', 'Lead') when a user demonstrates clear purchase intent,
 * e.g. completing their profile setup.
 */
export function fireLead(user?: {
  email?: string | null;
}): void {
  const { currency } = getCheckoutParams();
  safeFbq('track', 'Lead', { value: 0.00, currency });
}

/**
 * Fires fbq('track', 'CustomizeProduct') when a user interacts with
 * strategy/plan configuration, signaling product exploration intent.
 * @param strategyName - The strategy or plan being configured
 */
export function fireCustomizeProduct(strategyName: string): void {
  safeFbq('track', 'CustomizeProduct', { content_name: strategyName });
}
