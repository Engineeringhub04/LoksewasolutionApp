import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchConstitutionPart, type ConstitutionContentNode, type ConstitutionLanguage } from '@/src/core/services/constitution';

function childNodes(node: ConstitutionContentNode): ConstitutionContentNode[] {
  const childKeys: Array<keyof ConstitutionContentNode> = ['children', 'items', 'rows', 'cells', 'content'];
  for (const key of childKeys) {
    const value = node[key];
    if (Array.isArray(value)) return value.filter((item): item is ConstitutionContentNode => Boolean(item && typeof item === 'object'));
  }
  return [];
}

function nodeText(node: ConstitutionContentNode): string {
  return typeof node.text === 'string' ? node.text.trim() : '';
}

function numberPrefix(node: ConstitutionContentNode): string {
  const value = node.number;
  if (value === undefined || value === null || String(value).trim() === '' || String(value) === '0') return '';
  const normalized = String(value).trim();
  return /[.)。、]$/.test(normalized) ? `${normalized} ` : `${normalized}. `;
}

function articleHeading(node: ConstitutionContentNode, language: ConstitutionLanguage): string {
  const articleNo = node.articleNo;
  const title = typeof node.title === 'string' ? node.title.trim() : '';
  const prefix = articleNo === undefined || articleNo === null
    ? ''
    : language === 'np' ? `धारा ${articleNo}` : `Article ${articleNo}`;
  return [prefix, title].filter(Boolean).join(': ');
}

