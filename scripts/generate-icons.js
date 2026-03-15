#!/usr/bin/env node
/**
 * generate-icons.js — converts assets/icon.svg into all required PNG assets.
 *
 * Prerequisites:
 *   npm install --save-dev sharp
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * Outputs:
 *   assets/icon.png                      1024×1024  (app icon)
 *   assets/splash-icon.png               1024×1024  (splash screen)
 *   assets/favicon.png                   196×196    (web favicon)
 *   assets/android-icon-foreground.png   1024×1024  (adaptive icon foreground)
 *   assets/android-icon-monochrome.png   1024×1024  (monochrome, white on transparent)
 *   assets/android-icon-background.png   1024×1024  (solid teal background)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets/icon.svg');
const OUT = path.join(__dirname, '../assets');

const TEAL = { r: 0, g: 105, b: 92, alpha: 1 };

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('icon.svg not found at', SRC);
    process.exit(1);
  }

  console.log('Generating icons from', SRC);

  // Standard app icon + splash
  await sharp(SRC).resize(1024, 1024).toFile(path.join(OUT, 'icon.png'));
  console.log('✓ icon.png');

  await sharp(SRC).resize(1024, 1024).toFile(path.join(OUT, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  // Web favicon
  await sharp(SRC).resize(196, 196).toFile(path.join(OUT, 'favicon.png'));
  console.log('✓ favicon.png');

  // Android adaptive icon foreground (icon on transparent bg)
  await sharp(SRC).resize(1024, 1024).toFile(path.join(OUT, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');

  // Android adaptive icon background (solid teal)
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: TEAL },
  })
    .png()
    .toFile(path.join(OUT, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  // Android monochrome icon (white silhouette on transparent)
  await sharp(SRC)
    .resize(1024, 1024)
    .greyscale()
    .threshold(128)
    .toFile(path.join(OUT, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');

  console.log('\nAll icons generated successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
