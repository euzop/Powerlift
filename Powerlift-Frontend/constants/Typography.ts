/**
 * Typography constants for consistent font usage across the app
 */

export const FONTS = {
  regular: 'Montserrat-Regular',
  medium: 'Montserrat-Medium',
  semiBold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  black: 'Montserrat-Black',
};

export const SIZES = {
  // Headings
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  
  // Body text
  body1: 16,
  body2: 14,
  
  // Small text
  caption: 12,
  
  // Button text
  button: 16,
};

export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.8,
};

export const LETTER_SPACING = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  extraWide: 1,
};

// Typography styles to use across the app
export const Typography = {
  h1: {
    fontFamily: FONTS.black,
    fontSize: SIZES.h1,
    lineHeight: SIZES.h1 * LINE_HEIGHTS.tight,
  },
  h2: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.h2,
    lineHeight: SIZES.h2 * LINE_HEIGHTS.tight,
  },
  h3: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.h3,
    lineHeight: SIZES.h3 * LINE_HEIGHTS.tight,
  },
  h4: {
    fontFamily: FONTS.semiBold,
    fontSize: SIZES.h4,
    lineHeight: SIZES.h4 * LINE_HEIGHTS.tight,
  },
  h5: {
    fontFamily: FONTS.semiBold,
    fontSize: SIZES.h5,
    lineHeight: SIZES.h5 * LINE_HEIGHTS.normal,
  },
  body1: {
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
    lineHeight: SIZES.body1 * LINE_HEIGHTS.normal,
  },
  body2: {
    fontFamily: FONTS.regular,
    fontSize: SIZES.body2,
    lineHeight: SIZES.body2 * LINE_HEIGHTS.normal,
  },
  caption: {
    fontFamily: FONTS.regular,
    fontSize: SIZES.caption,
    lineHeight: SIZES.caption * LINE_HEIGHTS.normal,
  },
  button: {
    fontFamily: FONTS.semiBold,
    fontSize: SIZES.button,
    lineHeight: SIZES.button * LINE_HEIGHTS.normal,
  },
  buttonSmall: {
    fontFamily: FONTS.medium,
    fontSize: SIZES.body2,
    lineHeight: SIZES.body2 * LINE_HEIGHTS.normal,
  },
}; 