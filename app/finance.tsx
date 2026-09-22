import { Redirect } from 'expo-router';

export default function FinanceRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/finance', params: { section: 'finance' } }} />;
}
