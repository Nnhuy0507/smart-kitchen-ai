import React, { useRef, useState } from 'react';
import { Pressable, Text, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { createGoogleBrowserSession, completeGoogleBrowserSession } from '../lib/api';

export type GoogleLoginButtonProps = {
  disabled?: boolean;
  variant?: "signin" | "signup";
  onCredential: (token: string) => void | Promise<void>;
};

export default function GoogleLoginButton({ disabled, onCredential, variant = "signin" }: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function signIn() {
    if (busy.current || disabled) return;
    setError('');
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      busy.current = true;
      setLoading(true);
      try {
        const session = await createGoogleBrowserSession();
        await WebBrowser.openBrowserAsync(session.browserUrl);
        const idToken = await completeGoogleBrowserSession(session.sessionId, session.secret);
        await onCredential(idToken);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập Google. Hãy thử lại.');
      } finally {
        busy.current = false;
        setLoading(false);
      }
      return;
    }
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
    if (!iosClientId || iosClientId.startsWith('YOUR_') || !webClientId || webClientId.startsWith('YOUR_')) {
      setError('Điền GOOGLE_IOS_CLIENT_ID và GOOGLE_WEB_CLIENT_ID có tiền tố EXPO_PUBLIC_ trong mobile/.env.local, rồi build lại iOS.');
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      // Load only in a native development/production build, never in Expo Go.
      const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ iosClientId, webClientId, offlineAccess: false });
      try {
        const result = await GoogleSignin.signIn();
        if (!isSuccessResponse(result)) return; // User dismissed account selection.
        if (!result.data.idToken) throw new Error('Google không trả về ID token. Kiểm tra Web Client ID.');
        await onCredential(result.data.idToken);
      } catch (cause) {
        if (isErrorWithCode(cause) && cause.code === statusCodes.SIGN_IN_CANCELLED) return;
        throw cause;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập Google. Kiểm tra cấu hình iOS và build lại ứng dụng.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  if (Platform.OS !== 'ios') return <Text>Đăng nhập Google hỗ trợ trên web và iOS.</Text>;
  return <>
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={signIn}
      style={{ borderWidth: 1, borderColor: '#EED9CF', borderRadius: 12, padding: 14, alignItems: 'center', opacity: disabled || loading ? 0.6 : 1 }}>
      <Text style={{ color: '#201A17', fontWeight: '600' }}>{loading ? 'Đang xác thực…' : variant === 'signup' ? 'Đăng ký với Google' : 'Tiếp tục với Google'}</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#A23A00', marginTop: 8 }}>{error}</Text>}
  </>;
}
