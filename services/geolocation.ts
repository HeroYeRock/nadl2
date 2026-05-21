import { Platform } from "react-native";
import * as Location from "expo-location";

export interface Coords {
  lat: number;
  lng: number;
}

export type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

export interface GeoResult {
  status: GeoStatus;
  coords: Coords | null;
  error?: string;
}

/**
 * 현위치 한 번 가져오기.
 * Web: navigator.geolocation
 * Native (iOS/Android): expo-location
 */
export async function getCurrentLocation(): Promise<GeoResult> {
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { status: "unsupported", coords: null };
    }
    return new Promise<GeoResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            status: "granted",
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          }),
        (err) =>
          resolve({
            status: err.code === err.PERMISSION_DENIED ? "denied" : "unsupported",
            coords: null,
            error: err.message,
          }),
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
      );
    });
  }

  // 네이티브 (iOS / Android)
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { status: "denied", coords: null };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: "granted",
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    };
  } catch (error) {
    return {
      status: "unsupported",
      coords: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
