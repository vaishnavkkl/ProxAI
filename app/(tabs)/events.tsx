import { Redirect } from 'expo-router';

export default function EventsRoute() {
  return <Redirect href={{ pathname: '/(tabs)/finance', params: { section: 'events' } }} />;
}
