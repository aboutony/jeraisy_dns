import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalStore } from '../../store/GlobalStore';
import { Sun, Moon, Bell, Search, Globe, AlertTriangle, X, LogOut } from 'lucide-react';

export default function Header() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { state, simulateOvertimeBreach, clearNotifications } = useGlobalStore();
    const [showNotifications, setShowNotifications] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = state.notifications.filter((n) => !n.read).length;

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const toggleLang = () => {
        i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
    };

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return ''; }
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <header className="header">
            <div className="header__logo">
                <img src="/axon-logo.png" alt="AXON" className="header__brand-logo" />
                <div className="header__logo-text">
                    AXON
                </div>
            </div>

            <div className="header__actions">
                <button className="header__btn" title={t('header.search')}>
                    <Search size={18} />
                </button>

                {/* Notification Bell + Dropdown */}
                <div className="header__notification-wrapper" ref={dropdownRef}>
                    <button
                        className="header__btn"
                        title={t('header.notifications')}
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <div className="header__notification-dot header__notification-dot--count">
                                {unreadCount}
                            </div>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="header__notification-dropdown">
                            <div className="header__notification-dropdown-header">
                                <span className="header__notification-dropdown-title">
                                    {isAr ? 'الإشعارات' : 'Notifications'}
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        className="header__notification-simulate-btn"
                                        onClick={() => {
                                            simulateOvertimeBreach();
                                        }}
                                    >
                                        <AlertTriangle size={12} />
                                        {isAr ? 'محاكاة تجاوز' : 'Simulate Breach'}
                                    </button>
                                    {state.notifications.length > 0 && (
                                        <button
                                            className="header__notification-clear-btn"
                                            onClick={clearNotifications}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="header__notification-dropdown-body">
                                {state.notifications.length === 0 ? (
                                    <div className="header__notification-empty">
                                        {isAr ? 'لا توجد إشعارات' : 'No notifications'}
                                    </div>
                                ) : (
                                    state.notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`header__notification-item header__notification-item--${notif.priority}`}
                                        >
                                            <div className="header__notification-item-title">
                                                {isAr ? notif.titleAr : notif.titleEn}
                                            </div>
                                            <div className="header__notification-item-message">
                                                {isAr ? notif.messageAr : notif.messageEn}
                                            </div>
                                            <div className="header__notification-item-time">
                                                {formatTime(notif.timestamp)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button className="header__btn--lang header__btn" onClick={toggleLang}>
                    <Globe size={14} />
                    {i18n.language === 'ar' ? 'EN' : 'عربي'}
                </button>

                <button
                    className="header__btn"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* User Profile + Logout */}
                <div
                    className="header__user"
                    onClick={() => navigate('/profile')}
                    style={{ cursor: 'pointer' }}
                    title={isAr ? 'الملف الشخصي' : 'View Profile'}
                >
                    <div className="header__avatar">
                        {user ? (isAr ? user.nameAr[0] : user.nameEn[0]) : 'ف'}
                    </div>
                    <div className="header__user-info">
                        <div className="header__user-name">
                            {user
                                ? (isAr ? user.nameAr : user.nameEn)
                                : (isAr ? 'فهد الجريسي' : 'Fahd Al-Jeraisy')}
                        </div>
                        <div className="header__user-role">
                            {user
                                ? (isAr
                                    ? (user.role === 'admin' ? 'مدير النظام' : 'مدير تنفيذي')
                                    : (user.role === 'admin' ? 'System Admin' : 'Executive Director'))
                                : (isAr ? 'مدير تنفيذي' : 'Executive Director')}
                        </div>
                    </div>
                </div>

                <button
                    className="header__btn header__btn--logout"
                    onClick={handleLogout}
                    title={isAr ? 'تسجيل الخروج' : 'Logout'}
                >
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
}
