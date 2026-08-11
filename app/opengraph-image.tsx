import { ImageResponse } from 'next/og';

export const alt = 'MenuWright — every menu item, ranked by profit';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The crossed-utensils brand mark (public/logo.svg), inlined as a data URI so
// satori renders the real mark without raster assets.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="25.5" stroke="#5D3EFB" stroke-opacity="0.9" stroke-width="3.8"/><g stroke="#5D3EFB" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 10v20M19 14l3.5-4 3.5 4M19 22h7M19 30h7M22.5 30v24"/><path d="M45.5 10c-5 6-6 12-6 18 0 2.5.6 4.6 1.6 6.4-3.6 1-6 4.4-6 8.6 0 4.9 4 9 8.9 8.9l-8.9 2.1"/></g></svg>`;
const MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`;

/**
 * Branded homepage Open Graph image. The void, the signal, the utensil mark —
 * rendered as a static card in the MenuWright identity: near-black instrument
 * panel, one deliberate point of purple light.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0A0A0A',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Ambient purple glow — the point of light in the void. */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            left: '50%',
            width: 1000,
            height: 560,
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse, rgba(93,62,251,0.16), transparent 65%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 90px' }}>
          <img
            src={MARK_URI}
            width={96}
            height={96}
            style={{ marginBottom: 32, borderRadius: 20 }}
            alt=""
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: '#5D3EFB',
                display: 'flex',
              }}
            />
            <span
              style={{
                color: '#5D3EFB',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 6,
                textTransform: 'uppercase',
              }}
            >
              MenuWright
            </span>
          </div>

          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: '#FFFFFF',
            }}
          >
            Every menu item,
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: '#5D3EFB',
            }}
          >
            ranked by profit.
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 40,
              color: '#8F8F8F',
              fontSize: 26,
            }}
          >
            Menu engineering for independent restaurants — matrix analysis, dollar-impact recommendations
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
