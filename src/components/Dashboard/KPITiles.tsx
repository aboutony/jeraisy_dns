import { useTranslation } from 'react-i18next';
import { Users, UserCheck, AlertTriangle, TrendingDown, ShieldCheck, Clock } from 'lucide-react';

interface KPITilesProps {
    stats: {
        total: number;
        active: number;
        overtimeRisk: number;
        overtime: number;
        avgHours: number;
        saudizationRate: number;
    };
}

export default function KPITiles({ stats }: KPITilesProps) {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';

    const tiles = [
        {
            key: 'totalWorkers',
            value: stats.total.toLocaleString(),
            icon: Users,
            color: 'var(--accent-primary)',
            bg: 'var(--accent-primary)',
        },
        {
            key: 'activeNow',
            value: stats.active.toLocaleString(),
            icon: UserCheck,
            color: 'var(--status-green)',
            bg: 'var(--status-green)',
        },
        {
            key: 'overtimeRisk',
            value: (stats.overtimeRisk + stats.overtime).toLocaleString(),
            icon: AlertTriangle,
            color: 'var(--status-red)',
            bg: 'var(--status-red)',
            pulse: stats.overtime > 0,
        },
        {
            key: 'weeklySavings',
            value: isAr ? '٤٦,٨٠٠ ر.س' : 'SAR 46,800',
            icon: TrendingDown,
            color: 'var(--jeraisy-gold)',
            bg: 'var(--jeraisy-gold)',
        },
        {
            key: 'saudization',
            value: `${stats.saudizationRate}%`,
            icon: ShieldCheck,
            color: 'var(--status-green)',
            bg: 'var(--status-green)',
        },
        {
            key: 'avgHoursWeek',
            value: `${stats.avgHours}h`,
            icon: Clock,
            color: stats.avgHours >= 35 ? 'var(--status-amber)' : 'var(--accent-primary)',
            bg: stats.avgHours >= 35 ? 'var(--status-amber)' : 'var(--accent-primary)',
        },
    ];

    return (
        <div className="kpi-grid">
            {tiles.map((tile) => (
                <div
                    key={tile.key}
                    className={`kpi-tile glass-panel ${tile.pulse ? 'pulse-critical' : ''}`}
                >
                    <div className="kpi-tile__icon" style={{ background: `${tile.bg}15`, color: tile.color }}>
                        <tile.icon size={22} />
                    </div>
                    <div className="kpi-tile__content">
                        <div className="kpi-tile__value" style={{ color: tile.color }}>
                            {tile.value}
                        </div>
                        <div className="kpi-tile__label">{t(`dashboard.kpi.${tile.key}`)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
