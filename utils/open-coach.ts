import { router, type Href } from 'expo-router';

/** One chat route on the stack. Does not push a second assistant screen. */
export function openCoach() {
  router.navigate('/coach' as Href, { dangerouslySingular: true });
}
