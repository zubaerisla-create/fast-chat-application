/**
 * Shared design tokens for the dark, premium look used across auth and home screens.
 */
export const palette = {
  bg: "#0B0C11",
  bgElevated: "#12141C",
  surface: "#181B26",
  surfaceRaised: "#202434",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(244, 63, 94, 0.3)",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  textFaint: "#64748B",
  accent: "#F43F5E",
  accentSoft: "rgba(244, 63, 94, 0.12)",
  success: "#10B981",
  danger: "#F43F5E",
  dangerSoft: "rgba(244, 63, 94, 0.12)",
  warning: "#FBBF24",
};

export const gradients = {
  primary: ["#F43F5E", "#FB7185"] as const,
  primaryPressed: ["#E11D48", "#F43F5E"] as const,
  glowViolet: ["rgba(244, 63, 94, 0.25)", "rgba(244, 63, 94, 0)"] as const,
  glowBlue: ["rgba(251, 113, 133, 0.2)", "rgba(251, 113, 133, 0)"] as const,
  card: ["rgba(24, 27, 38, 0.95)", "rgba(18, 20, 28, 0.95)"] as const,
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
