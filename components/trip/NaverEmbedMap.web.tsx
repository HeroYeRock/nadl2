import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { Place, SlotItem } from "@/types/trip";

const CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

let loader: Promise<void> | null = null;

/** 네이버 Web Dynamic Map JS SDK 를 1회만 로드한다. */
function loadNaverMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).naver?.maps) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(CLIENT_ID)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null;
      reject(new Error("naver maps load failed"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

interface Props {
  places: Place[];
  selectedSlot?: SlotItem | null;
  destination?: string;
}

/**
 * 국내(한국) 일정용 네이버 임베드 지도 (웹 전용).
 * 도메인 제한된 Client ID(ncpKeyId)로 JS SDK 를 로드해 마커를 찍는다.
 */
export function NaverEmbedMap({ places, selectedSlot }: Props) {
  const elRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps()
      .then(() => {
        if (cancelled || !elRef.current) return;
        const naver = (window as any).naver;
        const pts = (places.length ? places : selectedSlot?.place ? [selectedSlot.place] : []).filter(
          (p) => p && p.lat && p.lng,
        );

        if (!mapRef.current) {
          mapRef.current = new naver.maps.Map(elRef.current, {
            center: new naver.maps.LatLng(pts[0]?.lat ?? 37.5665, pts[0]?.lng ?? 126.978),
            zoom: 13,
            scaleControl: false,
            mapDataControl: false,
          });
        }

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        if (pts.length === 0) return;

        const bounds = new naver.maps.LatLngBounds();
        pts.forEach((p) => {
          const pos = new naver.maps.LatLng(p.lat, p.lng);
          markersRef.current.push(new naver.maps.Marker({ position: pos, map: mapRef.current, title: p.name }));
          bounds.extend(pos);
        });

        if (pts.length === 1) {
          mapRef.current.setCenter(new naver.maps.LatLng(pts[0].lat, pts[0].lng));
          mapRef.current.setZoom(15);
        } else {
          mapRef.current.fitBounds(bounds);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [places, selectedSlot]);

  if (!CLIENT_ID) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 가 설정되어 있지 않아요.</Text>
      </View>
    );
  }

  const Div: any = "div";
  return <Div ref={elRef} style={{ width: "100%", height: "100%" }} />;
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
    padding: 20,
  },
  fallbackText: { color: Colors.textSecond, fontSize: 13, textAlign: "center" },
});
