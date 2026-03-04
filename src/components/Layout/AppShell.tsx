import { Outlet } from 'react-router-dom';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import Sidebar from './Sidebar';
import { navItems } from './Sidebar';
import './AppShell.css';

export default function AppShell() {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <div className="app-shell">
            <div className="app-shell__sidebar">
                <Sidebar />
            </div>
            <div className="app-shell__main">
                <Header />
                <div className="app-shell__content">
                    <Outlet />
                </div>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="bottom-nav">
                <ul className="bottom-nav__list">
                    {navItems.slice(0, 5).map((item) => {
                        const isActive =
                            item.path === '/'
                                ? location.pathname === '/'
                                : location.pathname.startsWith(item.path);
                        return (
                            <li key={item.key}>
                                <Link
                                    to={item.path}
                                    className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
                                >
                                    <item.icon size={22} />
                                    {t(`nav.${item.key}`)}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </div>
    );
}
