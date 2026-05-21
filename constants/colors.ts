export const Colors = {
  primary: "#FF6B35",
  dark: "#1C1C1E",
  transport: "#0A84FF",
  food: "#30D158",
  activity: "#FF9500",
  sightseeing: "#FF6B35",
  bg: "#F2F2F7",
  card: "#FFFFFF",
  border: "#E5E5EA",
  borderLight: "#C7C7CC",
  textPrimary: "#1C1C1E",
  textSecond: "#6E6E73",
  textThird: "#8E8E93",
  success: "#30D158",
  warning: "#FF9500",
  error: "#FF3B30",
  info: "#0A84FF",
  aiBg: "#EEF3FF",
  aiText: "#0050B3",
} as const;

export type ColorKey = keyof typeof Colors;
