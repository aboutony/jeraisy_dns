import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    Clock,
    Database,
    ShieldCheck,
    Settings,
} from 'lucide-react';

const navItems = [
    { key: 'dashboard', path: '/', icon: LayoutDashboard },
    { key: 'workOrders', path: '/work-orders', icon: ClipboardList },
    { key: 'workforce', path: '/workforce', icon: Users, badge: 12 },
    { key: 'punchClock', path: '/punch-clock', icon: Clock },
    { key: 'oracleBridge', path: '/oracle-bridge', icon: Database },
    { key: 'compliance', path: '/compliance', icon: ShieldCheck },
    { key: 'settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    return (
        <aside className="sidebar">
            <div className="sidebar__brand">
                <img src="/rhc-logo-white.png" alt="Jeraisy" className="sidebar__brand-logo" />
                <div className="sidebar__brand-text">
                    <div className="sidebar__brand-name">
                        {i18n.language === 'ar' ? 'الجريسي' : 'JERAISY'}
                    </div>
                    <div className="sidebar__brand-sub">
                        {i18n.language === 'ar' ? 'الجهاز العصبي الرقمي' : 'Digital Nervous System'}
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
