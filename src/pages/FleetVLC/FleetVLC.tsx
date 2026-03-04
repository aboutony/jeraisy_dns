import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Truck, AlertTriangle, Shield, ArrowRight, Package,
    Gauge, Wrench, MapPin, Home, Filter, BarChart3,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import type { BranchCode, VehicleStatus, TransitMissionStatus } from '../../store/types';
import './FleetVLC.css';

type TabFilter = 'all' | 'inTransit' | 'available' | 'maintenanceDue' | 'maintenance';

const branchLabels: Record<BranchCode, { ar: string; en: string }> = {
    HQ: { ar: 'المقر', en: 'HQ' },
    RUH: { ar: 'الرياض', en: 'Riyadh' },
    DMM: { ar: 'الدمام', en: 'Dammam' },
    JED: { ar: 'جدة', en: 'Jeddah' },
};

const statusColors: Record<VehicleStatus, string> = {
    available: 'var(--status-green)',
    inTransit: 'var(--jeraisy-blue)',
    maintenance: 'var(--status-red)',
    maintenanceDue: 'var(--status-amber)',
    outOfService: 'var(--text-muted)',
};

const missionStatusLabels: Record<TransitMissionStatus, { ar: string; en: string; color: string }> = {
    planned: { ar: 'مخطط', en: 'Planned', color: 'var(--text-muted)' },
    loading: { ar: 'تحميل', en: 'Loading', color: 'var(--jeraisy-gold)' },
    inTransit: { ar: 'في الطريق', en: 'In Transit', color: 'var(--jeraisy-blue)' },
    delivered: { ar: 'تم التسليم', en: 'Delivered', color: 'var(--status-green)' },
    returning: { ar: 'عائد للقاعدة', en: 'Returning', color: 'var(--status-amber)' },
    completed: { ar: 'مكتمل', en: 'Completed', color: 'var(--status-green)' },
};

