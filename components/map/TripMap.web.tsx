import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { Place } from "@/types/trip";

interface Props {
  places: Place[];
  pinColors: string[];
}

export function TripMap({ places, pinColors }: Props) {
  return (
    <View style={styles.mapCard}>
      {places.length ? (
        <View style={styles.routeList}>
          {places.map((place, index) => (
            <View key={place.placeId || `${place.name}-${index}`} style={styles.routeRow}>
              <View style={[styles.pin, { backgroundColor: pinColors[index % pinColors.length] }]}>
                <Text style={styles.pinText}>{index + 1}</Text>
              </View>
              <View style={styles.placeTextWrap}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.placeAddress} numberOfLines={1}>
                  {place.address || place.category}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.mapEmpty}>
          <Ionicons name="map-outline" size={26} color={Colors.primary} />
          <Text style={styles.mapEmptyText}>장소를 추가하면 루트가 표시됩니다</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    margin: 20,
    minHeight: 240,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeList: {
    padding: 16,
    gap: 10,
  },
  routeRow: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pinText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
  },
  placeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  placeAddress: {
    color: Colors.textSecond,
    fontSize: 12,
    marginTop: 2,
  },
  mapEmpty: {
    minHeight: 238,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mapEmptyText: {
    color: Colors.textSecond,
    fontSize: 13,
    fontWeight: "800",
  },
});
