import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { Place } from "@/types/trip";

interface Props {
  place: Place;
  compact?: boolean;
}

const PRICE_LABELS: Record<number, string> = {
  1: "저렴함",
  2: "보통",
  3: "비쌈",
  4: "고급",
};

function priceLabel(level?: number): string {
  if (!level || !PRICE_LABELS[level]) return "";
  return PRICE_LABELS[level];
}

export function PlaceInsights({ place, compact }: Props) {
  const hasMenus = !!place.recommendedMenus?.length;
  const hasHighlights = !!place.highlights?.length;
  const hasSummary = !!place.summary;
  const priceDisplay = place.priceRange ?? priceLabel(place.priceLevel);
  const hasPrice = !!priceDisplay;

  if (!hasSummary && !hasMenus && !hasHighlights && !hasPrice) {
    return null;
  }

  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      {hasSummary ? (
        <Text style={styles.summary} numberOfLines={compact ? 2 : 3}>
          {place.summary}
        </Text>
      ) : null}

      {hasMenus ? (
        <View style={styles.section}>
          <Ionicons name="restaurant-outline" size={12} color={Colors.primary} />
          <Text style={styles.sectionLabel}>추천</Text>
          <Text style={styles.sectionValue} numberOfLines={2}>
            {place.recommendedMenus!.join(" · ")}
          </Text>
        </View>
      ) : null}

      {hasHighlights ? (
        <View style={styles.section}>
          <Ionicons name="sparkles-outline" size={12} color={Colors.primary} />
          <Text style={styles.sectionLabel}>볼거리</Text>
          <Text style={styles.sectionValue} numberOfLines={2}>
            {place.highlights!.join(" · ")}
          </Text>
        </View>
      ) : null}

      {hasPrice ? (
        <View style={styles.section}>
          <Ionicons name="pricetag-outline" size={12} color={Colors.success} />
          <Text style={styles.sectionLabel}>가격</Text>
          <Text style={styles.sectionValue}>{priceDisplay}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    gap: 6,
  },
  boxCompact: {
    padding: 8,
    gap: 4,
  },
  summary: {
    fontSize: 12,
    color: Colors.textSecond,
    lineHeight: 17,
    fontWeight: "600",
  },
  section: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.textSecond,
    marginTop: 1,
  },
  sectionValue: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
    fontWeight: "700",
  },
});
