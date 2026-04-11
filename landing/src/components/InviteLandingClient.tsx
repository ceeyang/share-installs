'use client';

/**
 * @fileoverview Client component for the invite landing page.
 *
 * Handles:
 * - Fingerprint signal collection
 * - Click tracking API call
 * - Platform detection and redirect to App Store / Google Play
 * - Universal link / deep link fallback
 */

import {useEffect, useState} from 'react';

interface Props {
  inviteCode: string;
  appName: string;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  iosScheme: string | null;
  androidScheme: string | null;
}

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

async function trackClick(inviteCode: string): Promise<void> {
  try {
    const payload = {
      inviteCode,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer,
    };

    await fetch('/api/track', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking — tracking failure should not prevent redirect
  }
}

export function InviteLandingClient({
  inviteCode,
  appName,
  appStoreUrl,
  playStoreUrl,
  iosScheme,
  androidScheme,
}: Props) {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [countdown, setCountdown] = useState(3);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    // Track the click (non-blocking)
    void trackClick(inviteCode);

    // Attempt to open the app via Universal Link / Custom Scheme
    // then fall back to the app store after a short delay
    if (detected === 'ios' || detected === 'android') {
      const scheme = detected === 'ios' ? iosScheme : androidScheme;
      const storeUrl = detected === 'ios' ? appStoreUrl : playStoreUrl;

      // Try deep link first
      if (scheme) {
        window.location.href = `${scheme}://invite?code=${inviteCode}`;
      }

      // Countdown then redirect to store
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            if (storeUrl) {
              window.location.href = storeUrl;
              setRedirected(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [inviteCode, appStoreUrl, playStoreUrl, iosScheme, androidScheme]);

  const storeUrl = platform === 'ios' ? appStoreUrl : playStoreUrl;
  const storeName = platform === 'ios' ? 'App Store' : 'Google Play';

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{fontSize: '4rem', marginBottom: '1rem'}}>🎉</div>
        <h1 style={{fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem'}}>
          You've been invited!
        </h1>
        <p style={{fontSize: '1.1rem', opacity: 0.9, marginBottom: '2rem'}}>
          Someone invited you to join <strong>{appName}</strong>.
          Download the app to get started with your invite code.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          fontFamily: 'monospace',
          fontSize: '1.5rem',
          fontWeight: '700',
          letterSpacing: '0.1em',
        }}>
          {inviteCode}
        </div>

        {platform !== 'desktop' && !redirected && storeUrl && (
          <p style={{marginBottom: '1.5rem', opacity: 0.85}}>
            Redirecting to {storeName} in <strong>{countdown}</strong>s...
          </p>
        )}

        {storeUrl && (
          <a
            href={storeUrl}
            style={{
              display: 'inline-block',
              background: 'white',
              color: '#764ba2',
              fontWeight: '700',
              padding: '1rem 2.5rem',
              borderRadius: '50px',
              textDecoration: 'none',
              fontSize: '1.1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {platform === 'ios' ? '📱 Download on App Store' :
             platform === 'android' ? '📱 Get it on Google Play' :
             '📱 Download the App'}
          </a>
        )}

        {platform === 'desktop' && (
          <p style={{marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem'}}>
            Open this link on your mobile device to get the app.
          </p>
        )}
      </div>
    </main>
  );
}
