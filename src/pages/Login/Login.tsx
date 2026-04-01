import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2, Globe, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

export default function Login() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const navigate = useNavigate();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const success = await login(username, password);
        if (success) {
            navigate('/', { replace: true });
        } else {
            setError(isAr ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password');
        }
        setLoading(false);
    };

    const toggleLang = () => {
        i18n.changeLanguage(isAr ? 'en' : 'ar');
    };

    return (
        <div className="login" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Background Pattern */}
            <div className="login__bg">
                <div className="login__bg-gradient" />
                <div className="login__bg-grid" />
            </div>

            {/* Language Toggle */}
            <button className="login__lang-toggle" onClick={toggleLang}>
                <Globe size={14} />
                {isAr ? 'English' : 'عربي'}
            </button>

            {/* Login Card */}
            <div className="login__card">
                {/* Logo & Brand */}
                <div className="login__brand">
                    <svg className="login__logo" viewBox="0 0 100 100" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="loginSwirl" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0a4d8c" />
                                <stop offset="50%" stopColor="#1a7fd4" />
                                <stop offset="100%" stopColor="#5db8f0" />
                            </linearGradient>
                            <linearGradient id="loginAccent" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#e8872a" />
                                <stop offset="100%" stopColor="#f5a623" />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="38" fill="none" stroke="url(#loginSwirl)" strokeWidth="5" strokeLinecap="round" strokeDasharray="60 20 30 10" />
                        <circle cx="50" cy="50" r="26" fill="none" stroke="url(#loginSwirl)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="40 15 20 8" opacity="0.7" />
                        <path d="M35 65 L50 25 L65 65 M40 52 L60 52" fill="none" stroke="url(#loginAccent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="50" cy="78" r="5" fill="url(#loginSwirl)" />
                        <circle cx="50" cy="78" r="2" fill="white" />
                    </svg>
                    <h1 className="login__title">
                        AXON
                    </h1>
                    <p className="login__subtitle">
                        {isAr ? 'تنسيق التميز الميداني' : 'Orchestrating Field Excellence'}
                    </p>
                </div>

                {/* Sovereign Badge */}
                <div className="login__sovereign">
                    <Shield size={14} />
                    {isAr ? 'بوابة الدخول السيادية' : 'Sovereign Login Portal'}
                </div>

                {/* Form */}
                <form className="login__form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login__error">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    <div className="login__field">
                        <label htmlFor="login-username">
                            {isAr ? 'اسم المستخدم' : 'Username'}
                        </label>
                        <div className="login__input-wrap">
                            <User size={16} />
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={isAr ? 'أدخل اسم المستخدم' : 'Enter your username'}
                                autoComplete="username"
                                required
                            />
                        </div>
                    </div>

                    <div className="login__field">
                        <label htmlFor="login-password">
                            {isAr ? 'كلمة المرور' : 'Password'}
                        </label>
                        <div className="login__input-wrap">
                            <Lock size={16} />
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter your password'}
                                autoComplete="current-password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="login__submit"
                        disabled={loading || !username || !password}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                {isAr ? 'جاري الدخول...' : 'Signing in...'}
                            </>
                        ) : (
                            <>
                                <Lock size={16} />
                                {isAr ? 'الدخول إلى النظام' : 'Sign In to DNS'}
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="login__footer">
                    <div className="login__footer-badge">
                        🇸🇦 {isAr ? 'سيادة البيانات — المملكة العربية السعودية' : 'KSA Data Sovereignty'}
                    </div>
                    <div className="login__footer-version">v1.0.0</div>
                </div>
            </div>
        </div>
    );
}
