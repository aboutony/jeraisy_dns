import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Briefcase } from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import type { Worker } from '../../store/types';
import './Workforce.css';

type FilterType = 'all' | 'active' | 'overtime' | 'idle';

export default function Workforce() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    const filtered = useMemo(() => {
        let result = [...state.workers];

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (w) =>
                    w.nameEn.toLowerCase().includes(q) ||
                    w.nameAr.includes(search) ||
                    w.id.toString().includes(q)
            );
        }

        if (filter === 'active') result = result.filter((w) => w.status === 'active');
        else if (filter === 'overtime')
            result = result.filter((w) => w.hoursWorked >= 35);
        else if (filter === 'idle')
            result = result.filter((w) => w.status === 'idle' || w.status === 'offDuty');

        return result.slice(0, 30); // Show first 30 for performance
    }, [search, filter, state.workers]);

    const getProgressColor = (w: Worker) => {
        if (w.hoursWorked >= 38) return 'worker-card__progress-fill--critical';
        if (w.hoursWorked >= 35) return 'worker-card__progress-fill--warning';
        return 'worker-card__progress-fill--safe';
    };

    const getStatusBadge = (w: Worker) => {
        if (w.hoursWorked >= 38) return 'badge badge--red';
        if (w.hoursWorked >= 35) return 'badge badge--amber';
        if (w.status === 'active') return 'badge badge--green';
        return 'badge';
    };

    const getStatusLabel = (w: Worker): string => {
        if (w.hoursWorked >= 38) return t('dashboard.status.overtime');
        if (w.hoursWorked >= 35) return t('dashboard.status.overtimeRisk');
        return t(`dashboard.status.${w.status}`);
    };

    return (
        <div className="workforce">
            <div className="workforce__header">
                <div>
                    <h1 className="workforce__title">{t('workforce.title')}</h1>
                    <p className="workforce__subtitle">{t('workforce.subtitle')}</p>
                </div>
                <div className="workforce__controls">
                    <div className="workforce__search">
                        <Search size={16} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder={t('workforce.search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="workforce__filters">
                        {(['all', 'active', 'overtime', 'idle'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                className={`workforce__filter-btn ${filter === f ? 'workforce__filter-btn--active' : ''
                                    }`}
                                onClick={() => setFilter(f)}
                            >
                                {t(`workforce.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="workforce__grid">
                {filtered.map((w) => (
                    <div
                        key={w.id}
                        className={`worker-card ${w.hoursWorked >= 38
                            ? 'worker-card--overtime pulse-critical'
                            : w.hoursWorked >= 35
                                ? 'worker-card--warning'
                                : ''
                            }`}
                    >
                        <div className="worker-card__top">
                            <div>
                                <div className="worker-card__name">
                                    {isAr ? w.nameAr : w.nameEn}
                                </div>
                                <div className="worker-card__id">ID: {w.id}</div>
                            </div>
                            <span className={getStatusBadge(w)}>
                                {getStatusLabel(w)}
                            </span>
                        </div>

                        <div className="worker-card__meta">
                            <div className="worker-card__meta-item">
                                <Briefcase size={12} />
                                {isAr ? w.departmentAr : w.department}
                            </div>
                            <div className="worker-card__meta-item">
                                <MapPin size={12} />
                                {isAr
                                    ? w.site === 'riyadh'
                                        ? 'الرياض'
                                        : 'جدة'
                                    : w.site === 'riyadh'
                                        ? 'Riyadh'
                                        : 'Jeddah'}
                            </div>
                        </div>

                        <div className="worker-card__progress">
                            <div className="worker-card__progress-header">
                                <span>
                                    {t('workforce.hoursWorked')}: {w.hoursWorked}h
                                </span>
                                <span>
                                    {w.weeklyLimit}h {t('workforce.weeklyLimit')}
                                </span>
                            </div>
                            <div className="worker-card__progress-bar">
                                <div
                                    className={`worker-card__progress-fill ${getProgressColor(w)}`}
                                    style={{ width: `${Math.min((w.hoursWorked / w.weeklyLimit) * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        {w.hoursWorked >= 38 && (
                            <div className="worker-card__alert worker-card__alert--critical">
                                {t('workforce.overtimeBlocked')}
                            </div>
                        )}
                        {w.hoursWorked >= 35 && w.hoursWorked < 38 && (
                            <div className="worker-card__alert worker-card__alert--warning">
                                {t('workforce.overtimeAlert')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
