import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Linking, Platform, ScrollView, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { getAppConfig } from '../api/app.api';
import Button from './Button';
import { Colors, Spacing, Typography, Radius } from '../theme';

/**
 * Runs once at start-up, around the whole app:
 *   - version gate: GET /app/config says none / soft / required. Required
 *     blocks the app with an Update button; soft shows a dismissible prompt
 *     once per new version.
 *   - first-run onboarding: three short slides for shoppers, once.
 * Network errors never block the app.
 */
const SOFT_KEY = 'app.softUpdateDismissed';
const ONBOARDED_KEY = 'app.onboarded';

const SLIDES = [
  { icon: 'map-pin', title: 'Local shops, one basket', body: 'Enter your postcode to see stores that deliver to you, or that you can collect from.' },
  { icon: 'clock', title: 'Now or later', body: 'Get it as soon as possible, or book a delivery or collection time that suits you.' },
  { icon: 'gift', title: 'Offers and rewards', body: 'Codes, automatic offers and points at stores marked Rewards. Invite friends for more.' },
];

function Onboarding({ onDone }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const last = page === SLIDES.length - 1;
  const next = () => {
    if (last) return onDone();
    ref.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage(page + 1);
    return undefined;
  };
  return (
    <View style={styles.onboarding}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View style={styles.slideIcon}><Feather name={s.icon} size={40} color={Colors.primary} /></View>
            <Text style={styles.slideTitle}>{s.title}</Text>
            <Text style={styles.slideBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {SLIDES.map((s, i) => <View key={s.title} style={[styles.dot, i === page && styles.dotActive]} />)}
      </View>
      <View style={styles.onboardingActions}>
        <Pressable onPress={onDone} hitSlop={10}><Text style={styles.skip}>Skip</Text></Pressable>
        <Button title={last ? 'Start shopping' : 'Next'} onPress={next} style={{ minWidth: 160 }} />
      </View>
    </View>
  );
}

export default function AppGate({ role, children }) {
  const [config, setConfig] = useState(null);
  const [softOpen, setSoftOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const version = Constants.expoConfig?.version || '0.0.0';

  useEffect(() => {
    let alive = true;
    getAppConfig(Platform.OS, version)
      .then(async (cfg) => {
        if (!alive) return;
        setConfig(cfg);
        if (cfg.update === 'soft') {
          const dismissed = await AsyncStorage.getItem(SOFT_KEY).catch(() => null);
          if (dismissed !== cfg.latestVersion) setSoftOpen(true);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [version]);

  useEffect(() => {
    if (role === 'vendor' || role === 'rider') return;
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => { if (!v) setOnboarding(true); })
      .catch(() => {});
  }, [role]);

  const finishOnboarding = () => {
    setOnboarding(false);
    AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
  };

  const openStore = () => config?.storeUrl && Linking.openURL(config.storeUrl).catch(() => {});

  if (config?.update === 'required') {
    return (
      <View style={styles.blocked}>
        <Feather name="download" size={44} color={Colors.primary} />
        <Text style={styles.blockedTitle}>Please update the app</Text>
        <Text style={styles.blockedBody}>
          {config.message || 'This version is no longer supported. Update to keep shopping.'}
        </Text>
        {config.storeUrl ? <Button title="Update now" onPress={openStore} style={{ marginTop: Spacing.lg, minWidth: 200 }} /> : null}
      </View>
    );
  }

  if (onboarding) return <Onboarding onDone={finishOnboarding} />;

  return (
    <>
      {children}
      <Modal visible={softOpen} transparent animationType="fade" onRequestClose={() => setSoftOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.softCard}>
            <Text style={styles.softTitle}>A new version is available</Text>
            <Text style={styles.blockedBody}>{config?.message || 'Update for the latest fixes and features.'}</Text>
            <View style={styles.softActions}>
              <Pressable
                onPress={() => {
                  setSoftOpen(false);
                  AsyncStorage.setItem(SOFT_KEY, config?.latestVersion || '').catch(() => {});
                }}
                hitSlop={8}
              >
                <Text style={styles.skip}>Not now</Text>
              </Pressable>
              {config?.storeUrl ? <Button title="Update" onPress={openStore} /> : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.bg },
  blockedTitle: { fontFamily: Typography.family.displayExtrabold, fontSize: 24, color: Colors.text, marginTop: Spacing.lg, textAlign: 'center' },
  blockedBody: { fontFamily: Typography.family.regular, fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  softCard: { width: '100%', borderRadius: Radius['2xl'], padding: Spacing.lg, backgroundColor: Colors.surface },
  softTitle: { fontFamily: Typography.family.display, fontSize: 18, color: Colors.text, textAlign: 'center' },
  softActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
  onboarding: { flex: 1, backgroundColor: Colors.bg, paddingTop: 80, paddingBottom: 40 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  slideIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primarySubtle },
  slideTitle: { fontFamily: Typography.family.displayExtrabold, fontSize: 26, color: Colors.text, marginTop: Spacing.xl, textAlign: 'center' },
  slideBody: { fontFamily: Typography.family.regular, fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 22, backgroundColor: Colors.primary },
  onboardingActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl },
  skip: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.textSecondary },
});
