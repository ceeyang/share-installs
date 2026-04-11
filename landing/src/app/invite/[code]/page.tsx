/**
 * @fileoverview Invite landing page.
 *
 * Flow:
 * 1. Server renders the page with invite data (SSR/ISR).
 * 2. Client-side JS calls trackClick API with browser fingerprint signals.
 * 3. Page redirects user to App Store or Google Play (or deep links into app).
 *
 * URL: https://yourdomain.com/invite/{code}
 */

import {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {fetchInviteByCode} from '../../../lib/api.js';
import {InviteLandingClient} from '../../../components/InviteLandingClient.js';

interface PageProps {
  params: {code: string};
}

/** Generate Open Graph metadata for rich link previews when shared. */
export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const invite = await fetchInviteByCode(params.code);
  const appName = invite?.app.name ?? 'Our App';

  return {
    title: `You've been invited to ${appName}!`,
    description: `Click to download ${appName} and get started with your referral.`,
    openGraph: {
      title: `You've been invited to ${appName}!`,
      description: `Someone shared their referral link to ${appName} with you.`,
      type: 'website',
    },
  };
}

export default async function InvitePage({params}: PageProps) {
  const invite = await fetchInviteByCode(params.code);

  if (!invite) {
    notFound();
  }

  return (
    <InviteLandingClient
      inviteCode={params.code}
      appName={invite.app.name}
      appStoreUrl={invite.app.appStoreUrl}
      playStoreUrl={invite.app.playStoreUrl}
      iosScheme={invite.app.iosScheme}
      androidScheme={invite.app.androidScheme}
    />
  );
}
