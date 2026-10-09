import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Route de secours pour capturer les redirections Deep Link "zemy://payments?ref=..."
 * et les rediriger vers la page de succès officielle "/payment/success".
 */
export default function PaymentsRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/payment/success',
      params: params,
    });
  }, [params, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}
