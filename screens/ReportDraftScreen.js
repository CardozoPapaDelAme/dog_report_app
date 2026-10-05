import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
};

function formatAccuracy(value) {
  return Number.isFinite(value) ? `${Math.round(value)} m` : '';
}

function formatLocation(snapshot) {
  if (!snapshot) return '';
  return `${snapshot.latitude.toFixed(5)}, ${snapshot.longitude.toFixed(5)}`;
}

export default function ReportDraftScreen({ draft, loading = false, error = null, onBackToCamera }) {
  const { t } = useTranslation();
  const validation = draft?.photo_validation;
  const photoUri = draft?.photo_file_uri;
  const location = draft?.location_snapshot;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('reportDraft.eyebrow')}</Text>
        <Text style={styles.title}>{t('reportDraft.title')}</Text>
        <Text style={styles.subtitle}>{t('reportDraft.subtitle')}</Text>

        {photoUri ? (
          <Image accessibilityRole="image" accessibilityLabel={t('reportForm.photoPreview')} source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoText}>{t('reportDraft.noPhoto')}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
            <Text style={styles.metric}>{t('reportDraft.savingDraft')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>{t('reportDraft.errorTitle')}</Text>
            <Text style={styles.errorBody}>{t(`reportDraft.errors.${error.code}`, { defaultValue: t('reportDraft.errors.default') })}</Text>
          </View>
        ) : null}

        {draft ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('reportDraft.queueTitle')}</Text>
            <Text style={styles.metric}>{t('reportDraft.id', { value: draft.id })}</Text>
            <Text style={styles.metric}>{t('reportDraft.localState', { value: draft.local_state })}</Text>
            <Text style={styles.metric}>{t('reportDraft.photoFile', { value: draft.photo_file_uri ? t('common.yes') : t('common.no') })}</Text>
          </View>
        ) : null}

        {location ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('reportDraft.locationTitle')}</Text>
            <Text style={styles.metric}>{t('reportDraft.coordinates', { value: formatLocation(location) })}</Text>
            <Text style={styles.metric}>{t('reportDraft.accuracy', { value: formatAccuracy(location.accuracy_meters) })}</Text>
            <Text style={styles.metric}>{t('reportDraft.mockSuspected', { value: location.mock_suspected ? t('common.yes') : t('common.no') })}</Text>
            <Text style={styles.metric}>{t('reportDraft.clientCreatedAt', { value: location.captured_at })}</Text>
          </View>
        ) : null}

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20, gap: 16 },
  eyebrow: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, lineHeight: 36 },
  subtitle: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.outline },
  noPhoto: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noPhotoText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderColor: '#e0e6db', borderWidth: 1, borderRadius: 16, padding: 16, gap: 7 },
  cardTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  metric: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20 },
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  errorBody: { color: '#5f1414', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20 },
  actions: { marginTop: 'auto', flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: colors.outline, borderWidth: 1, backgroundColor: colors.surface },
  secondaryText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  primaryButton: { flex: 1.2, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 12 },
  primaryText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, textAlign: 'center' },
});
