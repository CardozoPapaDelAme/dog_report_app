/**
 * @module screens/loginScreen
 * Staff login screen (email and password). Authentication is delegated to `onLogin`; the screen only
 * holds the form fields and the password visibility toggle. The back button sits outside the scrolling
 * form so the on-screen keyboard can never push it out of reach.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton, AppTextField, Banner, Icon, StateView } from "../components/ui/index.js";
import { colors, layout, radius, spacing, type } from "../theme/index.js";

/**
 * @param {object} props
 * @param {(email: string, password: string) => Promise<unknown>} props.onLogin - Receives the trimmed email.
 * @param {() => void} [props.onBack] - Shows a back button when given and not loading.
 * @param {Error | null} [props.error] - Shows a generic login error when set.
 * @param {boolean} [props.pending] - Disables submission while a request is running.
 * @param {boolean} [props.loading] - Shows the session check indicator instead of the form.
 * @returns {JSX.Element}
 */
export default function LoginScreen({ onLogin, onBack, error, pending, loading }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const blocked = !email.trim() || !password || pending;

  async function submit() {
    if (!email.trim() || !password || pending) return;
    await onLogin(email.trim(), password);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        {onBack && !loading ? (
          <AppButton title={t("login.back")} variant="secondary" disabled={pending} onPress={onBack} style={styles.back} />
        ) : null}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}><Icon name="dog" size={28} color={colors.onPrimary} /></View>
          <Text style={[type.labelCaps, styles.eyebrow]}>{t("login.eyebrow")}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t("login.title")}</Text>
          <Text style={[type.body, styles.subtitle]}>{t("login.subtitle")}</Text>

          {loading ? (
            <StateView kind="loading" title={t("login.checking")} />
          ) : (
            <View style={styles.form}>
              <AppTextField
                label={t("login.email")}
                accessibilityLabel={t("login.email")}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={submit}
                placeholder={t("login.emailPlaceholder")}
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />
              <AppTextField
                label={t("login.password")}
                accessibilityLabel={t("login.password")}
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="••••••••••••"
                returnKeyType="go"
                secureTextEntry={!passwordVisible}
                textContentType="password"
                value={password}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? t("login.hidePassword") : t("login.showPassword")}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    hitSlop={8}
                    style={styles.toggle}
                  >
                    <Text style={[type.label, styles.toggleText]}>{passwordVisible ? t("login.hidePassword") : t("login.showPassword")}</Text>
                  </Pressable>
                }
              />
              {error ? <Banner tone="error" message={t("login.error")} /> : null}
              <AppButton title={t("login.submit")} size="lg" loading={pending} disabled={blocked && !pending} onPress={submit} />
              <Text style={[type.caption, styles.footer]}>{t("login.footer")}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 480, paddingHorizontal: layout.margin, paddingTop: spacing.lg },
  back: { alignSelf: "flex-start", marginBottom: spacing.sm },
  content: { flexGrow: 1, justifyContent: "center", paddingVertical: spacing.xxl },
  brandMark: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xxl },
  eyebrow: { color: colors.primary },
  title: { ...type.display, fontSize: 34, lineHeight: 40, marginTop: spacing.sm },
  subtitle: { color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.xxl },
  form: { gap: spacing.lg },
  toggle: { minHeight: layout.minTouch, justifyContent: "center", paddingLeft: spacing.sm },
  toggleText: { color: colors.primary, fontSize: 14 },
  footer: { textAlign: "center" },
});
