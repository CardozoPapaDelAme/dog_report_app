import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AssociationDashboardScreen({ displayName, onLogout, pending }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t("associationDashboard.eyebrow")}</Text>
        <Text style={styles.title}>{t("associationDashboard.title")}</Text>
        {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
        <Text style={styles.body}>{t("associationDashboard.body")}</Text>
        <Pressable accessibilityRole="button" disabled={pending} onPress={onLogout} style={styles.button}>
          <Text style={styles.buttonText}>{t("login.logout")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7fbf1" },
  content: { flex: 1, justifyContent: "center", alignSelf: "center", width: "100%", maxWidth: 620, paddingHorizontal: 26 },
  eyebrow: { color: "#00450d", fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: "#191d17", fontSize: 32, lineHeight: 38, fontWeight: "700", marginTop: 10 },
  name: { color: "#5d6859", fontSize: 16, marginTop: 10 },
  body: { color: "#5d6859", fontSize: 16, lineHeight: 24, marginTop: 20 },
  button: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#c0c9bb", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, marginTop: 30 },
  buttonText: { color: "#00450d", fontSize: 14, fontWeight: "600" },
});
