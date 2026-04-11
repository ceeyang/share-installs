/**
 * @fileoverview Validation script to ensure fingerprint signals collected
 * by JS, Android, and iOS SDKs are consistent and matchable.
 */

interface FingerprintSignal {
    platform: string;
    userAgent: string;
    language: string;
    timezone: string;
    screen: { w: number; h: number };
}

// Sample signals captured from real devices/simulators
const sampleSignals: FingerprintSignal[] = [
    {
        platform: 'ios',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        language: 'en-US',
        timezone: 'America/New_York',
        screen: { w: 390, h: 844 }
    },
    {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
        language: 'en-US',
        timezone: 'America/New_York',
        screen: { w: 1080, h: 2400 }
    },
    {
        platform: 'js',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        language: 'en-US',
        timezone: 'America/New_York',
        screen: { w: 390, h: 844 }
    }
];

function calculateSimilarity(a: FingerprintSignal, b: FingerprintSignal): number {
    let score = 0;
    let total = 0;

    // Timezone should match exactly
    score += (a.timezone === b.timezone ? 1 : 0);
    total += 1;

    // Language should match base locale
    const langA = a.language.split('-')[0];
    const langB = b.language.split('-')[0];
    score += (langA === langB ? 1 : 0);
    total += 1;

    // User agent similarity (simplified)
    const uaA = a.userAgent.toLowerCase();
    const uaB = b.userAgent.toLowerCase();
    if (uaA === uaB) {
        score += 1;
    } else if (uaA.includes('iphone') && uaB.includes('iphone')) {
        score += 0.8;
    } else if (uaA.includes('android') && uaB.includes('android')) {
        score += 0.8;
    }
    total += 1;

    return score / total;
}

console.log('--- Cross-Platform Fingerprint Consistency Check ---');

for (let i = 0; i < sampleSignals.length; i++) {
    for (let j = i + 1; j < sampleSignals.length; j++) {
        const s1 = sampleSignals[i];
        const s2 = sampleSignals[j];
        const sim = calculateSimilarity(s1, s2);
        console.log(`Matching [${s1.platform}] vs [${s2.platform}]: Similarity = ${(sim * 100).toFixed(1)}%`);
        
        if (sim >= 0.8) {
            console.log('  ✅ High confidence match');
        } else if (sim >= 0.5) {
            console.log('  ⚠️ Probable match, check for signal drifting');
        } else {
            console.log('  ❌ Unlikely match');
        }
    }
}
