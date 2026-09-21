// §43 Report a Problem.
//
// Redesigned 2026-09-13, refined 2026-09-14. The category picker was a 2x2 grid
// of bordered boxes; four boxes of equal weight make the user compare shapes
// before they can compare meanings. It's now a single list card — one column,
// hairline-separated, with an accent spine that grows out from the centre of the
// chosen row. Scanning a list is faster than scanning a grid, and only one thing
// on screen is ever coloured in.
//
// The submission path is deliberately UNCHANGED — submitProblemReport still
// posts to the Google Form, whose Apps Script relays the row to Discord. Two
// things differ in WHAT it sends: picking "Other" sends the user's own words
// instead of the literal "other", and the screenshot is now uploaded to
// Cloudinary so its URL travels inside the message body (see support.ts).
import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { submitProblemReport } from '@/src/core/messaging/support';
import { showToast } from '@/src/core/store/toastStore';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';

type CategoryValue = 'bug' | 'content' | 'payment' | 'other';

interface CategoryDef {
  value: CategoryValue;
  icon: keyof typeof Ionicons.glyphMap;
  /** Per-category accent so the grid reads as four distinct choices, not four identical boxes. */
  color: string;
  labelKey: string;
  descKey: string;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'bug', icon: 'bug', color: '#EF4444', labelKey: 'help.reportCatBug', descKey: 'help.reportCatBugDesc' },
  { value: 'content', icon: 'document-text', color: '#0EA5E9', labelKey: 'help.reportCatContent', descKey: 'help.reportCatContentDesc' },
  { value: 'payment', icon: 'card', color: '#10B981', labelKey: 'help.reportCatPayment', descKey: 'help.reportCatPaymentDesc' },
  { value: 'other', icon: 'ellipsis-horizontal-circle', color: '#8B5CF6', labelKey: 'help.reportCatOther', descKey: 'help.reportCatOtherDesc' },
];

