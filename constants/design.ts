/**
 * Shared design tokens for the dark, premium look used across auth and home screens.
 */
export const palette = {
  bg: "#130913",
  bgElevated: "#1A0C1A",
  surface: "#210F20",
  surfaceRaised: "#2D152B",
  border: "#3D1B3A",
  borderStrong: "#52224D",
  text: "#FFF1F4",
  textMuted: "#D4A5C1",
  textFaint: "#9E6D8A",
  accent: "#F43F5E",
  accentSoft: "rgba(244, 63, 94, 0.15)",
  success: "#34D399",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.12)",
  warning: "#FBBF24",
};

export const gradients = {
  primary: ["#F43F5E", "#EC4899"] as const,
  primaryPressed: ["#E11D48", "#DB2777"] as const,
  glowViolet: ["rgba(244, 63, 94, 0.35)", "rgba(244, 63, 94, 0)"] as const,
  glowBlue: ["rgba(236, 72, 153, 0.28)", "rgba(236, 72, 153, 0)"] as const,
  card: ["rgba(38, 17, 36, 0.92)", "rgba(25, 11, 24, 0.92)"] as const,
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
