import MapView, { Marker, Polyline } from "react-native-maps";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApplePin } from "@/components/map/ApplePin";
import { Colors } from "@/constants/colors";
import type { Place } from "@/types/trip";

interface Props {
  places: Place[];
  pinColors: string[];
}

function toMapRegion(places: Place[]) {
  if (!places.length) {
    return {
      latitude: 35.681236,
      longitude: 139.767125,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }

  const latitude = places.reduce((sum, place) => sum + place.lat, 0) / places.length;
  const longitude = places.reduce((sum, place) => sum + place.lng, 0) / places.length;
  return {
    latitude,
    longitude,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };
}

export function TripMap({ places, pinColors }: Props) {
  const mapRegion = toMapRegion(places);

  return (
    <View style={styles.mapCard}>
      <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
        {places.map((place, index) => (
          <Marker key={place.placeId} coordinate={{ latitude: place.lat, longitude: place.lng }}>
            <ApplePin
              index={index + 1}
              color={pinColors[index % pinColors.length]}
              label={place.name}
              isAI={place.isAIRecommended}
            />
          </Marker>
        ))}
        {places.length > 1 ? (
          <Polyline
            coordinates={places.map((place) => ({ latitude: place.lat, longitude: place.lng }))}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ) : null}
      </MapView>
      {!places.length ? (
        <View style={styles.mapEmpty}>
          <Ionicons name="map-outline" size={26} color={Colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    margin: 20,
    height: 240,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    flex: 1,
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    gap: 8,
  },
});
