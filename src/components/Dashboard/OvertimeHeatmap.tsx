import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../store/GlobalStore';
import type { Worker } from '../../store/types';

export default function OvertimeHeatmap() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();
    const workers = state.workers;

    // Take first 100 workers for the visible heatmap grid
    const visibleWorkers = useMemo(() => workers.slice(0, 100), [workers]);

    const getStatusColor = (w: Worker) => {
        // EXACT 38-hour trigger per Saudi Labor Law: >= 38 = overtime, >= 35 = risk
        if (w.hoursWorked >= 38) return 'heatmap-cell--critical';
        if (w.hoursWorked >= 35) return 'heatmap-cell--warning';
        if (w.status === 'active') return 'heatmap-cell--active';
        if (w.status === 'idle') return 'heatmap-cell--idle';
        if (w.status === 'onBreak') return 'heatmap-cell--break';
        return 'heatmap-cell--off';
    };

    const statusCounts = useMemo(() => {
        const counts = { active: 0, idle: 0, onBreak: 0, overtimeRisk: 0, overtime: 0, offDuty: 0 };
        workers.forEach((w) => {
            if (w.hoursWorked >= 38) counts.overtime++;
            else if (w.hoursWorked >= 35) counts.overtimeRisk++;
            else if (w.status === 'active') counts.active++;
            else if (w.status === 'idle') counts.idle++;
            else if (w.status === 'onBreak') counts.onBreak++;
            else counts.offDuty++;
        });
        return counts;
    }, [workers]);

    return (
        <div className="heatmap">
            <div className="heatmap__header">
                <h3 className="heatmap__title">{t('dashboard.overtimeHeatmap')}</h3>
                <div className="heatmap__legend">
                    <div className="heatmap__legend-item">
                        <div className="heatmap__legend-dot heatmap__legend-dot--active" />
                        <span>{t('dashboard.status.active')} ({statusCounts.active})</span>
                    </div>
                    <div className="heatmap__legend-item">
                        <div className="heatmap__legend-dot heatmap__legend-dot--warning" />
                        <span>{t('dashboard.status.overtimeRisk')} ({statusCounts.overtimeRisk})</span>
                    </div>
                    <div className="heatmap__legend-item">
                        <div className="heatmap__legend-dot heatmap__legend-dot--critical pulse-dot" />
                        <span>{t('dashboard.status.overtime')} ({statusCounts.overtime})</span>
                    </div>
                    <div className="heatmap__legend-item">
                        <div className="heatmap__legend-dot heatmap__legend-dot--idle" />
                        <span>{t('dashboard.status.idle')} ({statusCounts.idle})</span>
                    </div>
                    <div className="heatmap__legend-item">
                        <div className="heatmap__legend-dot heatmap__legend-dot--break" />
                        <span>{t('dashboard.status.onBreak')} ({statusCounts.onBreak})</span>
                    </div>
                </div>
            </div>

            <div className="heatmap__grid">
                {visibleWorkers.map((w) => (
                    <div
                        key={w.id}
                        className={`heatmap-cell ${getStatusColor(w)} ${w.hoursWorked >= 38 ? 'pulse-critical' : ''
                            }`}
                        title={`${isAr ? w.nameAr : w.nameEn} — ${w.hoursWorked}h / ${w.weeklyLimit}h`}
                    >
                        <span className="heatmap-cell__hours">{Math.round(w.hoursWorked)}</span>
                    </div>
                ))}
            </div>

            <div className="heatmap__footer">
                <span className="text-muted">
                    {isAr ? `عرض 100 من ${workers.length} عامل` : `Showing 100 of ${workers.length} workers`}
                </span>
                <button className="heatmap__view-all">
                    {t('common.viewAll')} →
                </button>
            </div>
        </div>
    );
}
