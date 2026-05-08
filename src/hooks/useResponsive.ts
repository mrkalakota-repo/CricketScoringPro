import { useWindowDimensions, PixelRatio } from 'react-native';

export const BREAKPOINTS = {
  SMALL_PHONE: 380,
  TABLET: 768,
  LARGE_TABLET: 1024,
};

// Design baseline: 390pt wide (iPhone 14 / Pixel 7 logical width)
const BASE_WIDTH = 390;

/**
 * Returns a set of responsive helpers derived from the current window dimensions.
 *
 * scale(n)  — scales a dp/pt value proportionally to screen width
 * sp(n)     — scales a font size, then clamps to the OS accessibility font scale
 *             so the user's "Large Text" preference is always respected
 * icon(n)   — same as scale but with a tighter clamp for icon sizes
 * vs(n)     — vertical scale (height-based), used for spacing/padding
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const ratio = width / BASE_WIDTH;
  // Clamp: never shrink below 0.85× (very small phones) or grow above 1.4× (large tablets)
  const clampedRatio = Math.min(Math.max(ratio, 0.85), 1.4);

  const fontScale = PixelRatio.getFontScale();

  function scale(size: number): number {
    return Math.round(size * clampedRatio);
  }

  // Font: scale by screen width, then respect OS font-scale setting
  // We divide by fontScale here because RN already applies fontScale automatically
  // to Text components — this prevents double-scaling on accessibility sizes
  function sp(size: number): number {
    return Math.round((size * clampedRatio) / fontScale);
  }

  function icon(size: number): number {
    // Icons: tighter clamp (0.9–1.25) so they don't balloon on tablets
    const iconRatio = Math.min(Math.max(ratio, 0.9), 1.25);
    return Math.round(size * iconRatio);
  }

  function vs(size: number): number {
    const vRatio = Math.min(Math.max(height / 844, 0.85), 1.3); // baseline: iPhone 14 height
    return Math.round(size * vRatio);
  }

  return {
    width,
    height,
    isSmallPhone: width < BREAKPOINTS.SMALL_PHONE,
    isTablet: width >= BREAKPOINTS.TABLET,
    isLargeTablet: width >= BREAKPOINTS.LARGE_TABLET,
    contentPadding: scale(width < BREAKPOINTS.SMALL_PHONE ? 16 : 24),
    modalMaxWidth: width >= BREAKPOINTS.TABLET ? 500 : undefined,
    scale,
    sp,
    icon,
    vs,
    fontScale,
  };
}