function ContentNodeView({ node, depth = 0, language }: { node: ConstitutionContentNode; depth?: number; language: ConstitutionLanguage }) {
  const { colors, spacing, radius } = useTheme();
  const tag = String(node.tag ?? 'paragraph').toLowerCase();
  const text = `${numberPrefix(node)}${nodeText(node)}`;
  const articleTitle = articleHeading(node, language);
  const children = childNodes(node);
  const hasChildren = children.length > 0;
  const renderChildren = () => children.map((child, index) => (
    <ContentNodeView key={`${tag}-${index}`} node={child} depth={depth + 1} language={language} />
  ));

  if (tag === 'heading') {
    return (
      <View style={[styles.headingBlock, { borderLeftColor: colors.primary, paddingLeft: spacing.sm, marginLeft: Math.min(depth, 2) * 4 }]}>
        {text ? <Text variant="body" weight="bold" style={{ color: colors.textPrimary }}>{text}</Text> : null}
        {hasChildren ? renderChildren() : null}
      </View>
    );
  }

  if (tag === 'article') {
    return (
      <View style={[styles.articleBlock, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        {articleTitle ? <Text variant="body" weight="bold" style={{ color: colors.textPrimary }}>{articleTitle}</Text> : text ? <Text variant="body" weight="bold" style={{ color: colors.textPrimary }}>{text}</Text> : null}
        {hasChildren ? <View style={styles.articleChildren}>{renderChildren()}</View> : null}
      </View>
    );
  }

  if (tag === 'note') {
    return (
      <View style={[styles.noteBlock, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
        {text ? <Text variant="caption" secondary style={styles.noteText}>{text}</Text> : null}
        {hasChildren ? renderChildren() : null}
      </View>
    );
  }

  if (tag === 'list-item') {
    return (
      <View style={[styles.listItem, { marginLeft: Math.min(depth, 3) * 10 }]}>
        <Text variant="body" weight="bold" color={colors.primary} style={styles.listDot}>•</Text>
        <View style={styles.listContent}>
          {text ? <Text variant="body" style={{ color: colors.textPrimary }}>{text}</Text> : null}
          {hasChildren ? renderChildren() : null}
        </View>
      </View>
    );
  }

  if (tag === 'table') {
    return (
      <View style={[styles.tableBlock, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
        {text ? <Text variant="caption" weight="semiBold" style={{ color: colors.textPrimary }}>{text}</Text> : null}
        {hasChildren ? renderChildren() : null}
      </View>
    );
  }

  if (tag === 'row') {
    return (
      <View style={[styles.tableRow, { borderBottomColor: colors.divider }]}>
        {text ? <Text variant="caption" style={{ color: colors.textPrimary, flex: 1 }}>{text}</Text> : null}
        {hasChildren ? renderChildren() : null}
      </View>
    );
  }

  if (tag === 'cell') {
    return (
      <View style={styles.tableCell}>
        {text ? <Text variant="caption" style={{ color: colors.textPrimary }}>{text}</Text> : null}
        {hasChildren ? renderChildren() : null}
      </View>
    );
  }

  return (
    <View style={[styles.paragraphBlock, { marginLeft: Math.min(depth, 3) * 8 }]}>
      {text ? <Text variant="body" style={{ color: colors.textPrimary }}>{text}</Text> : null}
      {hasChildren ? renderChildren() : null}
    </View>
  );
}

export default function ConstitutionDetailScreen() {
  const { colors, effective, setMode } = useTheme();
  const params = useLocalSearchParams<{ sectionId?: string | string[] }>();
  const [language, setLanguage] = useState<ConstitutionLanguage>('np');
  const sectionId = Array.isArray(params.sectionId) ? params.sectionId[0] : params.sectionId;
  const part = useAsyncData(() => fetchConstitutionPart(sectionId ?? ''), [sectionId], { enabled: Boolean(sectionId) });
  const content = useMemo(() => {
    if (!part.data) return [];
    return language === 'np' ? part.data.containnp : part.data.containen;
  }, [language, part.data]);
  const title = language === 'np' ? part.data?.titleNp ?? 'संविधान' : part.data?.titleEn ?? 'Constitution';
  const switchLanguage = () => setLanguage((current) => current === 'np' ? 'en' : 'np');

  const rightSlot = (
    <View style={styles.headerActions}>
      <Pressable onPress={switchLanguage} accessibilityRole="button" accessibilityLabel="Change Constitution language" style={styles.languageButton}>
        <Ionicons name="language-outline" size={17} color="#FFF" />
        <Text variant="caption" weight="bold" style={styles.languageText}>{language === 'np' ? 'EN' : 'ने'}</Text>
      </Pressable>
      <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />
    </View>
  );

  if (part.loading && !part.data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SubpageHeader title="संविधान" rightSlot={rightSlot} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" weight="semiBold" secondary style={styles.stateText}>Content loading...</Text>
        </View>
      </View>
    );
  }

  if (part.error && !part.data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SubpageHeader title="संविधान" rightSlot={rightSlot} />
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.textSecondary} />
          <Text variant="h3" weight="bold" style={styles.stateTitle}>Content unavailable</Text>
          <Text variant="bodySmall" secondary style={styles.stateDescription}>यो section खोल्न internet connection आवश्यक छ। पहिले download भएको section भए offline मा पनि खुल्छ।</Text>
          <Button label="Retry" onPress={part.refetch} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubpageHeader title={title} rightSlot={rightSlot} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.readerHeader, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Text variant="caption" weight="semiBold" secondary>
            {language === 'np' ? part.data?.legalReferenceNp ?? part.data?.sectionType : part.data?.legalReferenceEn ?? part.data?.sectionType}
          </Text>
          <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, marginTop: 5 }}>{title}</Text>
        </View>
        <View style={styles.readerBody}>
          {content.map((node, index) => <ContentNodeView key={`${node.tag ?? 'node'}-${index}`} node={node} language={language} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  languageButton: { height: 36, minWidth: 42, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  languageText: { color: '#FFF' },
  readerHeader: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  readerBody: { gap: 10 },
  headingBlock: { borderLeftWidth: 3, paddingVertical: 6, marginTop: 6 },
  articleBlock: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 4 },
  articleChildren: { marginTop: 8, gap: 6 },
  paragraphBlock: { paddingVertical: 3 },
  noteBlock: { padding: 11, marginVertical: 3 },
  noteText: { lineHeight: 19 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  listDot: { width: 18, lineHeight: 22 },
  listContent: { flex: 1 },
  tableBlock: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginVertical: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, padding: 8 },
  tableCell: { flex: 1, paddingHorizontal: 4 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  stateText: { marginTop: 12 },
  stateTitle: { marginTop: 14, textAlign: 'center' },
  stateDescription: { textAlign: 'center', marginTop: 8, marginBottom: 18, lineHeight: 20 },
});
