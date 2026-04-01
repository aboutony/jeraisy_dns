import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, User, MapPin, Briefcase, Clock, Truck,
    Shield, AlertTriangle, ArrowRight, ToggleLeft, ToggleRight,
    Package, ClipboardList, Home, GraduationCap, BadgeCheck,
    Star, Zap, Activity,
} from 'lucide-react';
import { computeCompositeScore } from '../../services/LoadBalancer';
import type { FeedbackInputs } from '../../services/LoadBalancer';
import { useGlobalStore } from '../../store/GlobalStore';
import type { BranchCode } from '../../store/types';
import './WorkerDetail.css';

const siteLabels: Record<string, { ar: string; en: string }> = {
    riyadh: { ar: 'الرياض', en: 'Riyadh' },
    jeddah: { ar: 'جدة', en: 'Jeddah' },
    dammam: { ar: 'الدمام', en: 'Dammam' },
};

const branchLabels: Record<BranchCode, { ar: string; en: string }> = {
    HQ: { ar: 'المقر الرئيسي', en: 'HQ' },
    RUH: { ar: 'الرياض', en: 'Riyadh' },
    DMM: { ar: 'الدمام', en: 'Dammam' },
    JED: { ar: 'جدة', en: 'Jeddah' },
};

export default function WorkerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();

    const [overtimeAuthorized, setOvertimeAuthorized] = useState(false);
    const [showIBTModal, setShowIBTModal] = useState(false);
    const [ibtDestination, setIbtDestination] = useState<BranchCode>('JED');
    const [ibtSubmitted, setIbtSubmitted] = useState(false);

    const workerId = parseInt(id || '0', 10);
    const worker = state.workers.find(w => w.id === workerId);

    // Find assigned work order
    const workOrder = useMemo(() => {
        return state.workOrders.find(wo => wo.id === worker?.assignedWorkOrder) || null;
    }, [state.workOrders, worker]);

    // Find assigned vehicle (from transit missions)
    const assignedMission = useMemo(() => {
        return state.transitMissions.find(m => m.driverId === workerId) || null;
    }, [state.transitMissions, workerId]);


    if (!worker) {
        return (
            <div className="worker-detail">
                <div className="worker-detail__not-found">
                    <AlertTriangle size={48} />
                    <h2>{isAr ? 'الموظف غير موجود' : 'Worker Not Found'}</h2>
                    <p>ID: {id}</p>
                    <button className="worker-detail__back-btn" onClick={() => navigate('/workforce')}>
                        <ArrowLeft size={16} /> {isAr ? 'العودة للقوى العاملة' : 'Back to Workforce'}
                    </button>
                </div>
            </div>
        );
    }

    const progressPct = Math.min((worker.hoursWorked / worker.weeklyLimit) * 100, 100);
    const isOvertime = worker.hoursWorked >= 38;
    const isOvertimeRisk = worker.hoursWorked >= 35 && worker.hoursWorked < 38;

    const handleIBTSubmit = () => {
        setIbtSubmitted(true);
        setTimeout(() => {
            setShowIBTModal(false);
            setIbtSubmitted(false);
        }, 2000);
    };

    return (
        <div className="worker-detail">
            {/* Header */}
            <div className="worker-detail__header">
                <button className="worker-detail__back-btn" onClick={() => navigate('/workforce')}>
                    <ArrowLeft size={16} />
                    {isAr ? 'القوى العاملة' : 'Workforce'}
                </button>
            </div>

            {/* Identity Card */}
            <div className="worker-detail__identity">
                <div className="worker-detail__avatar">
                    <User size={32} />
                </div>
                <div className="worker-detail__info">
                    <h1 className="worker-detail__name">
                        {isAr ? worker.nameAr : worker.nameEn}
                    </h1>
                    <div className="worker-detail__meta-row">
                        <span className="worker-detail__id">ID: {worker.id}</span>
                        <span className={`badge ${isOvertime ? 'badge--red' : isOvertimeRisk ? 'badge--amber' : worker.status === 'active' ? 'badge--green' : ''}`}>
                            {isOvertime
                                ? (isAr ? 'تجاوز ساعات العمل' : 'Overtime')
                                : isOvertimeRisk
                                    ? (isAr ? 'خطر تجاوز' : 'Overtime Risk')
                                    : (isAr ? 'نشط' : 'Active')}
                        </span>
                    </div>
                    <div className="worker-detail__meta-tags">
                        <span className="worker-detail__tag">
                            <Briefcase size={12} />
                            {isAr ? worker.departmentAr : worker.department}
                        </span>
                        <span className="worker-detail__tag">
                            <User size={12} />
                            {isAr ? worker.roleAr : worker.role}
                        </span>
                        <span className="worker-detail__tag">
                            <MapPin size={12} />
                            {isAr ? (siteLabels[worker.site]?.ar || worker.site) : (siteLabels[worker.site]?.en || worker.site)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Hours Progress */}
            <div className="worker-detail__section">
                <h2 className="worker-detail__section-title">
                    <Clock size={18} />
                    {isAr ? 'ساعات العمل الأسبوعية' : 'Weekly Work Hours'}
                </h2>
                <div className="worker-detail__hours-card">
                    <div className="worker-detail__hours-display">
                        <span className={`worker-detail__hours-value ${isOvertime ? 'text-red' : isOvertimeRisk ? 'text-amber' : 'text-green'}`}>
                            {worker.hoursWorked}h
                        </span>
                        <span className="worker-detail__hours-limit">
                            / {worker.weeklyLimit}h {isAr ? 'الحد' : 'Limit'}
                        </span>
                    </div>
                    <div className="worker-detail__progress-bar">
                        <div
                            className={`worker-detail__progress-fill ${isOvertime ? 'worker-detail__progress-fill--red' : isOvertimeRisk ? 'worker-detail__progress-fill--amber' : 'worker-detail__progress-fill--green'}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    {isOvertime && (
                        <div className="worker-detail__overtime-alert">
                            <AlertTriangle size={14} />
                            {isAr ? 'تم حظر المهام — تجاوز 38 ساعة أسبوعيًا' : 'Tasks Blocked — Exceeded 38h weekly limit'}
                        </div>
                    )}
                </div>
            </div>

            <div className="worker-detail__grid">
                {/* Task Handshake */}
                <div className="worker-detail__section">
                    <h2 className="worker-detail__section-title">
                        <ClipboardList size={18} />
                        {isAr ? 'مصافحة المهمة' : 'Task Handshake'}
                    </h2>

                    {assignedMission ? (
                        <div className="worker-detail__task-card">
                            <div className="worker-detail__task-route">
                                <span className="worker-detail__task-branch">
                                    {isAr ? branchLabels[assignedMission.originBranch].ar : branchLabels[assignedMission.originBranch].en}
                                </span>
                                <ArrowRight size={14} />
                                <span className="worker-detail__task-branch">
                                    {isAr ? branchLabels[assignedMission.destinationBranch].ar : branchLabels[assignedMission.destinationBranch].en}
                                </span>
                            </div>
                            <div className="worker-detail__task-meta">
                                <div>
                                    <span className="worker-detail__task-label">{isAr ? 'المركبة' : 'Vehicle'}</span>
                                    <Link
                                        to="/fleet"
                                        className="worker-detail__vehicle-link"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Truck size={14} />
                                        {assignedMission.vehicleId}
                                    </Link>
                                </div>
                                <div>
                                    <span className="worker-detail__task-label">{isAr ? 'الحمولة' : 'Cargo'}</span>
                                    <span className="worker-detail__task-value">
                                        <Package size={12} />
                                        {isAr ? assignedMission.cargoDescriptionAr : assignedMission.cargoDescriptionEn}
                                    </span>
                                </div>
                                <div>
                                    <span className="worker-detail__task-label">{isAr ? 'كفاءة التحميل' : 'Load'}</span>
                                    <span className={`worker-detail__task-value ${assignedMission.loadEfficiency < 50 ? 'text-amber' : 'text-green'}`}>
                                        {assignedMission.loadEfficiency}%
                                    </span>
                                </div>
                            </div>
                            {assignedMission.returnToBase && (
                                <div className="worker-detail__rtb">
                                    <Home size={12} />
                                    {isAr
                                        ? `عودة للقاعدة: ${branchLabels[assignedMission.driverHomeBranch].ar}`
                                        : `Return-to-Base: ${branchLabels[assignedMission.driverHomeBranch].en}`}
                                </div>
                            )}
                        </div>
                    ) : workOrder ? (
                        <div className="worker-detail__task-card">
                            <div className="worker-detail__task-wo">
                                <span className="worker-detail__task-label">{isAr ? 'أمر العمل' : 'Work Order'}</span>
                                <span className="worker-detail__task-value worker-detail__task-value--mono">
                                    {workOrder.id}
                                </span>
                            </div>
                            <div className="worker-detail__task-wo">
                                <span className="worker-detail__task-label">{isAr ? 'العميل' : 'Customer'}</span>
                                <span className="worker-detail__task-value">
                                    {isAr ? workOrder.customerAr : workOrder.customerEn}
                                </span>
                            </div>
                            <div className="worker-detail__task-wo">
                                <span className="worker-detail__task-label">{isAr ? 'الوصف' : 'Description'}</span>
                                <span className="worker-detail__task-value">
                                    {isAr ? workOrder.descriptionAr : workOrder.descriptionEn}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="worker-detail__empty">
                            {isAr ? 'لا توجد مهمة مسندة حاليًا' : 'No active task assigned'}
                        </div>
                    )}
                </div>

                {/* Compliance Control */}
                <div className="worker-detail__section">
                    <h2 className="worker-detail__section-title">
                        <Shield size={18} />
                        {isAr ? 'ضبط الامتثال' : 'Compliance Control'}
                    </h2>

                    <div className="worker-detail__compliance-card">
                        <div className="worker-detail__compliance-row">
                            <div>
                                <div className="worker-detail__compliance-label">
                                    {isAr ? 'تفويض ساعات إضافية' : 'Authorize Overtime'}
                                </div>
                                <div className="worker-detail__compliance-desc">
                                    {isAr
                                        ? 'يتطلب موافقة الإدارة العليا — يتجاوز حد 38 ساعة'
                                        : 'Requires High Management approval — overrides 38h limit'}
                                </div>
                            </div>
                            <button
                                className={`worker-detail__toggle ${overtimeAuthorized ? 'worker-detail__toggle--on' : ''}`}
                                onClick={() => setOvertimeAuthorized(!overtimeAuthorized)}
                            >
                                {overtimeAuthorized
                                    ? <ToggleRight size={32} />
                                    : <ToggleLeft size={32} />}
                            </button>
                        </div>
                        {overtimeAuthorized && (
                            <div className="worker-detail__compliance-alert">
                                <Shield size={14} />
                                {isAr
                                    ? 'تم تفويض ساعات إضافية — تتطلب توقيع المدير'
                                    : 'Overtime authorized — Director signature required'}
                            </div>
                        )}

                        <div className="worker-detail__compliance-stats">
                            <div className="worker-detail__stat">
                                <span className="worker-detail__stat-value">{worker.hoursWorked}h</span>
                                <span className="worker-detail__stat-label">{isAr ? 'هذا الأسبوع' : 'This Week'}</span>
                            </div>
                            <div className="worker-detail__stat">
                                <span className="worker-detail__stat-value">{worker.weeklyLimit}h</span>
                                <span className="worker-detail__stat-label">{isAr ? 'الحد الأسبوعي' : 'Weekly Limit'}</span>
                            </div>
                            <div className="worker-detail__stat">
                                <span className={`worker-detail__stat-value ${progressPct >= 100 ? 'text-red' : 'text-green'}`}>
                                    {Math.round(progressPct)}%
                                </span>
                                <span className="worker-detail__stat-label">{isAr ? 'الاستهلاك' : 'Usage'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Digital Passport */}
            <div className="worker-detail__section">
                <h2 className="worker-detail__section-title">
                    <BadgeCheck size={18} />
                    {isAr ? 'الجواز الرقمي — V-Profile' : 'Digital Passport — V-Profile'}
                </h2>
                <div className="worker-detail__passport-card">
                    <div className="worker-detail__passport-row">
                        <div className="worker-detail__passport-field">
                            <span className="worker-detail__passport-label">
                                {isAr ? 'مستوى الشهادة' : 'Certification Tier'}
                            </span>
                            <span className="worker-detail__passport-value worker-detail__passport-value--gold">
                                <GraduationCap size={14} />
                                {isAr ? 'مركِّب محترف' : 'Pro Installer'}
                            </span>
                        </div>
                        <div className="worker-detail__passport-field">
                            <span className="worker-detail__passport-label">
                                {isAr ? 'حالة اللغة' : 'Language Status'}
                            </span>
                            <span className="worker-detail__passport-value worker-detail__passport-value--green">
                                {isAr ? 'ثنائي اللغة موثق' : 'Verified Bilingual'}
                            </span>
                        </div>
                    </div>
                    <div className="worker-detail__passport-badges">
                        <span className="worker-detail__passport-badge worker-detail__passport-badge--active">
                            <BadgeCheck size={12} />
                            {isAr ? 'ترخيص التجارة — ساري' : 'Trade License — Active'}
                        </span>
                        <span className="worker-detail__passport-badge worker-detail__passport-badge--active">
                            <Shield size={12} />
                            {isAr ? 'الهوية الوطنية — موثقة' : 'National ID — Verified'}
                        </span>
                        <span className="worker-detail__passport-badge worker-detail__passport-badge--expiring">
                            <AlertTriangle size={12} />
                            {isAr ? 'شهادة السلامة — تنتهي 2026-08' : 'Safety Cert — Exp. 2026-08'}
                        </span>
                    </div>
                    <button
                        className="worker-detail__passport-academy-btn"
                        onClick={() => navigate('/academy')}
                    >
                        <GraduationCap size={15} />
                        {isAr ? 'عرض مسار التدريب في الأكاديمية' : 'View Training Path in Academy'}
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            {/* 360° Performance Gauge */}
            <div className="worker-detail__section">
                <h2 className="worker-detail__section-title">
                    <Activity size={18} />
                    {isAr ? 'مقياس الأداء 360°' : '360° Performance Gauge'}
                </h2>
                {(() => {
                    // Stub feedback inputs — wire to live API / V-Trace survey data
                    const feedbackInputs: FeedbackInputs = {
                        customer:   { avgStarRating: 4.3, ratingCount: 12 },
                        autoSignal: { onTimeRate: 0.91, ttiEfficiency: 0.87, photoPassRate: 0.96 },
                        supervisor: { score: 4.1, evaluationCount: 4 },
                        peer:       { score: 3.9, peerCount: 6 },
                    };
                    const breakdown = computeCompositeScore(feedbackInputs);
                    const channels: Array<{
                        labelEn: string; labelAr: string;
                        value: number; weight: string;
                        icon: React.ElementType; color: string;
                    }> = [
                        { labelEn: 'Customer',   labelAr: 'العميل',       value: breakdown.customerComponent,   weight: '40%', icon: Star,         color: '#c9a84c' },
                        { labelEn: 'Auto-Signal',labelAr: 'الإشارات التلقائية', value: breakdown.autoSignalComponent, weight: '30%', icon: Zap,  color: '#3b82f6' },
                        { labelEn: 'Supervisor', labelAr: 'المشرف',       value: breakdown.supervisorComponent, weight: '20%', icon: Shield,       color: '#8b5cf6' },
                        { labelEn: 'Peer',       labelAr: 'الزملاء',      value: breakdown.peerComponent,       weight: '10%', icon: User,         color: '#22c55e' },
                    ];
                    return (
                        <div className="worker-detail__gauge-card">
                            <div className="worker-detail__gauge-score">
                                <span className="worker-detail__gauge-total">
                                    {breakdown.compositeScore.toFixed(1)}
                                </span>
                                <span className="worker-detail__gauge-max">/100</span>
                                {breakdown.lowConfidence && (
                                    <span className="worker-detail__gauge-low-conf">
                                        {isAr ? 'ثقة منخفضة' : 'Low Confidence'}
                                    </span>
                                )}
                            </div>
                            <div className="worker-detail__gauge-bars">
                                {channels.map(ch => (
                                    <div key={ch.labelEn} className="worker-detail__gauge-row">
                                        <ch.icon size={14} style={{ color: ch.color, flexShrink: 0 }} />
                                        <span className="worker-detail__gauge-label">
                                            {isAr ? ch.labelAr : ch.labelEn}
                                            <span className="worker-detail__gauge-weight">{ch.weight}</span>
                                        </span>
                                        <div className="worker-detail__gauge-bar-track">
                                            <div
                                                className="worker-detail__gauge-bar-fill"
                                                style={{ width: `${ch.value}%`, background: ch.color }}
                                            />
                                        </div>
                                        <span className="worker-detail__gauge-val">{ch.value.toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Transit Action */}
            <div className="worker-detail__section">
                <h2 className="worker-detail__section-title">
                    <Truck size={18} />
                    {isAr ? 'إجراء النقل بين الفروع' : 'Transit Action'}
                </h2>

                {assignedMission ? (
                    <div className="worker-detail__transit-active">
                        <AlertTriangle size={14} />
                        {isAr
                            ? `العامل في مهمة نقل نشطة: ${branchLabels[assignedMission.originBranch].ar} → ${branchLabels[assignedMission.destinationBranch].ar}`
                            : `Worker on active transit: ${branchLabels[assignedMission.originBranch].en} → ${branchLabels[assignedMission.destinationBranch].en}`}
                    </div>
                ) : (
                    <>
                        <button
                            className="worker-detail__ibt-btn"
                            onClick={() => setShowIBTModal(true)}
                            disabled={isOvertime && !overtimeAuthorized}
                        >
                            <ArrowRight size={16} />
                            {isAr ? 'تعيين لمهمة نقل بين الفروع' : 'Reassign to IBT Mission'}
                        </button>
                        {isOvertime && !overtimeAuthorized && (
                            <p className="worker-detail__ibt-blocked">
                                {isAr ? 'محظور — تجاوز ساعات العمل. يجب تفويض الساعات الإضافية أولاً.' : 'Blocked — Overtime exceeded. Authorize overtime first.'}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* IBT Assignment Modal */}
            {showIBTModal && (
                <div className="worker-detail__modal-overlay" onClick={() => setShowIBTModal(false)}>
                    <div className="worker-detail__modal" onClick={e => e.stopPropagation()}>
                        <h3 className="worker-detail__modal-title">
                            {isAr ? 'تعيين مهمة نقل بين الفروع' : 'Assign IBT Mission'}
                        </h3>
                        <div className="worker-detail__modal-field">
                            <label>{isAr ? 'الموظف' : 'Worker'}</label>
                            <div className="worker-detail__modal-value">
                                {isAr ? worker.nameAr : worker.nameEn} (ID: {worker.id})
                            </div>
                        </div>
                        <div className="worker-detail__modal-field">
                            <label>{isAr ? 'القاعدة الأصلية' : 'Home Base'}</label>
                            <div className="worker-detail__modal-value">
                                <MapPin size={14} />
                                {isAr ? (siteLabels[worker.site]?.ar || worker.site) : (siteLabels[worker.site]?.en || worker.site)}
                            </div>
                        </div>
                        <div className="worker-detail__modal-field">
                            <label>{isAr ? 'الوجهة' : 'Destination'}</label>
                            <select
                                className="worker-detail__modal-select"
                                value={ibtDestination}
                                onChange={e => setIbtDestination(e.target.value as BranchCode)}
                            >
                                {state.branches
                                    .filter(b => !b.isHQ)
                                    .map(b => (
                                        <option key={b.code} value={b.code}>
                                            {isAr ? b.nameAr : b.nameEn}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="worker-detail__modal-actions">
                            <button
                                className="worker-detail__modal-cancel"
                                onClick={() => setShowIBTModal(false)}
                            >
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                className="worker-detail__modal-submit"
                                onClick={handleIBTSubmit}
                                disabled={ibtSubmitted}
                            >
                                {ibtSubmitted
                                    ? (isAr ? '✓ تم الإرسال' : '✓ Submitted')
                                    : (isAr ? 'تأكيد التعيين' : 'Confirm Assignment')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
