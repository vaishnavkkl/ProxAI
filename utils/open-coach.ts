import { router, type Href } from 'expo-router';

/** Reuse the Chat tab, including when opening a question from another screen. */
export function openCoach() {
  router.navigate('/(tabs)/chat' as Href);
}
