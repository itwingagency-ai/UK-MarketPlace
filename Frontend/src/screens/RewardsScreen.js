import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Share, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getMyRewards } from '../api/rewards.api';
import { formatPence } from '../components/ProductCard';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

/**
 * Rewards: points balance, what it's worth, history, and the invite code.
 * Every number comes from the server; this screen only displays it.
 */
const TYPE_COPY = {
  earn: 'Earned',
  redeem: 'Spent',
  restore: 'Returned',
  reverse: 'Taken back',
  expire: 'Expired',
  referral: 'Friend joined',
  adjust: 'Adjustment',
};

function HistoryRow({ entry }) {
  const positive = entry.points > 0;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: positive ? Colors.successBg : Colors.surfaceSecondary }]}>
        <Feather name={positive ? 'plus' : 'minus'} size={14} color={positive ? Colors.successText : Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{TYPE_COPY[entry.type] || entry.type}{entry.orderNumber ? ` · #${entry.orderNumber}` : ''}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {entry.note ? ` · ${entry.note}` : ''}
        </Text>
      </View>
      <Text style={[styles.rowPoints, { color: positive ? Colors.successText : Colors.text }]}>
        {positive ? `+${entry.points}` : entry.points}
      </Text>
    </View>
  );
}

export default function RewardsScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyRewards(1);
      setData(res);
      setHistory(res.history || []);
      setPage(1);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load your rewards");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const more = async () => {
    if (!data || loadingMore || history.length >= data.total) return;
    setLoadingMore(true);
    try {
      const res = await getMyRewards(page + 1);
      setHistory((prev) => [...prev, ...(res.history || [])]);
      setPage(page + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  const invite = async () => {
    const r = data?.referral;
    if (!r) return;
    await Share.share({
      message: `Join me on UK Marketplace and get ${formatPence(r.friendGets)} off your first order${r.friendMinSpend ? ` over ${formatPence(r.friendMinSpend)}` : ''}. Use my invite code ${r.code} when you sign up.`,
    }).catch(() => {});
  };

  const header = (
    <View style={styles.headerBar}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
        <Feather name="arrow-left" size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.title}>Rewards</Text>
    </View>
  );

  if (error || !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {header}
        <View style={styles.center}>
          {error ? (
            <>
              <Text style={styles.muted}>{error}</Text>
              <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
            </>
          ) : <ActivityIndicator color={Colors.primary} />}
        </View>
      </SafeAreaView>
    );
  }

  if (!data.enabled) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {header}
        <View style={styles.center}>
          <Feather name="gift" size={36} color={Colors.muted} />
          <Text style={[styles.muted, { marginTop: Spacing.md }]}>Rewards aren't running right now. Any points you have are kept.</Text>
          {data.balance > 0 ? <Text style={styles.cardSub}>{data.balance} points saved</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  const r = data.rates;
  const listHeader = (
    <View style={{ gap: Spacing.base }}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your points</Text>
        <Text style={styles.balance}>{data.balance.toLocaleString('en-GB')}</Text>
        <Text style={styles.balanceValue}>Worth {formatPence(data.value)} at checkout</Text>
        {data.expiringSoon > 0 ? (
          <Text style={styles.expiring}>{data.expiringSoon} points expire in the next 30 days if not used</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Text style={styles.cardSub}>
          Earn {r.earnPointsPerPound} point{r.earnPointsPerPound === 1 ? '' : 's'} for every £1 you spend at stores marked Rewards, once your order is delivered or collected.
          {' '}{Math.round(100 / r.pointValuePence)} points = £1 off. Use them at checkout (from {r.minRedeemPoints} points). Points last {r.expiryMonths} months.
        </Text>
      </View>

      {data.referral ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invite a friend</Text>
          <Text style={styles.cardSub}>
            They get {formatPence(data.referral.friendGets)} off their first order. You get {data.referral.referrerPoints} points when it's delivered.
          </Text>
          <View style={styles.codeRow}>
            <Text style={styles.code} selectable>{data.referral.code}</Text>
            <Pressable style={styles.shareBtn} onPress={invite} accessibilityLabel="Share your invite code">
              <Feather name="share-2" size={16} color={Colors.white} />
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
          </View>
          {data.referral.invited > 0 ? (
            <Text style={styles.cardSub}>{data.referral.invited} friend{data.referral.invited === 1 ? '' : 's'} joined · {data.referral.rewarded} rewarded</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.section}>History</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {header}
      <FlatList
        data={history}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => <HistoryRow entry={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Text style={styles.muted}>No points yet. Your first order at a Rewards store starts it off.</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ margin: Spacing.base }} /> : null}
        onEndReached={more}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.base, paddingBottom: 120, gap: Spacing.sm }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  title: { fontFamily: Typography.family.displayExtrabold, fontSize: 24, color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  muted: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retry: { marginTop: Spacing.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.primary },
  retryText: { fontFamily: Typography.family.bold, color: Colors.white },
  balanceCard: { borderRadius: Radius['2xl'], padding: Spacing.lg, backgroundColor: Colors.primary, ...Shadow.md },
  balanceLabel: { fontFamily: Typography.family.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balance: { fontFamily: Typography.family.displayExtrabold, fontSize: 40, color: Colors.white, marginTop: 2 },
  balanceValue: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.white },
  expiring: { fontFamily: Typography.family.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.sm },
  card: { borderRadius: Radius['2xl'], padding: Spacing.base, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, gap: Spacing.sm },
  cardTitle: { fontFamily: Typography.family.display, fontSize: 16, color: Colors.text },
  cardSub: { fontFamily: Typography.family.regular, fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  code: {
    flex: 1,
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 22,
    letterSpacing: 3,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    textAlign: 'center',
  },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: Spacing.base, borderRadius: Radius.lg, backgroundColor: Colors.primary },
  shareText: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.white },
  section: { fontFamily: Typography.family.display, fontSize: 16, color: Colors.text, marginTop: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  rowIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  rowSub: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  rowPoints: { fontFamily: Typography.family.bold, fontSize: 15 },
});
