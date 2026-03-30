import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import styles from './LoginScreen.module.css';

interface Props {
  error?: string;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginScreen({ error: externalError, onLogin }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? '';
    const pw = passwordRef.current?.value ?? '';
    if (!email || !pw) return;
    setSubmitting(true);
    try {
      await onLogin(email, pw);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class={styles.screen}>
      <div class={styles.box}>
        <h1>🏔️ Komoot Browser</h1>
        <p class={styles.subtitle}>Sign in with your Komoot account</p>
        <form onSubmit={handleSubmit} autocomplete="on">
          <label class="form-label" for="inputEmail">
            Email
          </label>
          <input
            ref={emailRef}
            class={`form-input ${styles.inputSpacing}`}
            type="email"
            id="inputEmail"
            placeholder="your@email.com"
            autocomplete="username"
            required
          />
          <label class="form-label" for="inputPassword">
            Password
          </label>
          <input
            ref={passwordRef}
            class={`form-input ${styles.inputSpacing}`}
            type="password"
            id="inputPassword"
            placeholder="Password"
            autocomplete="current-password"
            required
          />
          <button class={styles.btn} type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div class={`form-error ${styles.errorSpacing}`}>
          {externalError ?? ''}
        </div>
      </div>
    </div>
  );
}
