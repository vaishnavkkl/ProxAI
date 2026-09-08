import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getFinlifeNative } from '@/services/finlife-native';
import { SUBSCRIPTION_APPS } from '@/utils/subscription-apps';
import { SUBSCRIPTION_ICONS } from '@/utils/subscription-icons';
import { colors } from '@/styles';

const cache = new Map<string, Promise<string | null>>();
function resolveApp(id: string, name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = { amazonprime: 'prime', primevideo: 'prime', disneyhotstar: 'hotstar', hotstar: 'hotstar', youtubepremium: 'youtube', appletvplus: 'appletv' };
  return SUBSCRIPTION_APPS.find((app) => `app-${app.id}` === id || app.id === aliases[normalized] || app.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
}
export function SubscriptionIcon({ id, name }: { id: string; name: string }) {
  const app = resolveApp(id, name);
  const [local, setLocal] = useState<{ id: string; uri: string } | null>(null);
  useEffect(() => {
    if (!app) return;
    let active = true;
    if (!cache.has(app.id)) cache.set(app.id, getFinlifeNative()?.getAppIcon?.(app.packageName).catch(() => null) ?? Promise.resolve(null));
    void cache.get(app.id)!.then((uri) => { if (active && uri) setLocal({ id: app.id, uri }); });
    return () => { active = false; };
  }, [app]);
  const source = app && local?.id === app.id ? { uri: local.uri } : app ? SUBSCRIPTION_ICONS[app.id] : undefined;
  return <View style={styles.wrap}>{source ? <Image source={source} recyclingKey={app?.id} contentFit="contain" style={styles.image} accessibilityLabel={`${name} app icon`} /> : <Ionicons name="play-circle-outline" size={30} color={colors.primary[600]} />}</View>;
}
const styles = StyleSheet.create({ wrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.neutral[0] }, image: { width: 48, height: 48 } });