export default function ReportProblemScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();

  const [category, setCategory] = useState<CategoryValue | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const isOther = category === 'other';
  // "Other" is only a real choice once the user has actually typed what it is —
  // otherwise the report reaches support with no category at all.
  const categoryReady = category !== null && (!isOther || customCategory.trim().length > 0);
  const canSubmit = categoryReady && description.trim().length > 0 && !submitting;

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setScreenshotUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !category) return;
    setSubmitting(true);
    setUploadPct(0);
    try {
      // Same call as before; only the string differs for the "Other" case. The
      // progress callback is what turns a long silent wait on a slow connection
      // into something the user can see moving.
      const submittedCategory = isOther ? customCategory.trim() : category;
      await submitProblemReport(submittedCategory, description.trim(), screenshotUri, (fraction) =>
        setUploadPct(Math.round(fraction * 100)),
      );
      showToast(t('help.reportSubmitted'), 'success');
      router.back();
    } catch {
      showToast(t('common.somethingWentWrong'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (isOffline) {
    return (
      <SubpageScrollScreen title={t('help.reportTitle')}>
        <View style={[styles.offline, { backgroundColor: `${colors.warning}14`, borderRadius: radius.lg, padding: spacing.md }]}>
          <Ionicons name="cloud-offline" size={24} color={colors.warning} />
          <Text variant="bodySmall" style={{ flex: 1, color: colors.warning }}>{t('help.offlineBlocked')}</Text>
        </View>
      </SubpageScrollScreen>
    );
  }

  return (
    <SubpageScrollScreen title={t('help.reportTitle')}>
      {/* Intro banner — same hero pattern the Report Question screen uses, so the
          two report flows feel like siblings. */}
      <Animated.View
        entering={FadeInDown.duration(360)}
        style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="megaphone" size={18} color={colors.onPrimary} />
        </View>
        <Text variant="bodySmall" secondary style={{ flex: 1 }}>{t('help.reportIntro')}</Text>
      </Animated.View>

      {/* ===== Category ===== */}
      <Animated.View entering={FadeInDown.duration(360).delay(60)} style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text variant="bodySmall" weight="semiBold">{t('help.reportCategory')}</Text>
          <Text variant="caption" secondary>{t('help.reportCategoryHint')}</Text>
        </View>

        <View
          style={[
            styles.listCard,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          {CATEGORIES.map((item, index) => (
            <React.Fragment key={item.value}>
              {index > 0 ? (
                <View style={[styles.listDivider, { backgroundColor: colors.divider }]} />
              ) : null}
              <CategoryRow
                item={item}
                selected={category === item.value}
                onPress={() => setCategory(item.value)}
              />
            </React.Fragment>
          ))}
        </View>
      </Animated.View>

      {/* Manual category — only exists while "Other" is selected. Layout animation
          keeps the fields below from jumping when it appears/disappears. */}
      {isOther ? (
        <Animated.View entering={FadeInDown.duration(240)} exiting={FadeOut.duration(140)} layout={LinearTransition.duration(200)} style={{ gap: spacing.xs }}>
          <FloatingLabelField
            label={t('help.reportCustomCategory')}
            value={customCategory}
            onChangeText={setCustomCategory}
            leftIcon="pricetag-outline"
            maxLength={60}
            autoFocus
          />
          <Text variant="caption" secondary style={{ marginLeft: spacing.xs }}>
            {t('help.reportCustomCategoryHint')}
          </Text>
        </Animated.View>
      ) : null}

      {/* ===== Description ===== */}
      <Animated.View entering={FadeInDown.duration(360).delay(120)} layout={LinearTransition.duration(200)} style={{ gap: spacing.xs }}>
        <FloatingLabelField
          label={t('help.reportDescription')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Text variant="caption" secondary style={{ marginLeft: spacing.xs }}>
          {t('help.reportDescriptionHint')}
        </Text>
      </Animated.View>

      {/* ===== Screenshot ===== */}
      <Animated.View entering={FadeInDown.duration(360).delay(180)} layout={LinearTransition.duration(200)}>
        {screenshotUri ? (
          <View style={[styles.shotCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm }]}>
            <Image source={{ uri: screenshotUri }} style={[styles.shotThumb, { borderRadius: radius.md, backgroundColor: colors.surfaceAlt }]} />
            <View style={styles.shotMeta}>
              <Text variant="bodySmall" weight="semiBold" numberOfLines={1}>{t('help.screenshotAttached')}</Text>
              <Pressable onPress={() => setScreenshotUri(null)} hitSlop={8} style={styles.removeRow}>
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text variant="caption" weight="semiBold" style={{ color: colors.error }}>{t('help.removeScreenshot')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // Dashed drop-zone styling signals "add something here" far better than
          // the secondary Button this replaced.
          <Pressable
            onPress={pickScreenshot}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.dropZone,
              {
                borderRadius: radius.lg,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                padding: spacing.md,
              },
            ]}
          >
            <View style={[styles.dropIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="image-outline" size={18} color={colors.primary} />
            </View>
            <Text variant="bodySmall" weight="medium" secondary>{t('help.attachScreenshot')}</Text>
          </Pressable>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(360).delay(240)} layout={LinearTransition.duration(200)} style={styles.submitWrap}>
        {/* Upload progress. A screenshot on a slow connection can take several
            seconds; without this the button just spins and the user assumes the
            app has hung. */}
        {submitting && screenshotUri ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.uploadRow}>
            <View style={[styles.uploadTrack, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
              <View
                style={{
                  width: `${Math.max(4, uploadPct)}%`,
                  height: '100%',
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            <Text variant="caption" secondary numberOfLines={1}>
              {t('help.uploadingScreenshot', { percent: uploadPct })}
            </Text>
          </Animated.View>
        ) : null}

        <Button label={t('common.submit')} onPress={handleSubmit} loading={submitting} disabled={!canSubmit} />
      </Animated.View>
    </SubpageScrollScreen>
  );
}

/**
 * One category choice.
 *
 * The selection cue is an accent spine that grows out from the centre of the
 * row's left edge, not a border that appears around the whole row: a border
 * change resizes nothing but reads as the row itself jumping, while a spine
 * animates in place and leaves the text exactly where the eye left it.
 */
function CategoryRow({
  item,
  selected,
  onPress,
}: {
  item: CategoryDef;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, motion, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const sel = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, {
      duration: motion.standard,
      easing: Easing.out(Easing.cubic),
    });
  }, [selected, motion.standard, sel]);

  const spineStyle = useAnimatedStyle(() => ({
    opacity: sel.value,
    transform: [{ scaleY: sel.value }],
  }));

  // A separate washed layer rather than an animated backgroundColor: opacity is
  // a UI-thread property, colour interpolation on a large view is not.
  const washStyle = useAnimatedStyle(() => ({ opacity: sel.value * 0.1 }));

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [`${item.color}1F`, item.color]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(sel.value, [0, 1], [colors.border, item.color]),
  }));

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: sel.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md, opacity: pressed ? 0.72 : 1 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: item.color }, washStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.spine, { backgroundColor: item.color, borderRadius: radius.pill }, spineStyle]}
      />

      <Animated.View style={[styles.rowIcon, chipStyle]}>
        <AnimatedIcon item={item} sel={sel} />
      </Animated.View>

      <View style={styles.rowBody}>
        <Text variant="bodySmall" weight="semiBold" numberOfLines={1}>{t(item.labelKey)}</Text>
        <Text variant="caption" secondary numberOfLines={2} style={styles.rowDesc}>{t(item.descKey)}</Text>
      </View>

      <Animated.View style={[styles.ring, ringStyle]}>
        <Animated.View style={[styles.dot, { backgroundColor: item.color }, dotStyle]} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The icon inside the chip. Its colour has to flip from the accent to white as
 * the chip fills in, and Ionicons' `color` prop isn't animatable — so two copies
 * are cross-faded instead.
 */
function AnimatedIcon({ item, sel }: { item: CategoryDef; sel: SharedValue<number> }) {
  const onStyle = useAnimatedStyle(() => ({ opacity: sel.value }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - sel.value }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, offStyle]}>
        <Ionicons name={item.icon} size={17} color={item.color} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, onStyle]}>
        <Ionicons name={item.icon} size={17} color="#FFFFFF" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  listCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  listDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spine: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowDesc: { lineHeight: 15 },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dropZone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed' },
  dropIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shotCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth },
  shotThumb: { width: 56, height: 56 },
  shotMeta: { flex: 1, gap: 5 },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  uploadRow: { gap: 5, marginBottom: 10 },
  uploadTrack: { height: 4, overflow: 'hidden' },
  submitWrap: { marginTop: 4 },
});
