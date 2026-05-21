import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { SLOT_MAP } from "@/constants/timeSlots";
import type { AIRecommendation, Place } from "@/types/trip";

interface Props {
  recommendation: AIRecommendation | null;
  isLoading: boolean;
  error?: string | null;
  onAccept: (place: Place) => void;
  onClose: () => void;
}

export function AIRecommendSheet({ recommendation, isLoading, error, onAccept, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["46%", "72%"], []);

  useEffect(() => {
    if (recommendation || isLoading || error) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [error, isLoading, recommendation]);

  const slotInfo = recommendation ? SLOT_MAP[recommendation.slot] : null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
      )}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>AI 추천</Text>
            <Text style={styles.title}>
              {slotInfo ? `${recommendation?.day}일차 ${slotInfo.label} 후보` : "빈 시간 추천 중"}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={Colors.textSecond} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.centerText}>동선과 시간대에 맞는 후보를 찾고 있어요</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="warning-outline" size={24} color={Colors.warning} />
            <Text style={styles.centerText}>{error}</Text>
          </View>
        ) : (
          <>
            {recommendation?.reason ? <Text style={styles.reason}>{recommendation.reason}</Text> : null}
            <View style={styles.list}>
              {recommendation?.candidates.map((place) => (
                <Pressable key={place.placeId} onPress={() => onAccept(place)} style={styles.placeCard}>
                  <View style={styles.placeIcon}>
                    <Ionicons name="location-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.placeBody}>
                    <Text style={styles.placeName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={styles.placeMeta} numberOfLines={1}>
                      {place.rating ? `★ ${place.rating} · ` : ""}
                      {place.distanceMeters ? `${place.distanceMeters}m · ` : ""}
                      {place.address}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={Colors.primary} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  centerText: {
    fontSize: 14,
    color: Colors.textSecond,
    textAlign: "center",
    lineHeight: 20,
  },
  reason: {
    fontSize: 13,
    color: Colors.textSecond,
    lineHeight: 19,
    marginBottom: 14,
  },
  list: {
    gap: 10,
  },
  placeCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  placeBody: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  placeMeta: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 3,
  },
});
