/**
 * @module hooks/useLogin
 * Container hook for staff authentication: restores the stored session on mount and exposes
 * login/logout actions backed by the login controller.
 */
import { useEffect, useState } from "react";

/**
 * @param {ReturnType<typeof import('../controllers/loginController.js').createLoginController>} controller
 * @returns {Partial<import('../controllers/loginController.js').LoginResult> & {loading: boolean,
 *   pending: boolean, error: Error | null, login: (email: string, password: string) => Promise<boolean>,
 *   logout: () => Promise<void>}} `session`/`destination` are present only while authenticated;
 *   `loading` is true until the restore attempt settles.
 */
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
