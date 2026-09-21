// Subscription → Your requests → one request.
//
// This page answers three questions a waiting customer actually has, in the
// order they ask them: *where is my request right now*, *what did I send*, and
// *can I still fix it*. The old layout buried all three in an undifferentiated
// stack of boxes, so the redesign gives each one its own object:
//
//   1. A STATUS CROWN that states the outcome in the status's own colour, with
//      the amount as the hero number — the thing the customer parted with.
//   2. A TIMELINE, because "pending" means nothing on its own; it means
//      something once you can see it sits between "submitted" and "approved".
//   3. An EDIT WINDOW BAR that drains in real time. The 30-minute window was
//      previously a line of grey caption text under a button, which is the
//      least urgent way possible to render a deadline.
//
// MOTION RULE: only two things animate on a loop here — the pulse on the step
// the request is actually sitting at, and the draining edit bar. Both encode
// live state. Everything else animates once on entry and then holds still,
// because a page people re-open while anxious should not keep moving.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Image, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { showToast } from '@/src/core/store/toastStore';
import {
  fetchSubscriptionById,
  updateMySubscriptionDetails,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@/src/core/firebase/services/subscription';
import { uploadImageToCloudinary } from '@/src/core/media/cloudinary';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { TextField } from '@/src/components/inputs/TextField';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Preloading } from '@/src/components/Preloading';
import { SectionCard, InfoRow, StatusPill, QuotePanel, useTones, type Tone } from '@/src/components/premium';

const EDIT_WINDOW_MS = 30 * 60 * 1000;
const ON_GRADIENT = '#FFFFFF';
const ON_GRADIENT_SOFT = 'rgba(255,255,255,0.86)';
const ON_GRADIENT_FAINT = 'rgba(255,255,255,0.6)';

/** Crown gradient per outcome — the page's colour is the request's colour. */
const STATUS_GRADIENT: Record<SubscriptionStatus, [string, string]> = {
  pending: ['#B45309', '#D97706'],
  active: ['#047857', '#0D9488'],
  rejected: ['#B91C1C', '#DC2626'],
  expired: ['#475569', '#334155'],
};

function statusTone(status: SubscriptionStatus): Tone {
  if (status === 'active') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'expired') return 'neutral';
  return 'warning';
}

