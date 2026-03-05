import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, MapPin, Users, Clock, CheckCircle2,
    Loader2, AlertTriangle, ChevronDown, ChevronUp, Filter, Plus,
    Radio, ShieldCheck,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import OracleConnector from '../../services/OracleConnector';
import type { WorkOrder, WorkOrderStatus } from '../../store/types';
import './WorkOrders.css';

type TabFilter = 'all' | 'pending' | 'inProgress' | 'completed';

export default function WorkOrders() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const navigate = useNavigate();
    const { state, dispatch } = useGlobalStore();
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const skuMap = useMemo(() => OracleConnector.getSkuLaborMap(), []);

    const tabs: { key: TabFilter; labelAr: string; labelEn: string; count: number }[] = [
        { key: 'all', labelAr: 'الكل', labelEn: 'All', count: state.workOrders.length },
        { key: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending', count: state.workOrders.filter(w => w.status === 'pending').length },
        { key: 'inProgress', labelAr: 'قيد التنفيذ', labelEn: 'In Progress', count: state.workOrders.filter(w => w.status === 'inProgress').length },
        { key: 'completed', labelAr: 'مكتمل', labelEn: 'Completed', count: state.workOrders.filter(w => w.status === 'completed' || w.status === 'synced').length },
    ];

    const filtered = useMemo(() => {
        if (activeTab === 'all') return state.workOrders;
        if (activeTab === 'completed') return state.workOrders.filter(w => w.status === 'completed' || w.status === 'synced');
        return state.workOrders.filter(w => w.status === activeTab);
    }, [state.workOrders, activeTab]);

    const statusConfig: Record<WorkOrderStatus, { colorClass: string; iconEl: React.ReactNode; labelAr: string; labelEn: string }> = {
        pending: { colorClass: 'wo-card__badge--pending', iconEl: <Clock size={12} />, labelAr: 'قيد الانتظار', labelEn: 'Pending' },
        scheduled: { colorClass: 'wo-card__badge--scheduled', iconEl: <Clock size={12} />, labelAr: 'مجدول', labelEn: 'Scheduled' },
        inTransit: { colorClass: 'wo-card__badge--transit', iconEl: <AlertTriangle size={12} />, labelAr: 'في الطريق', labelEn: 'In Transit' },
        inProgress: { colorClass: 'wo-card__badge--progress', iconEl: <Loader2 size={12} />, labelAr: 'قيد التنفيذ', labelEn: 'In Progress' },
        completed: { colorClass: 'wo-card__badge--done', iconEl: <CheckCircle2 size={12} />, labelAr: 'مكتمل', labelEn: 'Completed' },
        synced: { colorClass: 'wo-card__badge--synced', iconEl: <CheckCircle2 size={12} />, labelAr: 'تمت المزامنة', labelEn: 'Synced' },
        rejected: { colorClass: 'wo-card__badge--rejected', iconEl: <AlertTriangle size={12} />, labelAr: 'مرفوض', labelEn: 'Rejected' },
    };

    const handleAssignWorkers = (wo: WorkOrder) => {
        setAssigningId(wo.id);
        // Find available workers (active, not overtime, not already assigned)
        const available = state.workers.filter(
            w => w.status === 'active' && w.hoursWorked < state.thresholds.overtimeHoursLimit && !w.assignedWorkOrder
        ).slice(0, 3);

        // Dispatch assignment
        available.forEach(worker => {
            dispatch({
                type: 'WORKER_PUNCH_IN',
                payload: { workerId: worker.id, timestamp: new Date().toISOString(), workOrderId: wo.id },
            });
        });

        // Update WO status
        dispatch({
            type: 'WORK_ORDER_SYNCED',
            payload: { id: wo.id, status: 'inProgress', lastSync: new Date().toISOString() },
        });

        setTimeout(() => setAssigningId(null), 1000);
    };

    const handleCompleteWO = (wo: WorkOrder) => {
        dispatch({
            type: 'WORK_ORDER_SYNCED',
            payload: { id: wo.id, status: 'completed', lastSync: new Date().toISOString() },
        });
    };

    return (
        <div className="work-orders">
            <div className="work-orders__header">
                <ClipboardList size={28} />
                <div>
                    <h1 className="work-orders__title">
                        {isAr ? 'إدارة أوامر العمل' : 'Work Order Management'}
                    </h1>
                    <p className="work-orders__subtitle">
                        {isAr ? 'تعيين الفنيين ومتابعة التنفيذ' : 'Assign technicians and track job execution'}
                    </p>
                </div>
                <button
                    className="work-orders__create-btn"
                    onClick={() => navigate('/work-orders/create')}
                >
                    <Plus size={18} />
                    {isAr ? 'مهمة جديدة' : 'New Mission'}
                </button>
            </div>

            {/* Stats Bar */}
            <div className="work-orders__stats-bar">
                <div className="work-orders__stat">
                    <span className="work-orders__stat-value" style={{ color: 'var(--jeraisy-gold)' }}>
                        {state.workOrders.length}
                    </span>
                    <span className="work-orders__stat-label">{isAr ? 'إجمالي الأوامر' : 'Total Orders'}</span>
                </div>
                <div className="work-orders__stat">
                    <span className="work-orders__stat-value" style={{ color: 'var(--status-amber)' }}>
                        {state.workOrders.filter(w => w.status === 'pending').length}
                    </span>
                    <span className="work-orders__stat-label">{isAr ? 'بانتظار التعيين' : 'Awaiting Assignment'}</span>
                </div>
                <div className="work-orders__stat">
                    <span className="work-orders__stat-value" style={{ color: 'var(--status-green)' }}>
                        {state.workOrders.filter(w => w.status === 'inProgress').length}
                    </span>
                    <span className="work-orders__stat-label">{isAr ? 'قيد التنفيذ' : 'In Progress'}</span>
                </div>
                <div className="work-orders__stat">
                    <span className="work-orders__stat-value" style={{ color: 'var(--text-muted)' }}>
                        {state.workers.filter(w => !w.assignedWorkOrder && w.status === 'active' && w.hoursWorked < state.thresholds.overtimeHoursLimit).length}
                    </span>
                    <span className="work-orders__stat-label">{isAr ? 'فنيين متاحين' : 'Available Techs'}</span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="work-orders__tabs">
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`work-orders__tab ${activeTab === tab.key ? 'work-orders__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {isAr ? tab.labelAr : tab.labelEn}
                        <span className="work-orders__tab-count">{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Job Cards */}
            <div className="work-orders__list">
                {filtered.length === 0 ? (
                    <div className="work-orders__empty">
                        <ClipboardList size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                        <p>{isAr ? 'لا توجد أوامر عمل' : 'No work orders found'}</p>
                    </div>
                ) : (
                    filtered.map(wo => {
                        const cfg = statusConfig[wo.status];
                        const isExpanded = expandedId === wo.id;
                        const assignedWorkers = state.workers.filter(w => w.assignedWorkOrder === wo.id);

                        return (
                            <div key={wo.id} className={`wo-card glass-panel ${isExpanded ? 'wo-card--expanded' : ''}`}>
                                <div className="wo-card__main" onClick={() => setExpandedId(isExpanded ? null : wo.id)}>
                                    <div className="wo-card__left">
                                        <div className="wo-card__id">{wo.id}</div>
                                        <div className="wo-card__customer">
                                            {isAr ? wo.customerAr : wo.customerEn}
                                        </div>
                                    </div>
                                    <div className="wo-card__center">
                                        <div className="wo-card__desc">
                                            {isAr ? wo.descriptionAr : wo.descriptionEn}
                                        </div>
                                        <div className="wo-card__meta">
                                            <span><MapPin size={12} /> {isAr ? wo.siteAr : wo.siteEn}</span>
                                            <span><Clock size={12} /> {wo.estimatedHours}h {isAr ? 'مقدر' : 'est.'}</span>
                                            <span><Users size={12} /> {assignedWorkers.length} {isAr ? 'فني' : 'techs'}</span>
                                        </div>
                                    </div>
                                    <div className="wo-card__right">
                                        <span className={`wo-card__badge ${cfg.colorClass}`}>
                                            {cfg.iconEl} {isAr ? cfg.labelAr : cfg.labelEn}
                                        </span>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="wo-card__details">
                                        <div className="wo-card__detail-row">
                                            <span className="wo-card__detail-label">{isAr ? 'معرّف السلطة' : 'Authority ID'}</span>
                                            <span className="wo-card__detail-value">{`JRY-DNS-${wo.id.replace(/\D/g, '').padStart(5, '0')}`}</span>
                                        </div>
                                        <div className="wo-card__detail-row">
                                            <span className="wo-card__detail-label">{isAr ? 'فئة المهمة' : 'Mission Category'}</span>
                                            <span className="wo-card__detail-value wo-card__detail-value--gold">
                                                {(() => {
                                                    const sku = skuMap.find(s => s.sku === wo.sku);
                                                    return sku ? (isAr ? sku.nameAr : sku.nameEn) : (isAr ? wo.descriptionAr : wo.descriptionEn);
                                                })()}
                                            </span>
                                        </div>
                                        {/* Live Geofence Status for active orders */}
                                        {(wo.status === 'inProgress' || wo.status === 'inTransit') && (
                                            <div className="wo-card__detail-row">
                                                <span className="wo-card__detail-label">{isAr ? 'الحالة الحية' : 'Live Status'}</span>
                                                <span className={`wo-card__geofence-status wo-card__geofence-status--${wo.status === 'inTransit' ? 'transit' : 'onsite'}`}>
                                                    {wo.status === 'inTransit'
                                                        ? <><Radio size={12} className="wo-card__pulse-icon" /> {isAr ? 'في الطريق' : 'En Route'}</>
                                                        : <><ShieldCheck size={12} /> {isAr ? 'الفني في الموقع' : 'Technician On-Site'}</>
                                                    }
                                                </span>
                                            </div>
                                        )}
                                        {assignedWorkers.length > 0 && (
                                            <div className="wo-card__detail-row wo-card__detail-row--stacked">
                                                <span className="wo-card__detail-label">{isAr ? 'الفنيون المعينون' : 'Assigned Technicians'}</span>
                                                <div className="wo-card__worker-chips">
                                                    {assignedWorkers.map(w => (
                                                        <span key={w.id} className="wo-card__worker-chip">
                                                            {isAr ? w.nameAr : w.nameEn}
                                                            <span className="wo-card__worker-chip-hours">{w.hoursWorked}h</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="wo-card__actions">
                                            {wo.status === 'pending' && (
                                                <button
                                                    className="wo-card__assign-btn"
                                                    onClick={() => handleAssignWorkers(wo)}
                                                    disabled={assigningId === wo.id}
                                                >
                                                    {assigningId === wo.id
                                                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {isAr ? 'جارٍ التعيين...' : 'Assigning...'}</>
                                                        : <><Users size={14} /> {isAr ? 'تعيين فنيين' : 'Assign Technicians'}</>
                                                    }
                                                </button>
                                            )}
                                            {wo.status === 'inProgress' && (
                                                <button
                                                    className="wo-card__complete-btn"
                                                    onClick={() => handleCompleteWO(wo)}
                                                >
                                                    <CheckCircle2 size={14} /> {isAr ? 'إنهاء الأمر' : 'Mark Complete'}
                                                </button>
                                            )}
                                            {wo.status === 'inProgress' && (
                                                <div className="wo-card__overtime-check">
                                                    {assignedWorkers.some(w => w.hoursWorked >= state.thresholds.overtimeHoursLimit)
                                                        ? <><AlertTriangle size={14} color="var(--status-red)" /> {isAr ? 'تحذير: فني تجاوز حد العمل الإضافي' : 'Warning: Tech exceeding OT limit'}</>
                                                        : <><CheckCircle2 size={14} color="var(--status-green)" /> {isAr ? 'جميع الفنيين ضمن الحد' : 'All techs within limit'}</>
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
