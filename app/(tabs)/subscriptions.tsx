import { Redirect } from 'expo-router';

export default function SubscriptionsRoute() {
  return <Redirect href={{ pathname: '/(tabs)/finance', params: { section: 'renewals' } }} />;
}
