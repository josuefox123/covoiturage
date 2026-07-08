import { Stack } from 'expo-router';

export default function PaymentLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="success" />
            <Stack.Screen name="failed" />
        </Stack>
    );
}