function statusIcon(status: SubscriptionStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'active') return 'checkmark-circle';
  if (status === 'rejected') return 'close-circle';
  if (status === 'expired') return 'time';
  return 'sparkles';
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showImage, setShowImage] = useState(false);
  const [imageScale, setImageScale] = useState(1);

  const { data: record, settled, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!id) return null;
    return fetchSubscriptionById(id);
  }, [id]);

  useEffect(() => {
    if (!record) return;
    setTransactionRef(record.transactionRef ?? '');
    setCustomerMessage(record.customerMessage ?? '');
    setScreenshotUri(record.screenshotUrl || null);
  }, [record]);

  const submittedMs = record?.submittedAt ? Date.parse(record.submittedAt) : NaN;
  const editDeadline = Number.isNaN(submittedMs) ? 0 : submittedMs + EDIT_WINDOW_MS;
  const remainingMs = editDeadline > 0 ? Math.max(0, editDeadline - now) : 0;
  const canEdit = !!record && record.status !== 'active' && remainingMs > 0;

  // The old timer ticked forever once a record loaded — including for requests
  // approved weeks ago. It now stops itself the moment the window closes, so a
  // settled request costs nothing per second.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    if (editDeadline <= 0 || editDeadline <= Date.now()) { stop(); return; }
    timerRef.current = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= editDeadline) stop();
    }, 1000);
    return stop;
  }, [editDeadline]);

  // Leaving edit mode open past the deadline would show a Save button that can
  // only ever fail, so the window closing closes the form with it.
  useEffect(() => {
    if (editMode && !canEdit && !saving) setEditMode(false);
  }, [editMode, canEdit, saving]);

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('subscription.uploadScreenshotHint'), 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) setScreenshotUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!record || !canEdit) {
      showToast(t('subscription.editWindowExpired'), 'warning');
      return;
    }
    if (!transactionRef.trim() || !screenshotUri) {
      showToast(`${t('subscription.transactionRef')} and ${t('subscription.uploadScreenshot')} required`, 'error');
      return;
    }
    setSaving(true);
    try {
      let screenshotUrl = screenshotUri;
      if (!screenshotUri.startsWith('http')) screenshotUrl = await uploadImageToCloudinary(screenshotUri);
      await updateMySubscriptionDetails(record.id, {
        transactionRef: transactionRef.trim(),
        screenshotUrl,
        customerMessage: customerMessage.trim() || null,
      });
      showToast(t('subscription.requestUpdated'), 'success');
      setEditMode(false);
      await refetch();
    } catch {
      showToast(t('subscription.requestUpdateError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SubpageScrollScreen title={t('subscription.viewDetails')} refreshing={refreshing} onRefresh={refresh}>
        {!settled ? (
          <View style={{ flex: 1 }}>
            <Preloading tinted={false} label={t('subscription.loading')} hint={t('loadHints.purchases')} />
          </View>
        ) : error || !record ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(420)}>
              <StatusCrown record={record} />
            </Animated.View>

            {record.status !== 'active' && record.status !== 'expired' ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <EditWindowBar
                  remainingMs={remainingMs}
                  canEdit={canEdit}
                  editing={editMode}
                  saving={saving}
                  onToggle={() => (editMode ? handleSave() : setEditMode(true))}
                />
              </Animated.View>
            ) : null}

            {record.adminMessage ? (
              <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                <QuotePanel tone="info" icon="chatbubble-ellipses-outline" caption={t('subscription.adminMessageTitle')} spine>
                  <Text variant="body">{record.adminMessage}</Text>
                </QuotePanel>
              </Animated.View>
            ) : null}

            {record.status === 'rejected' && record.rejectionReason ? (
              <Animated.View entering={FadeInDown.delay(140).duration(400)}>
                <QuotePanel tone="danger" icon="alert-circle-outline" caption={t('subscription.tagRejected')} spine>
                  <Text variant="body">{record.rejectionReason}</Text>
                </QuotePanel>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(180).duration(420)}>
              <SectionCard icon="git-commit-outline" title={t('subscription.requestTimeline')} tone="info">
                <RequestTimeline record={record} />
              </SectionCard>
            </Animated.View>

            {editMode ? (
              <Animated.View entering={FadeIn.duration(260)}>
                <SectionCard icon="create-outline" title={t('subscription.editRequest')} subtitle={t('subscription.adminReviewHint')} tone="warning">
                  <View style={{ gap: spacing.md }}>
                    <TextField
                      label={t('subscription.transactionRef')}
                      helperText={t('subscription.transactionRefHint')}
                      placeholder={t('subscription.transactionRefPlaceholder')}
                      value={transactionRef}
                      onChangeText={setTransactionRef}
                      autoCapitalize="characters"
                    />
                    <View style={{ gap: spacing.xs }}>
                      <Text variant="bodySmall" weight="semiBold" secondary>{t('subscription.uploadScreenshot')}</Text>
                      <Text variant="caption" secondary>{t('subscription.uploadScreenshotHint')}</Text>
                      {screenshotUri ? (
                        <Pressable onPress={() => { setImageScale(1); setShowImage(true); }} style={{ marginTop: spacing.xs }}>
                          <Image source={{ uri: screenshotUri }} style={[styles.screenshot, { borderRadius: radius.md }]} resizeMode="cover" />
                        </Pressable>
                      ) : null}
                      <Button
                        label={screenshotUri ? t('common.edit') : t('subscription.uploadScreenshot')}
                        variant="secondary"
                        onPress={pickScreenshot}
                        style={{ marginTop: spacing.xs }}
                      />
                    </View>
                    <TextField
                      label={t('subscription.customMessageLabel')}
                      placeholder={t('subscription.customMessagePlaceholder')}
                      value={customerMessage}
                      onChangeText={setCustomerMessage}
                      multiline
                      numberOfLines={3}
                    />
                    <Button label={t('common.cancel')} variant="secondary" onPress={() => setEditMode(false)} disabled={saving} />
                  </View>
                </SectionCard>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(220).duration(420)}>
              <SectionCard icon="receipt-outline" title={t('subscription.paymentSummary')} tone="primary">
                <View>
                  <InfoRow icon="diamond-outline" label={t('subscription.pendingPlan')} value={record.planName} divider />
                  <InfoRow icon="cash-outline" label={t('subscription.pendingAmount')} value={`Rs. ${record.amount}`} tone="success" divider />
                  <InfoRow icon="card-outline" label={t('subscription.pendingMethod')} value={record.method.toUpperCase()} divider />
                  <InfoRow
                    icon="barcode-outline"
                    label={t('subscription.pendingRef')}
                    value={record.transactionRef ?? '—'}
                    divider={!!record.couponCode || !!record.customerMessage}
                  />
                  {record.couponCode ? (
                    <InfoRow
                      icon="pricetag-outline"
                      label={t('subscription.couponCode')}
                      value={<StatusPill label={record.couponCode} tone="accent" size="sm" icon="pricetag" />}
                      divider={!!record.customerMessage}
                    />
                  ) : null}
                  {record.customerMessage ? (
                    <InfoRow icon="chatbox-outline" label={t('subscription.customMessageLabel')} value={record.customerMessage} stacked />
                  ) : null}
                </View>
              </SectionCard>
            </Animated.View>

            {record.screenshotUrl ? (
              <Animated.View entering={FadeInDown.delay(260).duration(420)}>
                <SectionCard
                  icon="image-outline"
                  title={t('subscription.receiptTitle')}
                  tone="accent"
                  trailing={<StatusPill label={t('subscription.tapToZoom')} tone="neutral" size="sm" icon="scan-outline" />}
                >
                  <Pressable onPress={() => { setImageScale(1); setShowImage(true); }}>
                    {({ pressed }) => (
                      <View style={[styles.receiptFrame, { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.82 : 1 }]}>
                        <Image source={{ uri: record.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
                        <View style={styles.receiptScrim}>
                          <Ionicons name="expand-outline" size={16} color="#FFF" />
                        </View>
                      </View>
                    )}
                  </Pressable>
                </SectionCard>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(300).duration(420)} style={[styles.actionRow, { gap: spacing.sm }]}>
              <Button label={t('subscription.renewNow')} variant="secondary" onPress={() => router.replace('/subscription')} style={{ flex: 1 }} />
              <Button label={t('subscription.contactSupport')} variant="secondary" onPress={() => router.push('/contact-us')} style={{ flex: 1 }} />
            </Animated.View>
          </>
        )}
      </SubpageScrollScreen>

      <PageLoaderOverlay visible={saving} label={t('subscription.loading')} />

      <Modal visible={showImage && !!screenshotUri} transparent animationType="fade" onRequestClose={() => setShowImage(false)}>
        <View style={styles.imageModal}>
          <View style={styles.imageModalHeader}>
            <Text variant="bodyLarge" weight="bold" style={{ color: '#FFF' }}>{t('subscription.receiptTitle')}</Text>
            <Pressable onPress={() => setShowImage(false)} hitSlop={12} style={styles.zoomButton}>
              <Ionicons name="close" size={22} color="#FFF" />
            </Pressable>
          </View>
          <View style={styles.imageStage}>
            <Image source={{ uri: screenshotUri ?? undefined }} style={[styles.fullscreenImage, { transform: [{ scale: imageScale }] }]} resizeMode="contain" />
          </View>
          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomButton} onPress={() => setImageScale((value) => Math.max(1, value - 0.25))}>
              <Ionicons name="remove" size={22} color="#FFF" />
            </Pressable>
            <View style={styles.zoomReadout}>
              <Text variant="bodySmall" weight="bold" style={{ color: '#FFF' }}>{Math.round(imageScale * 100)}%</Text>
            </View>
            <Pressable style={styles.zoomButton} onPress={() => setImageScale((value) => Math.min(4, value + 0.25))}>
              <Ionicons name="add" size={22} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ===================== Status crown =====================

function StatusCrown({ record }: { record: SubscriptionRecord }) {
  const { spacing, radius } = useTheme();
  const { t } = useTranslation();
  const gradient = STATUS_GRADIENT[record.status];

  const label =
    record.status === 'active'
      ? t('subscription.tagApproved')
      : record.status === 'rejected'
        ? t('subscription.tagRejected')
        : record.status === 'expired'
          ? t('subscription.tagExpired')
          : t('subscription.tagNew');

  return (
    <View style={[styles.crown, { borderRadius: radius.lg }]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassEdge, { borderRadius: radius.lg }]} />

        <View style={styles.crownTop}>
          <View style={[styles.crownMedallion, styles.onGradientChip]}>
            <Ionicons name={statusIcon(record.status)} size={22} color={ON_GRADIENT} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="overline" weight="bold" style={{ color: ON_GRADIENT_FAINT }}>{label}</Text>
            <Text variant="h3" weight="bold" style={{ color: ON_GRADIENT }} numberOfLines={1}>{record.planName}</Text>
          </View>
        </View>

        <View style={[styles.crownAmountRow, { marginTop: spacing.md }]}>
          <Text variant="display" weight="bold" style={{ color: ON_GRADIENT }}>Rs. {record.amount}</Text>
          <Text variant="bodySmall" style={{ color: ON_GRADIENT_SOFT, marginBottom: 6 }}>{record.method.toUpperCase()}</Text>
        </View>

        {record.submittedAt ? (
          <View style={[styles.crownChip, styles.onGradientChip, { marginTop: spacing.sm }]}>
            <Ionicons name="calendar-outline" size={12} color={ON_GRADIENT} />
            <Text variant="caption" weight="semiBold" style={{ color: ON_GRADIENT, flexShrink: 1 }} numberOfLines={1}>
              {formatDateTime(record.submittedAt)}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

// ===================== Edit window =====================

/**
 * The 30-minute correction window, drawn as a draining bar.
 *
 * The bar's width is driven on the UI thread by a shared value that is retargeted
 * once per tick, so the fill glides instead of stepping a second at a time — the
 * JS side still only re-renders once per second.
 */
function EditWindowBar({
  remainingMs,
  canEdit,
  editing,
  saving,
  onToggle,
}: {
  remainingMs: number;
  canEdit: boolean;
  editing: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const tone = canEdit ? tones.warning : tones.neutral;

  const percent = Math.max(0, Math.min(100, (remainingMs / EDIT_WINDOW_MS) * 100));
  const progress = useSharedValue(percent);

  useEffect(() => {
    progress.value = withTiming(percent, { duration: 950, easing: Easing.linear });
  }, [percent, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View
      style={[
        styles.editWindow,
        { backgroundColor: colors.surface, borderColor: tone.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
      ]}
    >
      <View style={styles.editWindowTop}>
        <View style={[styles.editWindowIcon, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.md }]}>
          <Ionicons name={canEdit ? 'hourglass-outline' : 'lock-closed-outline'} size={17} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodySmall" weight="bold">
            {canEdit ? t('subscription.editWindowOpen') : t('subscription.editWindowExpired')}
          </Text>
          <Text variant="caption" secondary numberOfLines={1}>
            {canEdit ? `${t('subscription.editTimeRemaining')} · ${formatDuration(remainingMs)}` : t('subscription.adminReviewHint')}
          </Text>
        </View>
        {canEdit ? (
          <View style={[styles.countdownChip, { backgroundColor: tone.bg, borderColor: tone.border, borderRadius: radius.md }]}>
            <Text variant="bodySmall" weight="bold" style={{ color: tone.fg, fontVariant: ['tabular-nums'] }}>
              {formatDuration(remainingMs)}
            </Text>
          </View>
        ) : null}
      </View>

      {canEdit ? (
        <View style={[styles.meterTrack, { backgroundColor: colors.surfaceAlt }]}>
          <Animated.View style={[styles.meterFill, { backgroundColor: tone.solid }, fillStyle]} />
        </View>
      ) : null}

      <Button
        label={editing ? t('subscription.saveRequest') : t('subscription.editRequest')}
        loading={saving}
        disabled={!canEdit}
        onPress={onToggle}
        icon={<Ionicons name={editing ? 'checkmark-outline' : 'create-outline'} size={17} color="#FFF" style={{ marginRight: 6 }} />}
      />
    </View>
  );
}

// ===================== Timeline =====================

type StepState = 'done' | 'current' | 'upcoming' | 'failed';

interface TimelineStep {
  key: string;
  title: string;
  timestamp: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  state: StepState;
  tone: Tone;
}

function RequestTimeline({ record }: { record: SubscriptionRecord }) {
  const { t } = useTranslation();

  const steps = useMemo<TimelineStep[]>(() => {
    const reviewed = !!record.reviewedAt || record.status !== 'pending';

    const final: TimelineStep =
      record.status === 'active'
        ? { key: 'approved', title: t('subscription.timelineApproved'), timestamp: record.startDate ?? record.reviewedAt, icon: 'checkmark-circle', state: 'done', tone: 'success' }
        : record.status === 'rejected'
          ? { key: 'rejected', title: t('subscription.timelineRejected'), timestamp: record.reviewedAt, icon: 'close-circle', state: 'failed', tone: 'danger' }
          : record.status === 'expired'
            ? { key: 'expired', title: t('subscription.timelineExpired'), timestamp: record.expiryDate, icon: 'time', state: 'done', tone: 'neutral' }
            : { key: 'approved', title: t('subscription.timelineApproved'), timestamp: null, icon: 'checkmark-circle-outline', state: 'upcoming', tone: 'neutral' };

    return [
      {
        key: 'submitted',
        title: t('subscription.timelineSubmitted'),
        timestamp: record.submittedAt,
        icon: 'paper-plane',
        state: 'done',
        tone: 'info',
      },
      {
        key: 'review',
        title: t('subscription.timelineUnderReview'),
        timestamp: record.reviewedAt,
        icon: 'search',
        state: reviewed ? 'done' : 'current',
        tone: reviewed ? 'info' : 'warning',
      },
      final,
    ];
  }, [record, t]);

  return (
    <View>
      {steps.map((step, index) => (
        <TimelineRow key={step.key} step={step} index={index} last={index === steps.length - 1} />
      ))}
    </View>
  );
}

function TimelineRow({ step, index, last }: { step: TimelineStep; index: number; last: boolean }) {
  const { colors, spacing } = useTheme();
  const tones = useTones();
  const tone = tones[step.tone];
  const dim = step.state === 'upcoming';

  // The one looping animation on the page: it marks the step the request is
  // actually sitting at. Anything else pulsing here would be decoration.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (step.state !== 'current') return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 780, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 780, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => { pulse.value = 1; };
  }, [step.state, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(220 + index * 90).duration(380)} style={styles.timelineRow}>
      {/* alignItems:'stretch' on the row lets this rail stretch to the content's
          height, so the connector's flex:1 always reaches the next node no
          matter how tall the row's text runs. */}
      <View style={styles.timelineRail}>
        <Animated.View
          style={[
            styles.timelineNode,
            {
              backgroundColor: dim ? colors.surfaceAlt : tone.bg,
              borderColor: dim ? colors.border : tone.border,
            },
            pulseStyle,
          ]}
        >
          <Ionicons name={step.icon} size={15} color={dim ? colors.textDisabled : tone.fg} />
        </Animated.View>
        {!last ? <View style={[styles.timelineConnector, { backgroundColor: colors.divider }]} /> : null}
      </View>

      <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.md, gap: 3 }}>
        <Text
          variant="body"
          weight={step.state === 'upcoming' ? 'regular' : 'semiBold'}
          style={{ color: dim ? colors.textDisabled : colors.textPrimary }}
        >
          {step.title}
        </Text>
        {step.timestamp ? (
          <Text variant="caption" secondary>{formatDateTime(step.timestamp)}</Text>
        ) : step.state === 'current' ? (
          <StatusPill label="•••" tone="warning" size="sm" />
        ) : null}
      </View>
    </Animated.View>
  );
}

// ===================== helpers =====================

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  // Crown
  crown: { overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  crownTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crownMedallion: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  crownAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  crownChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start', maxWidth: '100%' },
  onGradientChip: { backgroundColor: 'rgba(255,255,255,0.20)' },
  glassEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },

  // Edit window
  editWindow: { borderWidth: StyleSheet.hairlineWidth },
  editWindowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editWindowIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  countdownChip: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth },
  meterTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999 },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  timelineRail: { width: 30, alignItems: 'center' },
  timelineNode: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  timelineConnector: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },

  // Receipt
  receiptFrame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  screenshot: { width: '100%', height: 200 },
  receiptScrim: { position: 'absolute', right: 10, bottom: 10, width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },

  actionRow: { flexDirection: 'row', alignItems: 'center' },

  // Zoom modal
  imageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', paddingTop: 46, paddingBottom: 24 },
  imageModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 },
  imageStage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fullscreenImage: { width: '100%', height: '82%' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  zoomButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  zoomReadout: { minWidth: 58, alignItems: 'center' },
});
