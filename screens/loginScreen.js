import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  background: "#f7fbf1",
  ink: "#191d17",
  muted: "#5d6859",
  outline: "#c0c9bb",
  primary: "#00450d",
  danger: "#ba1a1a",
  dangerSoft: "#ffdad6",
};

export default function LoginScreen({ onLogin, error, pending, loading }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit() {
    if (!email.trim() || !password || pending) return;
    await onLogin(email.trim(), password);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.brandMark}><Text style={styles.brandLetter}>C</Text></View>
        <Text style={styles.eyebrow}>{t("login.eyebrow")}</Text>
        <Text style={styles.title}>{t("login.title")}</Text>
        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>{t("login.checking")}</Text></View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>{t("login.email")}</Text>
            <TextInput
              accessibilityLabel={t("login.email")}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={submit}
              placeholder={t("login.emailPlaceholder")}
              placeholderTextColor={colors.muted}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
              style={styles.input}
            />
            <Text style={[styles.label, styles.passwordLabel]}>{t("login.password")}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabel={t("login.password")}
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="••••••••••••"
                placeholderTextColor={colors.muted}
                returnKeyType="go"
                secureTextEntry={!passwordVisible}
                textContentType="password"
                value={password}
                style={styles.passwordInput}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? t("login.hidePassword") : t("login.showPassword")} onPress={() => setPasswordVisible((visible) => !visible)} hitSlop={12}>
                <Text style={styles.showPassword}>{passwordVisible ? t("login.hidePassword") : t("login.showPassword")}</Text>
              </Pressable>
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{t("login.error")}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={!email.trim() || !password || pending}
              onPress={submit}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, ((!email.trim() || !password || pending) && styles.buttonDisabled)]}
            >
              {pending ? <ActivityIndicator accessibilityLabel={t("common.loading")} color="#fff" /> : <Text style={styles.buttonText}>{t("login.submit")}</Text>}
            </Pressable>
            <Text style={styles.footer}>{t("login.footer")}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: "center", alignSelf: "center", width: "100%", maxWidth: 480, paddingHorizontal: 26, paddingVertical: 36 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 32 },
  brandLetter: { color: "#fff", fontSize: 24, fontWeight: "700" },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: "700", marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10, marginBottom: 34 },
  form: { gap: 10 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  passwordLabel: { marginTop: 12 },
  input: { minHeight: 54, borderColor: colors.outline, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, color: colors.ink, fontSize: 16, backgroundColor: "#fff" },
  passwordRow: { minHeight: 54, flexDirection: "row", alignItems: "center", borderColor: colors.outline, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, backgroundColor: "#fff" },
  passwordInput: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 14 },
  showPassword: { color: colors.primary, fontSize: 13, fontWeight: "600", paddingLeft: 8 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 12, lineHeight: 20, marginTop: 6 },
  button: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primary, marginTop: 12 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer: { color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 19, marginTop: 18 },
  loading: { minHeight: 120, flexDirection: "row", alignItems: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 15 },
});
