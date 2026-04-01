import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    Clock,
    Database,
    Truck,
    ShieldCheck,
    Settings,
} from 'lucide-react';

const navItems = [
    { key: 'dashboard', path: '/', icon: LayoutDashboard },
    { key: 'workOrders', path: '/work-orders', icon: ClipboardList },
    { key: 'workforce', path: '/workforce', icon: Users, badge: 12 },
    { key: 'punchClock', path: '/punch-clock', icon: Clock },
    { key: 'fleet', path: '/fleet', icon: Truck },
    { key: 'compliance', path: '/compliance', icon: ShieldCheck },
    { key: 'settings', path: '/settings', icon: Settings },
    { key: 'crmBridge', path: '/oracle-bridge', icon: Database },
];

export default function Sidebar() {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    return (
        <aside className="sidebar">
            <div className="sidebar__brand">
                <svg className="sidebar__brand-logo" viewBox="0 0 100 100" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sidebarSwirl" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0a4d8c" />
                            <stop offset="50%" stopColor="#1a7fd4" />
                            <stop offset="100%" stopColor="#5db8f0" />
                        </linearGradient>
                        <linearGradient id="sidebarAccent" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#e8872a" />
                            <stop offset="100%" stopColor="#f5a623" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="url(#sidebarSwirl)" strokeWidth="5" strokeLinecap="round" strokeDasharray="60 20 30 10" />
                    <circle cx="50" cy="50" r="26" fill="none" stroke="url(#sidebarSwirl)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="40 15 20 8" opacity="0.7" />
                    <path d="M35 65 L50 25 L65 65 M40 52 L60 52" fill="none" stroke="url(#sidebarAccent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="50" cy="78" r="5" fill="url(#sidebarSwirl)" />
                    <circle cx="50" cy="78" r="2" fill="white" />
                </svg>
                <div className="sidebar__brand-text">
                    <div className="sidebar__brand-name">
                        AXON
                    </div>
                    <div className="sidebar__brand-sub">
                        {i18n.language === 'ar' ? 'تنسيق التميز الميداني' : 'Orchestrating Field Excellence'}
                    </div>
                </div>
            </div>

            <div className="sidebar__section-label">
                {i18n.language === 'ar' ? 'القائمة الرئيسية' : 'MAIN MENU'}
            </div>

            <nav className="sidebar__nav">
                {navItems.map((item) => {
                    const isActive =
                        item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.key}
                            to={item.path}
                            className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{t(`nav.${item.key}`)}</span>
                            {item.badge && !isActive && (
                                <div className="sidebar__link-badge">{item.badge}</div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__footer-version">v1.0.0 — KSA Sovereign</div>
            </div>
        </aside>
    );
}

export { navItems };
