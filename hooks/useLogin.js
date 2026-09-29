import { useEffect, useState } from "react";

/** UI state adapter only; authentication policy lives in loginController. */
export function useLogin(controller) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    controller.restoreSession()
      .then((restored) => {
        if (mounted && restored) setResult(restored);
      })
      .catch((restoreError) => {
        if (mounted) setError(restoreError);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [controller]);

  async function login(email, password) {
    setPending(true);
    setError(null);
    try {
      const authenticated = await controller.login(email, password);
      setResult(authenticated);
      return true;
    } catch (loginError) {
      setError(loginError);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError(null);
    try {
      await controller.logout();
      setResult(null);
    } catch (logoutError) {
      setError(logoutError);
    } finally {
      setPending(false);
    }
  }

  return { ...result, loading, pending, error, login, logout };
}
