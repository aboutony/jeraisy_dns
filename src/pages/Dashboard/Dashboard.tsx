import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore, getWorkforceSummary } from '../../store/GlobalStore';
import OvertimeHeatmap from '../../components/Dashboard/OvertimeHeatmap';
import KPITiles, { calculateSavings } from '../../components/Dashboard/KPITiles';
import CostControlWidget from '../../components/Dashboard/CostControlWidget';
import type { BranchCode } from '../../store/types';
import './Dashboard.css';

export default function Dashboard() {
    const { t } = useTranslation();
    const { state } = useGlobalStore();
    const [branchFilter, setBranchFilter] = useState<BranchCode | 'all'>('all');

    const stats = useMemo(() => getWorkforceSummary(state.workers), [state.workers]);
    const savings = useMemo(
        () => calculateSavings(state.workers, state.vehicles, state.transitMissions),
        [state.workers, state.vehicles, state.transitMissions]
    );

    return (
        <div className="dashboard">
            <div className="dashboard__header">
                <h1 className="dashboard__title">{t('dashboard.title')}</h1>
                <p className="dashboard__subtitle">{t('dashboard.subtitle')}</p>
            </div>

            <KPITiles stats={stats} savings={savings} />

            <div className="dashboard__grid">
                <OvertimeHeatmap />
                <CostControlWidget
                    branchFilter={branchFilter}
                    onBranchChange={setBranchFilter}
                />
            </div>
        </div>
    );
}
