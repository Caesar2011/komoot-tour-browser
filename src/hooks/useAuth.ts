import { useCallback, useState } from 'preact/hooks';

import { Api } from '../logic/api.ts';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => Api.restoreAuth());
  const [loginError, setLoginError] = useState('');

  const handleAuthError = useCallback(() => {
    Api.clearAuth();
    Api.resetCaches();
    setAuthenticated(false);
    setLoginError('Session expired. Please sign in again.');
  }, []);

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoginError('');
    try {
      await Api.login(email, password);
      setAuthenticated(true);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleLogout = useCallback(() => {
    Api.clearAuth();
    Api.resetCaches();
    setAuthenticated(false);
    setLoginError('');
  }, []);

  return {
    authenticated,
    loginError,
    displayName: Api.displayName,
    handleAuthError,
    handleLogin,
    handleLogout,
  };
}