export default function FleetVLC() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [branchFilter, setBranchFilter] = useState<BranchCode | 'all'>('all');
    const [showMileageBreakdown, setShowMileageBreakdown] = useState(false);

    const vehicles = state.vehicles;
    const missions = state.transitMissions;

    // ── KPI Calculations ──────────────────────────────────────
    const totalFleet = vehicles.length;
    const activeTransit = vehicles.filter(v => v.status === 'inTransit').length;
    const maintenanceDue = vehicles.filter(v => v.status === 'maintenanceDue').length;
    const maintenanceBlocked = vehicles.filter(v => v.status === 'maintenance').length;
    const avgLoadEfficiency = missions.length > 0
        ? Math.round(missions.reduce((s, m) => s + m.loadEfficiency, 0) / missions.length)
        : 0;

    // ── Filtered Vehicles ─────────────────────────────────────
    const filteredVehicles = useMemo(() => {
        let list = vehicles;
        if (branchFilter !== 'all') {
            list = list.filter(v => v.homeBranch === branchFilter);
        }
        if (activeTab !== 'all') {
            list = list.filter(v => v.status === activeTab);
        }
        return list;
    }, [vehicles, activeTab, branchFilter]);

    const tabs: { key: TabFilter; labelAr: string; labelEn: string; count: number }[] = [
        { key: 'all', labelAr: 'الكل', labelEn: 'All', count: vehicles.length },
        { key: 'available', labelAr: 'متاح', labelEn: 'Available', count: vehicles.filter(v => v.status === 'available').length },
        { key: 'inTransit', labelAr: 'في المهمة', labelEn: 'In Transit', count: activeTransit },
        { key: 'maintenanceDue', labelAr: 'صيانة قريبة', labelEn: 'Service Due', count: maintenanceDue },
        { key: 'maintenance', labelAr: 'في الصيانة', labelEn: 'In Service', count: maintenanceBlocked },
    ];

    return (
        <div className="fleet">
            <div className="fleet__header">
                <div>
                    <h1 className="fleet__title">
                        {isAr ? 'إدارة الأسطول' : 'Fleet VLC'}
                    </h1>
                    <p className="fleet__subtitle">
                        {isAr ? '170 مركبة — نظام إدارة المركبات والنقل بين الفروع' : '170 Vehicles — Inter-Branch Transit & Vehicle Lifecycle Control'}
                    </p>
                </div>
                <div className="fleet__header-actions">
                    <select
                        className="fleet__branch-filter"
                        value={branchFilter}
                        onChange={e => setBranchFilter(e.target.value as BranchCode | 'all')}
                    >
                        <option value="all">{isAr ? 'جميع الفروع' : 'All Branches'}</option>
                        {state.branches.map(b => (
                            <option key={b.code} value={b.code}>{isAr ? b.nameAr : b.nameEn}</option>
                        ))}
                    </select>
                    <button
                        className={`fleet__toggle-btn ${showMileageBreakdown ? 'fleet__toggle-btn--active' : ''}`}
                        onClick={() => setShowMileageBreakdown(!showMileageBreakdown)}
                    >
                        <BarChart3 size={14} />
                        {isAr ? 'تفصيل الكيلومترات' : 'Mileage Breakdown'}
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="fleet__kpis">
                <div className="fleet__kpi">
                    <Truck size={20} />
                    <div className="fleet__kpi-value">{totalFleet}</div>
                    <div className="fleet__kpi-label">{isAr ? 'إجمالي الأسطول' : 'Total Fleet'}</div>
                </div>
                <div className="fleet__kpi">
                    <ArrowRight size={20} />
                    <div className="fleet__kpi-value fleet__kpi-value--blue">{activeTransit}</div>
                    <div className="fleet__kpi-label">{isAr ? 'في مهمة نقل' : 'Active Transit'}</div>
                </div>
                <div className="fleet__kpi">
                    <Wrench size={20} />
                    <div className="fleet__kpi-value fleet__kpi-value--amber">{maintenanceDue}</div>
                    <div className="fleet__kpi-label">{isAr ? 'صيانة مطلوبة' : 'Service Due'}</div>
                </div>
                <div className="fleet__kpi">
                    <Shield size={20} />
                    <div className="fleet__kpi-value fleet__kpi-value--red">{maintenanceBlocked}</div>
                    <div className="fleet__kpi-label">{isAr ? 'محظور (صيانة)' : 'Blocked (Service)'}</div>
                </div>
                <div className="fleet__kpi">
                    <Package size={20} />
                    <div className="fleet__kpi-value fleet__kpi-value--green">{avgLoadEfficiency}%</div>
                    <div className="fleet__kpi-label">{isAr ? 'كفاءة التحميل' : 'Load Efficiency'}</div>
                </div>
            </div>

            {/* Active Transit Missions */}
            <div className="fleet__section">
                <h2 className="fleet__section-title">
                    <ArrowRight size={18} />
                    {isAr ? 'مهمات النقل النشطة' : 'Active Transit Missions'}
                </h2>
                <div className="fleet__missions">
                    {missions.filter(m => m.status !== 'completed').map(m => {
                        const kmToService = (() => {
                            const v = vehicles.find(vv => vv.id === m.vehicleId);
                            return v ? v.nextServiceKm - v.totalMileageKm : 9999;
                        })();
                        const isBlocked = kmToService <= 500;

                        return (
                            <div key={m.id} className={`fleet__mission ${isBlocked ? 'fleet__mission--blocked' : ''}`}>
                                <div className="fleet__mission-route">
                                    <span className="fleet__mission-branch">{isAr ? branchLabels[m.originBranch].ar : branchLabels[m.originBranch].en}</span>
                                    <ArrowRight size={16} className="fleet__mission-arrow" />
                                    <span className="fleet__mission-branch">{isAr ? branchLabels[m.destinationBranch].ar : branchLabels[m.destinationBranch].en}</span>
                                    <span className="fleet__mission-km">{m.distanceKm} km</span>
                                </div>

                                <div className="fleet__mission-details">
                                    <div className="fleet__mission-meta">
                                        <Truck size={14} /> {m.vehicleId}
                                    </div>
                                    <div className="fleet__mission-meta">
                                        <MapPin size={14} /> {isAr ? m.driverNameAr : m.driverNameEn}
                                    </div>
                                    <div className="fleet__mission-meta">
                                        <Home size={14} /> {isAr ? `قاعدة: ${branchLabels[m.driverHomeBranch].ar}` : `Base: ${branchLabels[m.driverHomeBranch].en}`}
                                    </div>
                                </div>

                                <div className="fleet__mission-cargo">
                                    <Package size={14} />
                                    {isAr ? m.cargoDescriptionAr : m.cargoDescriptionEn}
                                </div>

                                <div className="fleet__mission-footer">
                                    <span
                                        className="fleet__mission-status"
                                        style={{ color: missionStatusLabels[m.status].color }}
                                    >
                                        {isAr ? missionStatusLabels[m.status].ar : missionStatusLabels[m.status].en}
                                    </span>
                                    <span className={`fleet__mission-load ${m.loadEfficiency < 50 ? 'fleet__mission-load--low' : ''}`}>
                                        <Gauge size={12} />
                                        {m.loadEfficiency}% {isAr ? 'تحميل' : 'Load'}
                                    </span>
                                    {m.returnToBase && (
                                        <span className="fleet__mission-rtb">
                                            <Home size={12} /> {isAr ? 'عودة للقاعدة' : 'Return-to-Base'}
                                        </span>
                                    )}
                                    {isBlocked && (
                                        <span className="fleet__mission-guard">
                                            <AlertTriangle size={12} /> {isAr ? 'صيانة خلال 500 كم!' : 'Service within 500km!'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Vehicle Ledger */}
            <div className="fleet__section">
                <h2 className="fleet__section-title">
                    <Filter size={18} />
                    {isAr ? 'سجل المركبات' : 'Vehicle Ledger'}
                </h2>
                <div className="fleet__tabs">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            className={`fleet__tab ${activeTab === t.key ? 'fleet__tab--active' : ''}`}
                            onClick={() => setActiveTab(t.key)}
                        >
                            {isAr ? t.labelAr : t.labelEn} <span>({t.count})</span>
                        </button>
                    ))}
                </div>

                <div className="fleet__table-wrap">
                    <table className="fleet__table">
                        <thead>
                            <tr>
                                <th>{isAr ? 'المعرف' : 'ID'}</th>
                                <th>{isAr ? 'اللوحة' : 'Plate'}</th>
                                <th>{isAr ? 'النوع' : 'Type'}</th>
                                <th>{isAr ? 'الفرع' : 'Branch'}</th>
                                <th>{isAr ? 'الحالة' : 'Status'}</th>
                                {showMileageBreakdown && (
                                    <>
                                        <th>{isAr ? 'محلي' : 'Local km'}</th>
                                        <th>{isAr ? 'نقل' : 'Transit km'}</th>
                                    </>
                                )}
                                <th>{isAr ? 'إجمالي' : 'Total km'}</th>
                                <th>{isAr ? 'الصيانة القادمة' : 'Next Service'}</th>
                                <th>{isAr ? 'الحراسة' : 'Guard'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVehicles.slice(0, 50).map(v => {
                                const kmToService = v.nextServiceKm - v.totalMileageKm;
                                const isBlocked = kmToService <= 500;
                                const transitRatio = v.totalMileageKm > 0 ? Math.round((v.transitMileageKm / v.totalMileageKm) * 100) : 0;

                                return (
                                    <tr key={v.id} className={isBlocked ? 'fleet__row--blocked' : ''}>
                                        <td className="fleet__cell-id">{v.id}</td>
                                        <td>{isAr ? v.plateAr : v.plateEn}</td>
                                        <td>{isAr ? v.typeAr : v.typeEn}</td>
                                        <td>{isAr ? branchLabels[v.homeBranch].ar : branchLabels[v.homeBranch].en}</td>
                                        <td>
                                            <span className="fleet__status-dot" style={{ background: statusColors[v.status] }} />
                                            <span className="fleet__status-text" style={{ color: statusColors[v.status] }}>
                                                {v.status === 'available' ? (isAr ? 'متاح' : 'Available') :
                                                    v.status === 'inTransit' ? (isAr ? 'في مهمة' : 'In Transit') :
                                                        v.status === 'maintenance' ? (isAr ? 'صيانة' : 'Service') :
                                                            v.status === 'maintenanceDue' ? (isAr ? 'صيانة قريبة' : 'Due') :
                                                                (isAr ? 'خارج الخدمة' : 'Out')}
                                            </span>
                                        </td>
                                        {showMileageBreakdown && (
                                            <>
                                                <td className="fleet__cell-km">{v.localMileageKm.toLocaleString()}</td>
                                                <td className="fleet__cell-km">
                                                    {v.transitMileageKm.toLocaleString()}
                                                    <span className="fleet__transit-pct">({transitRatio}%)</span>
                                                </td>
                                            </>
                                        )}
                                        <td className="fleet__cell-km">{v.totalMileageKm.toLocaleString()}</td>
                                        <td className="fleet__cell-km">{v.nextServiceKm.toLocaleString()}</td>
                                        <td>
                                            {isBlocked ? (
                                                <span className="fleet__guard fleet__guard--blocked">
                                                    <AlertTriangle size={12} />
                                                    {kmToService} km
                                                </span>
                                            ) : (
                                                <span className="fleet__guard fleet__guard--clear">
                                                    <Shield size={12} />
                                                    {isAr ? 'سليم' : 'Clear'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredVehicles.length > 50 && (
                    <div className="fleet__table-more">
                        {isAr ? `عرض 50 من ${filteredVehicles.length} مركبة` : `Showing 50 of ${filteredVehicles.length} vehicles`}
                    </div>
                )}
            </div>
        </div>
    );
}
