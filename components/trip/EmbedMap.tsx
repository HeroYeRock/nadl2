import { Platform, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { Place, SlotItem } from "@/types/trip";
import { haversineKm, type TravelMode } from "@/services/maps";

interface Props {
  /** 'browse' = 활성 day 전체 동선, 'directions' = 선택된 슬롯으로 가는 경로 */
  mode: "browse" | "directions";
  places: Place[];
  selectedSlot?: SlotItem | null;
  origin?: { lat: number; lng: number } | null;
  travelMode?: TravelMode;
}

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

function placeUrl(place: Pick<Place, "lat" | "lng" | "placeId" | "name">): string {
  const base = "https://www.google.com/maps/embed/v1";
  const params = new URLSearchParams({
    key: MAPS_KEY,
    // placeId 있으면 그걸 우선 사용 → 좌표 대신 실제 장소명 표시
    q: place.placeId ? `place_id:${place.placeId}` : `${place.lat},${place.lng}`,
    language: "ko",
  });
  return `${base}/place?${params.toString()}`;
}

function buildEmbedUrl(props: Props): string {
  const { mode, places, selectedSlot, origin, travelMode = "transit" } = props;
  const base = "https://www.google.com/maps/embed/v1";

  if (mode === "directions" && selectedSlot?.place) {
    const dest = selectedSlot.place;
    if (!origin) {
      return placeUrl(dest);
    }
    const distance = haversineKm(origin, { lat: dest.lat, lng: dest.lng });
    if (distance > 100) {
      return placeUrl(dest);
    }
    const params = new URLSearchParams({
      key: MAPS_KEY,
      origin: `${origin.lat},${origin.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      mode: travelMode,
      language: "ko",
    });
    // destination_place_id 를 같이 넘기면 좌표 대신 장소명을 라벨로 보여줌
    if (dest.placeId) params.set("destination_place_id", dest.placeId);
    return `${base}/directions?${params.toString()}`;
  }

  if (places.length === 0) {
    const params = new URLSearchParams({
      key: MAPS_KEY,
      center: "35.682,139.766",
      zoom: "6",
      language: "ko",
    });
    return `${base}/view?${params.toString()}`;
  }

  if (places.length === 1) {
    return placeUrl(places[0]);
  }

  // 여러 장소면 directions 모드로 waypoints 사용해서 경로 표시
  const first = places[0];
  const last = places[places.length - 1];
  const waypoints = places.slice(1, -1)
    .map((p) => (p.placeId ? `place_id:${p.placeId}` : `${p.lat},${p.lng}`))
    .join("|");

  const params = new URLSearchParams({
    key: MAPS_KEY,
    origin: `${first.lat},${first.lng}`,
    destination: `${last.lat},${last.lng}`,
    mode: "walking",
    language: "ko",
  });
  if (first.placeId) params.set("origin_place_id", first.placeId);
  if (last.placeId) params.set("destination_place_id", last.placeId);
  if (waypoints) params.set("waypoints", waypoints);
  return `${base}/directions?${params.toString()}`;
}

export function EmbedMap(props: Props) {
  if (Platform.OS !== "web") {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>지도는 웹에서만 표시됩니다</Text>
      </View>
    );
  }

  if (!MAPS_KEY) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          EXPO_PUBLIC_GOOGLE_MAPS_KEY 가 설정되어 있지 않아요.
        </Text>
      </View>
    );
  }

  const url = buildEmbedUrl(props);

  // RN Web 에서 iframe 직접 렌더
  const Iframe: any = "iframe";
  return (
    <Iframe
      src={url}
      style={{
        width: "100%",
        height: "100%",
        border: "0",
        display: "block",
      }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
    padding: 20,
  },
  fallbackText: {
    color: Colors.textSecond,
    fontSize: 13,
    textAlign: "center",
  },
});
