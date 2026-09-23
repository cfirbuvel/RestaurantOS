/**
 * RestaurantOS Manager Mobile Design Tokens & Theme
 * 
 * [PHASE 18 MIGRATION SHIM]
 * Connected to @restaurantos/shared-mobile canonical design system.
 * See docs/MOBILE_DESIGN_SYSTEM.md for migration tracking.
 */

import {
  colors as sharedColors,
  spacing as sharedSpacing,
  typography as sharedTypography,
  borderRadius as sharedBorderRadius,
  touchTargets,
} from "@restaurantos/shared-mobile";

export const colors = {
  ...sharedColors,
  // Interactive Elements backward-compat mappings
  buttonPrimary: sharedColors.button.primaryBg,
  buttonPrimaryText: sharedColors.button.primaryText,
  buttonSecondary: sharedColors.button.secondaryBg,
  buttonSecondaryText: sharedColors.button.secondaryText,
  buttonDanger: sharedColors.button.dangerBg,
  buttonDangerText: sharedColors.button.dangerText,
  buttonSuccess: sharedColors.button.successBg,
  buttonSuccessText: sharedColors.button.successText,
};

export const spacing = {
  ...sharedSpacing,
  touchTargetMin: touchTargets.min,
};

export const typography = sharedTypography;
export const borderRadius = sharedBorderRadius;
