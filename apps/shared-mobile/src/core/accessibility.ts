/**
 * RestaurantOS Accessibility (a11y) Helpers
 * 
 * Standards:
 * - WCAG 2.1 AA Compliance
 * - Minimum 48dp Touch Targets
 * - Screen Reader Semantics (TalkBack / VoiceOver)
 * - Safe Font Scaling & High-Contrast Enforcement
 */

import { AccessibilityRole, AccessibilityState, ViewStyle } from "react-native";
import { touchTargets } from "../tokens/tokens";

export interface A11yOptions {
  label: string;
  role?: AccessibilityRole;
  hint?: string;
  state?: AccessibilityState;
  value?: { min?: number; max?: number; now?: number; text?: string };
}

/**
 * Generates standardized React Native accessibility props.
 */
export function a11yProps(options: A11yOptions) {
  return {
    accessible: true,
    accessibilityLabel: options.label,
    accessibilityRole: options.role,
    accessibilityHint: options.hint,
    accessibilityState: options.state,
    accessibilityValue: options.value,
  };
}

/**
 * Returns a style enforcing the minimum 48dp touch target geometry.
 */
export function touchTargetStyle(minSize: number = touchTargets.min): ViewStyle {
  return {
    minHeight: minSize,
    minWidth: minSize,
    justifyContent: "center",
    alignItems: "center",
  };
}

/**
 * Clamps maximum font scaling to prevent operational text truncation during font zoom.
 * Allows user-configured accessibility scaling up to 1.5x, preventing layout destruction.
 */
export const MAX_FONT_SCALE = 1.5;

export const a11yTextProps = {
  maxFontSizeMultiplier: MAX_FONT_SCALE,
  allowFontScaling: true,
};
