/**
 * @fileoverview Server-side API helpers for the landing page.
 */

const API_BASE_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
const API_KEY = process.env.API_KEY ?? '';

export interface InviteData {
  id: string;
  code: string;
  status: string;
  expiresAt: string | null;
  customData: Record<string, unknown> | null;
  app: {
    name: string;
    appStoreUrl: string | null;
    playStoreUrl: string | null;
    iosScheme: string | null;
    androidScheme: string | null;
  };
}

/**
 * Fetches invite data server-side for SSR.
 * Called in Next.js Server Component / generateMetadata.
 */
export async function fetchInviteByCode(code: string): Promise<InviteData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/invites/${code}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
      },
      next: {revalidate: 60}, // ISR: cache for 60 seconds
    });

    if (!res.ok) return null;

    const {invite} = await res.json();
    return invite as InviteData;
  } catch {
    return null;
  }
}
