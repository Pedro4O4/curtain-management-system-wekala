"use client";

import { useEffect, useState } from 'react';
import { apiRequest, isTokenExpired, User } from '../lib/sales';

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('el-wekala-token');

    if (!storedToken || isTokenExpired(storedToken)) {
      window.localStorage.removeItem('el-wekala-token');
      setReady(true);
      return;
    }

    setToken(storedToken);
    apiRequest<{ user: User }>('/auth/me', storedToken)
      .then((payload) => setUser(payload.user))
      .catch(() => {
        window.localStorage.removeItem('el-wekala-token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  function logout() {
    window.localStorage.removeItem('el-wekala-token');
    setToken(null);
    setUser(null);
  }

  return { token, setToken, user, setUser, ready, logout };
}
