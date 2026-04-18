import { ForgotPasswordScreen } from '@/src/screens/mf-go-auth/components/forgot-password-screen';
import { useLocalSearchParams } from 'expo-router';

function pickParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return undefined;
}

export default function ForgotPasswordRoute() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = pickParam(params.email);
  return <ForgotPasswordScreen initialEmail={initialEmail} />;
}
