/**
 * @module screens/loginScreen
 * Staff login screen (email and password). Authentication is delegated to `onLogin`; the screen only
 * holds the form fields and the password visibility toggle. The back button sits outside the scrolling
 * form so the on-screen keyboard can never push it out of reach.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton, AppTextField, Banner, ContourBackdrop, Icon, StateView } from "../components/ui/index.js";
import { colors, fontFamily, layout, spacing, type } from "../theme/index.js";

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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const blocked = !email.trim() || !password || pending;

  // The hero collapses while typing so the fields never end up squeezed under the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  async function submit() {
    if (!email.trim() || !password || pending) return;
    await onLogin(email.trim(), password);
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ContourBackdrop />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        {onBack && !loading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("login.back")}
            accessibilityState={{ disabled: !!pending }}
            disabled={pending}
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed, pending && styles.disabled]}
          >
            <Icon name="back" size={22} color={colors.onPrimary} />
            <Text style={styles.backText}>{t("login.back")}</Text>
          </Pressable>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, keyboardOpen && styles.titleCompact]}>{t("login.title")}</Text>
            {keyboardOpen ? null : <Text style={styles.subtitle}>{t("login.subtitle")}</Text>}
          </View>

          {loading ? (
            <StateView kind="loading" tone="dark" title={t("login.checking")} style={styles.loading} />
          ) : (
            <View style={styles.form}>
              <AppTextField
                tone="dark"
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
                tone="dark"
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
              <AppButton title={t("login.submit")} variant="signal" size="lg" loading={pending} disabled={blocked && !pending} onPress={submit} style={styles.submit} />
              <Text style={styles.footer}>{t("login.footer")}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  container: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 520, paddingHorizontal: layout.margin },
  back: { alignSelf: "flex-start", minHeight: layout.minTouch, flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: -spacing.xs },
  backText: { ...type.button, fontSize: 15, color: colors.onPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  content: { flexGrow: 1, justifyContent: "flex-start", gap: spacing.xxxl + spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  heading: { gap: spacing.xs, paddingTop: spacing.xl },
  title: { fontFamily: fontFamily.display, fontSize: 76, lineHeight: 92, letterSpacing: -0.5, color: colors.onPrimary },
  titleCompact: { fontSize: 48, lineHeight: 60 },
  subtitle: { ...type.body, color: colors.onForest, maxWidth: 320 },
  form: { gap: spacing.xl },
  toggle: { minHeight: layout.minTouch, justifyContent: "center", paddingLeft: spacing.sm },
  toggleText: { color: colors.signal, fontSize: 14 },
  submit: { marginTop: spacing.xs },
  footer: { ...type.caption, color: colors.onForest, textAlign: "left" },
  loading: { alignItems: "flex-start", paddingHorizontal: 0 },
});
