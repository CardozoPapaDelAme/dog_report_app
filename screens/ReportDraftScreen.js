import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const colors = {
  background: '#f7fbf1',
  surface: '#ffffff',
  ink: '#191d17',
  muted: '#5d6859',
  outline: '#c0c9bb',
  primary: '#00450d',
  soft: '#d9f2d4',
};

export default function ReportDraftScreen({ draft, onBackToCamera }) {
  const { t } = useTranslation();
  const validation = draft?.photo?.validation;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('reportDraft.eyebrow')}</Text>
        <Text style={styles.title}>{t('reportDraft.title')}</Text>
        <Text style={styles.subtitle}>{t('reportDraft.subtitle')}</Text>

        {draft?.photo?.photoUri ? (
          <Image source={{ uri: draft.photo.photoUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoText}>{t('reportDraft.noPhoto')}</Text>
          </View>
        )}

        {validation ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('reportDraft.validationTitle')}</Text>
            <Text style={styles.metric}>
              {t('reportDraft.dogProbability', { value: Math.round(validation.dogProbability * 100) })}
            </Text>
            <Text style={styles.metric}>
              {t('reportDraft.blurVariance', { value: validation.blurVariance })}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onBackToCamera} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{t('reportDraft.back')}</Text>
          </Pressable>
          <View style={styles.primaryButton}>
            <Text style={styles.primaryText}>{t('reportDraft.formPending')}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 20, gap: 16 },
  eyebrow: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, lineHeight: 36 },
  subtitle: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.outline },
  noPhoto: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noPhotoText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderColor: '#e0e6db', borderWidth: 1, borderRadius: 16, padding: 16, gap: 7 },
  cardTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  metric: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20 },
  actions: { marginTop: 'auto', flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: colors.outline, borderWidth: 1, backgroundColor: colors.surface },
  secondaryText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  primaryButton: { flex: 1.2, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 12 },
  primaryText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, textAlign: 'center' },
});
