// Generates assets/icon.png, assets/adaptive-icon.png, and assets/favicon.png
// from the embedded SVG. Run with: node scripts/generate-icon.js

const sharp = require('sharp');
const path = require('path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#1E7A30"/>
      <stop offset="100%" stop-color="#0D4D1A"/>
    </linearGradient>
    <linearGradient id="stumpGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#B5722A"/>
      <stop offset="35%"  stop-color="#E8A84A"/>
      <stop offset="65%"  stop-color="#D49038"/>
      <stop offset="100%" stop-color="#9A5E1E"/>
    </linearGradient>
    <linearGradient id="batBlade" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#A87820"/>
      <stop offset="30%"  stop-color="#E8C050"/>
      <stop offset="60%"  stop-color="#D4A83C"/>
      <stop offset="100%" stop-color="#906018"/>
    </linearGradient>
    <radialGradient id="ballGrad" cx="38%" cy="35%" r="62%">
      <stop offset="0%"   stop-color="#FF6B5B"/>
      <stop offset="100%" stop-color="#BB1A0E"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="210" fill="url(#bg)"/>

  <!-- Ground shadow -->
  <ellipse cx="512" cy="870" rx="370" ry="35" fill="rgba(0,0,0,0.35)"/>

  <!-- ══════════════════════════════════
       STUMPS  (centred, prominent)
  ══════════════════════════════════ -->

  <!-- Stump Left -->
  <rect x="302" y="178" width="64" height="610" rx="14"
        fill="url(#stumpGrad)" stroke="#3D1E06" stroke-width="12"/>
  <!-- wood grain -->
  <line x1="320" y1="200" x2="320" y2="775" stroke="rgba(0,0,0,0.13)" stroke-width="5"/>
  <line x1="348" y1="200" x2="348" y2="775" stroke="rgba(255,255,255,0.10)" stroke-width="3"/>

  <!-- Stump Centre -->
  <rect x="480" y="178" width="64" height="610" rx="14"
        fill="url(#stumpGrad)" stroke="#3D1E06" stroke-width="12"/>
  <line x1="498" y1="200" x2="498" y2="775" stroke="rgba(0,0,0,0.13)" stroke-width="5"/>
  <line x1="526" y1="200" x2="526" y2="775" stroke="rgba(255,255,255,0.10)" stroke-width="3"/>

  <!-- Stump Right -->
  <rect x="658" y="178" width="64" height="610" rx="14"
        fill="url(#stumpGrad)" stroke="#3D1E06" stroke-width="12"/>
  <line x1="676" y1="200" x2="676" y2="775" stroke="rgba(0,0,0,0.13)" stroke-width="5"/>
  <line x1="704" y1="200" x2="704" y2="775" stroke="rgba(255,255,255,0.10)" stroke-width="3"/>

  <!-- Bail Left (between stump 1 and 2) -->
  <rect x="292" y="155" width="266" height="36" rx="18"
        fill="#7B3A10" stroke="#3D1E06" stroke-width="10"/>
  <rect x="300" y="160" width="250" height="16" rx="8"
        fill="rgba(255,255,255,0.15)"/>

  <!-- Bail Right (between stump 2 and 3) -->
  <rect x="470" y="155" width="266" height="36" rx="18"
        fill="#7B3A10" stroke="#3D1E06" stroke-width="10"/>
  <rect x="478" y="160" width="250" height="16" rx="8"
        fill="rgba(255,255,255,0.15)"/>

  <!-- ══════════════════════════════════
       BAT  (leaning diagonally on stumps)
  ══════════════════════════════════ -->
  <g transform="translate(480,505) rotate(-37)">

    <!-- Handle cap -->
    <ellipse cx="0" cy="-418" rx="26" ry="14"
             fill="#222" stroke="#111" stroke-width="7"/>

    <!-- Handle (dark grip with bands) -->
    <rect x="-22" y="-418" width="44" height="200" rx="22"
          fill="#1A1A2A" stroke="#111" stroke-width="8"/>
    <!-- grip bands -->
    <rect x="-17" y="-408" width="34" height="26" rx="13" fill="#3D3570" opacity="0.75"/>
    <rect x="-17" y="-372" width="34" height="26" rx="13" fill="#3D3570" opacity="0.75"/>
    <rect x="-17" y="-336" width="34" height="26" rx="13" fill="#3D3570" opacity="0.75"/>
    <rect x="-17" y="-300" width="34" height="26" rx="13" fill="#3D3570" opacity="0.75"/>
    <rect x="-17" y="-264" width="34" height="26" rx="13" fill="#3D3570" opacity="0.75"/>

    <!-- Splice (shoulder) -->
    <path d="M -22,-218 L 22,-218 L 86,-165 L -86,-165 Z"
          fill="#C8922A" stroke="#3D1E06" stroke-width="9"/>

    <!-- Blade body -->
    <rect x="-86" y="-167" width="172" height="460" rx="22"
          fill="url(#batBlade)" stroke="#3D1E06" stroke-width="11"/>

    <!-- Left edge highlight -->
    <rect x="-86" y="-167" width="28" height="460" rx="14"
          fill="rgba(255,255,255,0.28)"/>
    <!-- Right edge shadow -->
    <rect x="58"  y="-167" width="28" height="460" rx="14"
          fill="rgba(0,0,0,0.16)"/>

    <!-- Brand logo — red diamond shield (like in reference) -->
    <path d="M 0,-45 L 58,22 L 0,100 L -58,22 Z"
          fill="#CC2020" stroke="#7A0000" stroke-width="7"/>
    <path d="M 0,-18 L 37,22 L 0,70 L -37,22 Z"
          fill="#EE3333"/>
    <!-- inner highlight on diamond -->
    <path d="M -20,10 L 0,-10 L 20,10"
          stroke="rgba(255,200,200,0.55)" stroke-width="5" fill="none" stroke-linecap="round"/>

    <!-- Toe -->
    <ellipse cx="0" cy="293" rx="86" ry="28"
             fill="#C08A22" stroke="#3D1E06" stroke-width="9"/>
  </g>

  <!-- ══════════════════════════════════
       BALL  (bottom-left)
  ══════════════════════════════════ -->
  <circle cx="218" cy="770" r="108"
          fill="url(#ballGrad)" stroke="#8B0000" stroke-width="10"/>
  <!-- seam -->
  <path d="M 124,770 Q 155,700 186,770 Q 217,840 248,770 Q 279,700 312,770"
        stroke="rgba(255,255,255,0.92)" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M 124,770 Q 155,840 186,770 Q 217,700 248,770 Q 279,840 312,770"
        stroke="rgba(255,255,255,0.50)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- ball gloss -->
  <ellipse cx="182" cy="718" rx="32" ry="22"
           fill="rgba(255,255,255,0.32)" transform="rotate(-20,182,718)"/>

  <!-- ══════════════════════════════════
       GRASS / LEAVES
  ══════════════════════════════════ -->
  <!-- left cluster -->
  <path d="M 148,860 Q 132,790 118,840 Q 104,775 92,820 Q 86,798 78,830"
        stroke="#2A8B38" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path d="M 195,870 Q 208,810 220,855"
        stroke="#348A40" stroke-width="17" fill="none" stroke-linecap="round"/>
  <!-- right cluster -->
  <path d="M 750,855 Q 764,788 778,835 Q 792,775 806,820"
        stroke="#2A8B38" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path d="M 840,865 Q 855,800 868,848"
        stroke="#348A40" stroke-width="17" fill="none" stroke-linecap="round"/>

  <!-- ══════════════════════════════════
       SPARKLES  (4-point stars + dots)
  ══════════════════════════════════ -->
  <!-- large star top-right -->
  <path d="M 840,190 L 852,214 L 876,226 L 852,238 L 840,262 L 828,238 L 804,226 L 828,214 Z"
        fill="#FFD700" stroke="#E69500" stroke-width="4"/>
  <!-- medium star upper-left -->
  <path d="M 160,310 L 169,328 L 187,337 L 169,346 L 160,364 L 151,346 L 133,337 L 151,328 Z"
        fill="#FFD700" stroke="#E69500" stroke-width="3"/>
  <!-- small star centre-right -->
  <path d="M 778,338 L 784,350 L 796,356 L 784,362 L 778,374 L 772,362 L 760,356 L 772,350 Z"
        fill="#FFA500" stroke="#CC7700" stroke-width="3"/>
  <!-- dot sparkles -->
  <circle cx="890" cy="340" r="11" fill="#FFD700"/>
  <circle cx="130" cy="220" r="8"  fill="#FFA500"/>
  <circle cx="762" cy="268" r="7"  fill="#FFD700"/>
  <circle cx="168" cy="400" r="6"  fill="#FFD700" opacity="0.7"/>
</svg>
`;

async function generate() {
  const buf = Buffer.from(svg);
  const assetsDir = path.join(__dirname, '..', 'assets');

  // icon.png — 1024×1024 (App Store / Play Store)
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓ assets/icon.png');

  // adaptive-icon.png — 1024×1024 (Android adaptive, foreground)
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ assets/adaptive-icon.png');

  // android-icon-foreground.png
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(assetsDir, 'android-icon-foreground.png'));
  console.log('✓ assets/android-icon-foreground.png');

  // favicon.png — 196×196
  await sharp(buf).resize(196, 196).png().toFile(path.join(assetsDir, 'favicon.png'));
  console.log('✓ assets/favicon.png');

  // splash-icon.png — 200×200 (small version for splash)
  await sharp(buf).resize(200, 200).png().toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('✓ assets/splash-icon.png');

  console.log('\nAll icon assets generated.');
}

generate().catch(err => { console.error(err); process.exit(1); });
