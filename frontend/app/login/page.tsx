"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, AuthResponse } from '../../lib/sales';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('اكتب اسم المستخدم وكلمة المرور أولًا.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await apiRequest<AuthResponse>(endpoint, undefined, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      window.localStorage.setItem('el-wekala-token', response.token);
      router.replace('/all');
    } catch (err: any) {
      setError(err.message || 'تعذّر تسجيل الدخول. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-header">
          <div className="login-logo">و</div>
          <h2>الوكالة للستائر</h2>
          <p>إدارة البيع وحركة الخزنة</p>
        </header>

        <div className="auth-tabs">
          <button 
            type="button" 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(null); }}
          >
            دخول
          </button>
          <button 
            type="button" 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(null); }}
          >
            حساب جديد
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">اسم المستخدم</label>
            <input 
              id="username"
              type="text" 
              className="form-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">كلمة المرور</label>
            <input 
              id="password"
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : (isLogin ? 'دخول' : 'إنشاء حساب')}
          </button>
        </form>
      </div>
    </div>
  );
}
