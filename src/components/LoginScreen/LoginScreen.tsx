import { useRef, useState } from 'preact/hooks';

import styles from './LoginScreen.module.css';

interface Props {
  error?: string;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginScreen({ error: externalError, onLogin }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: Event) => {
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
          <label class={styles.label} for="inputEmail">
            Email
          </label>
          <input
            ref={emailRef}
            class={styles.input}
            type="email"
            id="inputEmail"
            placeholder="your@email.com"
            autocomplete="username"
            required
          />
          <label class={styles.label} for="inputPassword">
            Password
          </label>
          <input
            ref={passwordRef}
            class={styles.input}
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
        <div class={styles.error}>{externalError ?? ''}</div>
      </div>
    </div>
  );
}
