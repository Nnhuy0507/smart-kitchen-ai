import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { GoogleLoginButtonProps } from './GoogleLoginButton';

type GoogleIdentity = {
  initialize: (options: { client_id: string; ux_mode: string; callback: (response: { credential: string; state?: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: object) => void;
};

let loadingScript: Promise<void> | undefined;
let initializedClientId: string | undefined;
let credentialHandler: ((credential: string, state?: string) => void) | undefined;
const identity = () => (window as unknown as { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;

function loadGoogle() {
  if (identity()) return Promise.resolve();
  if (!loadingScript) {
    loadingScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 15000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('load failed')); };
      document.head.appendChild(script);
    }).catch((error) => { loadingScript = undefined; throw error; });
  }
  return loadingScript;
}

export default function GoogleLoginButton({ disabled, onCredential, variant = "signin" }: GoogleLoginButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const busy = useRef(disabled);
  useEffect(() => {
    callback.current = onCredential;
    busy.current = disabled;
  }, [onCredential, disabled]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

  useFocusEffect(useCallback(() => {
    const target = container.current;
    if (!clientId || clientId.startsWith('YOUR_') || !target) return;
    let active = true;
    const buttonState = variant + "-" + attempt;
    const handleCredential = (credential: string, state?: string) => {
      if (active && !busy.current && credential && state === buttonState) callback.current(credential);
    };
    setError('');
    loadGoogle().then(() => {
      if (!active) return;
      const google = identity();
      if (!google) throw new Error('missing SDK');
      credentialHandler = handleCredential;
      if (initializedClientId !== clientId) {
        google.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        callback: ({ credential, state }) => credentialHandler?.(credential, state),
      });
        initializedClientId = clientId;
      }
      google.renderButton(target, { theme: 'outline', size: 'large', text: variant === 'signup' ? 'signup_with' : 'continue_with', locale: 'vi', width: 300, state: buttonState });
    }).catch(() => { if (active) setError('Không tải được đăng nhập Google. Kiểm tra kết nối mạng.'); });
    return () => {
      active = false;
      target.replaceChildren();
      if (credentialHandler === handleCredential) credentialHandler = undefined;
    };
  }, [clientId, attempt, variant]));

  if (!clientId || clientId.startsWith('YOUR_')) {
    return <p role="status" style={{ color: '#735A51' }}>Điền EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong mobile/.env.local để bật đăng nhập Google.</p>;
  }
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
    <div ref={container} aria-busy={disabled} style={{ pointerEvents: disabled ? 'none' : 'auto', opacity: disabled ? 0.6 : 1 }} />
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Thử lại</button></p>}
  </div>;
}
