#!/usr/bin/env node
/**
 * PWA Asset Generator Script
 *
 * Generates all required PWA icons and splash screens from source images.
 *
 * Usage: npm run generate-pwa-assets
 *
 * Requirements:
 * - sharp: npm install --save-dev sharp
 *
 * Source files needed:
 * - app/icon.png (512x512 or larger, square)
 */

import sharp from 'sharp';
import { mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SOURCE_ICON = join(ROOT_DIR, 'app', 'icon.png');
const ICONS_DIR = join(ROOT_DIR, 'public', 'icons');
const SPLASH_DIR = join(ROOT_DIR, 'public', 'splash');

// Icon sizes needed for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// iOS splash screen sizes (width x height)
const SPLASH_SCREENS = [
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png' }, // 12.9" iPad Pro
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png' }, // 11" iPad Pro
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png' }, // 9.7" iPad
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png' }, // iPhone 14 Pro Max
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png' }, // iPhone 14 Pro
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png' }, // iPhone 12/13/14
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png' }, // iPhone X/XS/11 Pro
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png' }, // iPhone XS Max/11 Pro Max
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png' },   // iPhone XR/11
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208.png' }, // iPhone 6+/7+/8+
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png' },   // iPhone 6/7/8
  { width: 640, height: 1136, name: 'apple-splash-640-1136.png' },   // iPhone 5/SE
];

// Brand colors
const BACKGROUND_COLOR = '#0a0a0a';
const ICON_PADDING = 0.15; // 15% padding for maskable icons

async function ensureDir(dir) {
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

async function generateIcons() {
  console.log('Generating PWA icons...');
  await ensureDir(ICONS_DIR);

  for (const size of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, `icon-${size}x${size}.png`);

    // For maskable icons, add padding
    const padding = Math.round(size * ICON_PADDING);
    const iconSize = size - (padding * 2);

    await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  Generated: icon-${size}x${size}.png`);
  }

  // Generate Apple touch icon (180x180)
  await sharp(SOURCE_ICON)
    .resize(180, 180, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(join(ICONS_DIR, 'apple-touch-icon.png'));

  console.log('  Generated: apple-touch-icon.png');
}

async function generateSplashScreens() {
  console.log('Generating iOS splash screens...');
  await ensureDir(SPLASH_DIR);

  for (const { width, height, name } of SPLASH_SCREENS) {
    const outputPath = join(SPLASH_DIR, name);

    // Calculate icon size (about 20% of the smallest dimension)
    const iconSize = Math.round(Math.min(width, height) * 0.2);

    // Create the icon with resize
    const iconBuffer = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 0 } })
      .png()
      .toBuffer();

    // Create splash screen with centered icon
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      }
    })
    .composite([{
      input: iconBuffer,
      gravity: 'center'
    }])
    .png()
    .toFile(outputPath);

    console.log(`  Generated: ${name}`);
  }
}

async function main() {
  try {
    // Check if source icon exists
    await access(SOURCE_ICON);

    console.log('Starting PWA asset generation...\n');

    await generateIcons();
    console.log('');
    await generateSplashScreens();

    console.log('\nPWA assets generated successfully!');
    console.log(`Icons: ${ICONS_DIR}`);
    console.log(`Splash screens: ${SPLASH_DIR}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Source icon not found at ${SOURCE_ICON}`);
      console.error('Please ensure you have a 512x512 (or larger) icon.png in the app/ directory.');
    } else {
      console.error('Error generating PWA assets:', error);
    }
    process.exit(1);
  }
}

main();
