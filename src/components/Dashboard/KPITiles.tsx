import { useTranslation } from 'react-i18next';
import { Users, UserCheck, AlertTriangle, TrendingDown, ShieldCheck, Clock } from 'lucide-react';
import type { Vehicle, TransitMission } from '../../store/types';

interface SavingsBreakdown {
    workforce: number;
    logistics: number;
    total: number;
}

interface KPITilesProps {
    stats: {
        total: number;
        active: number;
        overtimeRisk: number;
        overtime: number;
        avgHours: number;
        saudizationRate: number;
    };
    savings: SavingsBreakdown;
}

function formatSAR(value: number, isAr: boolean): string {
    const formatted = Math.abs(value) >= 1000
        ? `${(value / 1000).toFixed(1)}K`
        : value.toLocaleString();
    return isAr ? `${formatted} ر.س` : `SAR ${formatted}`;
}

export default function KPITiles({ stats, savings }: KPITilesProps) {
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
            value: formatSAR(savings.total, isAr),
            icon: TrendingDown,
            color: 'var(--jeraisy-gold)',
            bg: 'var(--jeraisy-gold)',
            breakdown: savings,
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
                    className={`kpi-tile glass-panel ${tile.pulse ? 'pulse-critical' : ''} ${tile.breakdown ? 'kpi-tile--expanded' : ''}`}
                >
                    <div className="kpi-tile__icon" style={{ background: `${tile.bg}15`, color: tile.color }}>
                        <tile.icon size={22} />
                    </div>
                    <div className="kpi-tile__content">
                        <div className="kpi-tile__value" style={{ color: tile.color }}>
                            {tile.value}
                        </div>
                        <div className="kpi-tile__label">{t(`dashboard.kpi.${tile.key}`)}</div>
                        {tile.breakdown && (
                            <div className="kpi-tile__breakdown">
                                <div className="kpi-tile__breakdown-row">
                                    <span className="kpi-tile__breakdown-label">
                                        {isAr ? 'القوى العاملة' : 'Workforce'}
                                    </span>
                                    <span className="kpi-tile__breakdown-value kpi-tile__breakdown-value--green">
                                        {formatSAR(tile.breakdown.workforce, isAr)}
                                    </span>
                                </div>
                                <div className="kpi-tile__breakdown-row">
                                    <span className="kpi-tile__breakdown-label">
                                        {isAr ? 'النقل والأسطول' : 'Logistics'}
                                    </span>
                                    <span className="kpi-tile__breakdown-value kpi-tile__breakdown-value--blue">
                                        {formatSAR(tile.breakdown.logistics, isAr)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Savings Calculator ────────────────────────────────────────
export function calculateSavings(
    workers: { hoursWorked: number; weeklyLimit: number }[],
    vehicles: Vehicle[],
    missions: TransitMission[],
): SavingsBreakdown {
    // Workforce savings: overtime prevention at SAR 85/hr
    const OVERTIME_RATE = 85;
    const workforceSavings = workers.reduce((sum, w) => {
        if (w.hoursWorked > w.weeklyLimit) {
            return sum + (w.hoursWorked - w.weeklyLimit) * OVERTIME_RATE;
        }
        return sum;
    }, 0);

    // Logistics savings:
    // 1. Load efficiency: empty legs cost SAR 3.5/km, high load prevents waste
    const COST_PER_KM_EMPTY = 3.5;
    const loadSavings = missions.reduce((sum, m) => {
        const wastedKm = m.distanceKm * (1 - m.loadEfficiency / 100);
        return sum + wastedKm * COST_PER_KM_EMPTY * (m.loadEfficiency / 100);
    }, 0);

    // 2. Maintenance guard: prevented breakdown avg cost SAR 12,000 per incident
    const BREAKDOWN_COST = 12000;
    const blockedVehicles = vehicles.filter(v =>
        v.status === 'maintenanceDue' || v.status === 'maintenance'
    ).length;
    const maintenanceSavings = blockedVehicles * BREAKDOWN_COST * 0.3; // 30% probability

    const logisticsSavings = Math.round(loadSavings + maintenanceSavings);

    return {
        workforce: Math.round(workforceSavings),
        logistics: logisticsSavings,
        total: Math.round(workforceSavings) + logisticsSavings,
    };
}
