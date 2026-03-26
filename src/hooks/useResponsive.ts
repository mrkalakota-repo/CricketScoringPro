import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  SMALL_PHONE: 380,
  TABLET: 768,
  LARGE_TABLET: 1024,
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSmallPhone: width < BREAKPOINTS.SMALL_PHONE,
    isTablet: width >= BREAKPOINTS.TABLET,
    isLargeTablet: width >= BREAKPOINTS.LARGE_TABLET,
    contentPadding: width < BREAKPOINTS.SMALL_PHONE ? 16 : 24,
    modalMaxWidth: width >= BREAKPOINTS.TABLET ? 500 : undefined,
  };
}
