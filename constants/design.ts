/**
 * Shared design tokens for the dark, premium look used across auth and home screens.
 */
export const palette = {
  bg: "#070B14",
  bgElevated: "#0D1322",
  surface: "#111829",
  surfaceRaised: "#162036",
  border: "#1E2940",
  borderStrong: "#2A3754",
  text: "#F4F6FB",
  textMuted: "#8D97AD",
  textFaint: "#5B6580",
  accent: "#8B7CFF",
  accentSoft: "rgba(124, 92, 255, 0.14)",
  success: "#34D399",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.12)",
  warning: "#FBBF24",
};

export const gradients = {
  primary: ["#7C5CFF", "#4F8BFF"] as const,
  primaryPressed: ["#6A4AF0", "#3F7AF0"] as const,
  glowViolet: ["rgba(124, 92, 255, 0.35)", "rgba(124, 92, 255, 0)"] as const,
  glowBlue: ["rgba(79, 139, 255, 0.28)", "rgba(79, 139, 255, 0)"] as const,
  card: ["rgba(22, 32, 54, 0.92)", "rgba(13, 19, 34, 0.92)"] as const,
};

// Stable per-user avatar colors, chosen from the name
const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#7C5CFF", "#4F8BFF"],
  ["#F472B6", "#A855F7"],
  ["#34D399", "#0EA5E9"],
  ["#FB923C", "#F43F5E"],
  ["#22D3EE", "#6366F1"],
  ["#FACC15", "#F97316"],
];

export const avatarGradient = (seed: string = "") => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
