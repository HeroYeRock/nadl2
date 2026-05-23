import { Platform, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
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
  /** 여행지 도시명 — 좌표 없을 때 검색 기본 뷰로 사용 */
  destination?: string;
}

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

function hasValidCoords(place: Pick<Place, "lat" | "lng">): boolean {
  return !!(place.lat && place.lng);
}

function cityFallbackUrl(destination?: string): string {
  const base = "https://www.google.com/maps/embed/v1";
  if (destination) {
    const params = new URLSearchParams({
      key: MAPS_KEY,
      q: destination,
      language: "ko",
    });
    return `${base}/search?${params.toString()}`;
  }
  const params = new URLSearchParams({
    key: MAPS_KEY,
    center: "35.682,139.766",
    zoom: "6",
    language: "ko",
  });
  return `${base}/view?${params.toString()}`;
}

function placeUrl(place: Pick<Place, "lat" | "lng" | "placeId" | "name">): string {
  const base = "https://www.google.com/maps/embed/v1";
  const params = new URLSearchParams({
    key: MAPS_KEY,
    q: place.placeId ? `place_id:${place.placeId}` : `${place.lat},${place.lng}`,
    language: "ko",
  });
  return `${base}/place?${params.toString()}`;
}

function buildEmbedUrl(props: Props): string {
  const { mode, places, selectedSlot, origin, travelMode = "transit", destination } = props;
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
      destination: dest.placeId ? `place_id:${dest.placeId}` : `${dest.lat},${dest.lng}`,
      mode: travelMode,
      language: "ko",
    });
    return `${base}/directions?${params.toString()}`;
  }

  if (places.length === 0) {
    return cityFallbackUrl(destination);
  }

  if (places.length === 1) {
    if (!hasValidCoords(places[0])) return cityFallbackUrl(destination);
    return placeUrl(places[0]);
  }

  // 여러 장소: 유효한 좌표가 있는 장소만 필터링
  const validPlaces = places.filter(hasValidCoords);
  if (validPlaces.length < 2) {
    return cityFallbackUrl(destination);
  }

  const first = validPlaces[0];
  const last = validPlaces[validPlaces.length - 1];
  const waypoints = validPlaces.slice(1, -1)
    .map((p) => (p.placeId ? `place_id:${p.placeId}` : `${p.lat},${p.lng}`))
    .join("|");

  const params = new URLSearchParams({
    key: MAPS_KEY,
    origin: `${first.lat},${first.lng}`,
    destination: `${last.lat},${last.lng}`,
    mode: "walking",
    language: "ko",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `${base}/directions?${params.toString()}`;
}

export function EmbedMap(props: Props) {
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

  if (Platform.OS === "web") {
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

  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1 }}
      originWhitelist={["https://*", "http://*"]}
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures={false}
      androidLayerType="hardware"
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
