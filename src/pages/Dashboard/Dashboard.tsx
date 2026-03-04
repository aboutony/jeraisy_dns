import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore, getWorkforceSummary } from '../../store/GlobalStore';
import OvertimeHeatmap from '../../components/Dashboard/OvertimeHeatmap';
import KPITiles from '../../components/Dashboard/KPITiles';
import CostControlWidget from '../../components/Dashboard/CostControlWidget';
import './Dashboard.css';

export default function Dashboard() {
    const { t } = useTranslation();
    const { state } = useGlobalStore();
    const stats = useMemo(() => getWorkforceSummary(state.workers), [state.workers]);

    return (
        <div className="dashboard">
            <div className="dashboard__header">
                <h1 className="dashboard__title">{t('dashboard.title')}</h1>
                <p className="dashboard__subtitle">{t('dashboard.subtitle')}</p>
            </div>

            <KPITiles stats={stats} />

            <div className="dashboard__grid">
                <OvertimeHeatmap />
                <CostControlWidget />
            </div>
        </div>
    );
}
