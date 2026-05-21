import { StyleSheet, Text, View } from "react-native";

interface Props {
  index: number;
  color: string;
  label: string;
  isAI?: boolean;
}

export function ApplePin({ index, color, label, isAI }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.callout}>
        <Text style={styles.calloutText} numberOfLines={1}>
          {label}
        </Text>
        {isAI ? <Text style={styles.aiText}> AI</Text> : null}
      </View>
      <View style={[styles.pinBody, { backgroundColor: color }]}>
        <View style={styles.shine} />
        <Text style={styles.pinNumber}>{index}</Text>
      </View>
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 92,
    alignItems: "center",
  },
  callout: {
    maxWidth: 92,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1C1C1E",
    maxWidth: 66,
  },
  aiText: {
    fontSize: 9,
    color: "#0A84FF",
    fontWeight: "900",
  },
  pinBody: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderBottomRightRadius: 3,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 5,
  },
  shine: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.42)",
    transform: [{ rotate: "-45deg" }],
  },
  pinNumber: {
    fontSize: 11,
    fontWeight: "900",
    color: "white",
    transform: [{ rotate: "-45deg" }],
    lineHeight: 14,
  },
  shadow: {
    width: 14,
    height: 5,
    borderRadius: 4,
    marginTop: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
});
