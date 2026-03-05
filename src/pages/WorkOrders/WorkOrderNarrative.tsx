import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Check, MapPin, Package, Users,
    AlertTriangle, Building2, Truck, UserCheck, RefreshCw, Sparkles,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import OracleConnector from '../../services/OracleConnector';
import { pushMissionAssigned, BRANCH_COORDS } from '../../services/NotificationTrigger';
import type { BranchCode, SkuMapping, Worker, Vehicle } from '../../store/types';
import './WorkOrderNarrative.css';

// ── Branch Map ────────────────────────────────────────────────
const BRANCHES: { code: BranchCode; nameEn: string; nameAr: string; siteKey: string }[] = [
    { code: 'HQ', nameEn: 'Riyadh HQ', nameAr: 'المقر الرئيسي - الرياض', siteKey: 'riyadh' },
    { code: 'RUH', nameEn: 'Riyadh Branch', nameAr: 'فرع الرياض', siteKey: 'riyadh' },
    { code: 'DMM', nameEn: 'Dammam Branch', nameAr: 'فرع الدمام', siteKey: 'dammam' },
    { code: 'JED', nameEn: 'Jeddah Branch', nameAr: 'فرع جدة', siteKey: 'jeddah' },
];

// ── SKU → Department Mapping ──────────────────────────────────
const CATEGORY_DEPT_MAP: Record<string, string[]> = {
    luxury: ['Luxury Assembly'],
    commercial: ['Commercial Installation'],
    medical: ['Factory Operations', 'Quality Control'],
    hospitality: ['Luxury Assembly', 'Commercial Installation'],
};

type NarrativeStep = 1 | 2 | 3;

interface StepOneData {
    clientNameEn: string;
    clientNameAr: string;
    branch: BranchCode | null;
    siteLocation: string;
}

interface StepTwoData {
    selectedSku: SkuMapping | null;
}

interface StepThreeData {
    selectedWorkers: number[];
    selectedVehicle: string | null;
}

export default function WorkOrderNarrative() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const navigate = useNavigate();
    const { state, dispatch } = useGlobalStore();

    const [currentStep, setCurrentStep] = useState<NarrativeStep>(1);
    const [stepOne, setStepOne] = useState<StepOneData>({
        clientNameEn: '', clientNameAr: '', branch: null, siteLocation: '',
    });
    const [stepTwo, setStepTwo] = useState<StepTwoData>({ selectedSku: null });
    const [stepThree, setStepThree] = useState<StepThreeData>({
        selectedWorkers: [], selectedVehicle: null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const skuMap = useMemo(() => OracleConnector.getSkuLaborMap(), []);

    // ── Narrative Cascade: Filter workers by branch + SKU category ──
    const filteredWorkers = useMemo(() => {
        if (!stepOne.branch || !stepTwo.selectedSku) return [];
        const branchDef = BRANCHES.find(b => b.code === stepOne.branch);
        if (!branchDef) return [];

        const validDepts = CATEGORY_DEPT_MAP[stepTwo.selectedSku.category] || [];

        return state.workers.filter(w => {
            const siteMatch = w.site === branchDef.siteKey;
            const deptMatch = validDepts.length === 0 || validDepts.includes(w.department);
            const notAssigned = !w.assignedWorkOrder;
            return siteMatch && deptMatch && notAssigned;
        });
    }, [state.workers, stepOne.branch, stepTwo.selectedSku]);

    // ── Narrative Cascade: Filter vehicles by branch ──────────
    const filteredVehicles = useMemo(() => {
        if (!stepOne.branch) return [];
        return state.vehicles.filter(
            (v: Vehicle) => v.homeBranch === stepOne.branch && v.status === 'available'
        );
    }, [state.vehicles, stepOne.branch]);

    // ── Overtime Guard ────────────────────────────────────────
    const getAlternative = useCallback((worker: Worker): Worker | null => {
        if (worker.hoursWorked < 35) return null;
        return filteredWorkers.find(
            w => w.id !== worker.id
                && w.department === worker.department
                && w.hoursWorked < 35
                && !stepThree.selectedWorkers.includes(w.id)
        ) || null;
    }, [filteredWorkers, stepThree.selectedWorkers]);

    const toggleWorker = (id: number) => {
        setStepThree(prev => ({
            ...prev,
            selectedWorkers: prev.selectedWorkers.includes(id)
                ? prev.selectedWorkers.filter(w => w !== id)
                : [...prev.selectedWorkers, id],
        }));
    };

    const swapWorker = (oldId: number, newId: number) => {
        setStepThree(prev => ({
            ...prev,
            selectedWorkers: prev.selectedWorkers.map(w => w === oldId ? newId : w),
        }));
    };

    // ── Step Validation ───────────────────────────────────────
    const canAdvance = (step: NarrativeStep): boolean => {
        if (step === 1) return !!(stepOne.clientNameEn && stepOne.branch && stepOne.siteLocation);
        if (step === 2) return !!stepTwo.selectedSku;
        return stepThree.selectedWorkers.length > 0;
    };

    // ── Submit: Create Work Order + Push Notification ─────────
    const handleSubmit = async () => {
        if (!stepTwo.selectedSku || !stepOne.branch) return;
        setIsSubmitting(true);

        const woId = `WO-2026-${String(state.workOrders.length + 10).padStart(3, '0')}`;
        const branchDef = BRANCHES.find(b => b.code === stepOne.branch)!;
        const newWO = {
            id: woId,
            oracleRef: `ORA-CRM-${Date.now().toString().slice(-5)}`,
            customerAr: stepOne.clientNameAr || stepOne.clientNameEn,
            customerEn: stepOne.clientNameEn,
            siteAr: `${stepOne.siteLocation} - ${branchDef.nameAr}`,
            siteEn: `${stepOne.siteLocation} - ${branchDef.nameEn}`,
            sku: stepTwo.selectedSku.sku,
            descriptionAr: stepTwo.selectedSku.nameAr,
            descriptionEn: stepTwo.selectedSku.nameEn,
            estimatedHours: stepTwo.selectedSku.estimatedHours,
            actualHours: null,
            status: 'pending' as const,
            assignedWorkers: stepThree.selectedWorkers.length,
            lastSync: new Date().toISOString(),
            direction: 'inbound' as const,
            orderType: 'standard' as const,
        };

        dispatch({
            type: 'WORK_ORDERS_LOADED',
            payload: [...state.workOrders, newWO],
        });

        // ── Mission Notification Push ─────────────────────
        const gpsCoords = BRANCH_COORDS[stepOne.branch] || null;
        pushMissionAssigned(
            dispatch,
            {
                workOrderId: woId,
                crewIds: stepThree.selectedWorkers,
                vehicleId: stepThree.selectedVehicle,
                driverId: stepThree.selectedWorkers[0] || null,
                gpsCoords,
                siteLocation: stepOne.siteLocation,
                branchCode: stepOne.branch,
                skuCode: stepTwo.selectedSku.sku,
                status: 'assigned',
                assignedAt: new Date().toISOString(),
                respondedAt: null,
            },
            stepOne.clientNameEn,
            stepOne.clientNameAr || stepOne.clientNameEn,
            stepTwo.selectedSku.nameEn,
            stepTwo.selectedSku.nameAr,
        );

        await new Promise(r => setTimeout(r, 600));
        setIsSubmitting(false);
        // Navigate to Mission Brief (The Mobile Handshake)
        navigate(`/work-orders/${woId}/brief`);
    };

    // ── Step Labels ───────────────────────────────────────────
    const steps = [
        { num: 1, labelEn: 'Client & Site', labelAr: 'العميل والموقع', icon: Building2 },
        { num: 2, labelEn: 'SKU Handshake', labelAr: 'اختيار الخدمة', icon: Package },
        { num: 3, labelEn: 'Intelligent Matching', labelAr: 'المطابقة الذكية', icon: Users },
    ];

    return (
        <div className="wo-narrative">
            {/* ── Header ──────────────────────────────────── */}
            <div className="wo-narrative__header">
                <button className="wo-narrative__back" onClick={() => navigate('/work-orders')}>
                    <ArrowLeft size={18} />
                    <span>{isAr ? 'أوامر العمل' : 'Work Orders'}</span>
                </button>
                <div>
                    <h1 className="wo-narrative__title">
                        <Sparkles size={24} style={{ color: 'var(--jeraisy-gold)' }} />
                        {isAr ? 'إنشاء مهمة جديدة' : 'Create New Mission'}
                    </h1>
                    <p className="wo-narrative__subtitle">
                        {isAr ? 'معالج إنشاء أمر عمل ذكي' : 'Intelligent Work Order Wizard'}
                    </p>
                </div>
            </div>

            {/* ── Step Progress ────────────────────────────── */}
            <div className="wo-narrative__stepper">
                {steps.map((s, i) => (
                    <div key={s.num} className={`wo-narrative__step-indicator ${currentStep === s.num ? 'wo-narrative__step-indicator--active' :
                        currentStep > s.num ? 'wo-narrative__step-indicator--done' : ''
                        }`}>
                        <div className="wo-narrative__step-circle">
                            {currentStep > s.num ? <Check size={16} /> : <s.icon size={16} />}
                        </div>
                        <span className="wo-narrative__step-label">
                            {isAr ? s.labelAr : s.labelEn}
                        </span>
                        {i < steps.length - 1 && <div className="wo-narrative__step-line" />}
                    </div>
                ))}
            </div>

            {/* ── Step 1: Client & Site ─────────────────────── */}
            {currentStep === 1 && (
                <div className="wo-narrative__card glass-panel wo-narrative__card--enter">
                    <h2 className="wo-narrative__card-title">
                        <Building2 size={20} />
                        {isAr ? 'الخطوة ١: العميل والموقع' : 'Step 1: Client & Site'}
                    </h2>
                    <div className="wo-narrative__form">
                        <div className="wo-narrative__field">
                            <label>{isAr ? 'اسم العميل (إنجليزي)' : 'Client Name (English)'}</label>
                            <input
                                type="text"
                                value={stepOne.clientNameEn}
                                onChange={e => setStepOne(p => ({ ...p, clientNameEn: e.target.value }))}
                                placeholder={isAr ? 'أدخل اسم العميل' : 'Enter client name'}
                                className="wo-narrative__input"
                            />
                        </div>
                        <div className="wo-narrative__field">
                            <label>{isAr ? 'اسم العميل (عربي)' : 'Client Name (Arabic)'}</label>
                            <input
                                type="text"
                                dir="rtl"
                                value={stepOne.clientNameAr}
                                onChange={e => setStepOne(p => ({ ...p, clientNameAr: e.target.value }))}
                                placeholder={isAr ? 'أدخل اسم العميل بالعربي' : 'Enter Arabic client name'}
                                className="wo-narrative__input"
                            />
                        </div>
                        <div className="wo-narrative__field">
                            <label>{isAr ? 'الفرع' : 'Branch'}</label>
                            <div className="wo-narrative__branch-grid">
                                {BRANCHES.map(b => (
                                    <button
                                        key={b.code}
                                        className={`wo-narrative__branch-btn ${stepOne.branch === b.code ? 'wo-narrative__branch-btn--selected' : ''}`}
                                        onClick={() => setStepOne(p => ({ ...p, branch: b.code }))}
                                    >
                                        <MapPin size={16} />
                                        <span>{isAr ? b.nameAr : b.nameEn}</span>
                                        <span className="wo-narrative__branch-code">{b.code}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="wo-narrative__field">
                            <label>{isAr ? 'موقع GPS / العنوان' : 'GPS Site Location'}</label>
                            <input
                                type="text"
                                value={stepOne.siteLocation}
                                onChange={e => setStepOne(p => ({ ...p, siteLocation: e.target.value }))}
                                placeholder={isAr ? 'مثال: فيلا الملقا' : 'e.g., Al-Malqa Villa'}
                                className="wo-narrative__input"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 2: SKU Handshake ─────────────────────── */}
            {currentStep === 2 && (
                <div className="wo-narrative__card glass-panel wo-narrative__card--enter">
                    <h2 className="wo-narrative__card-title">
                        <Package size={20} />
                        {isAr ? 'الخطوة ٢: اختيار الخدمة' : 'Step 2: The SKU Handshake'}
                    </h2>

                    {/* Collapsed Step 1 Summary */}
                    <div className="wo-narrative__summary-pill">
                        <Building2 size={14} />
                        <span>{stepOne.clientNameEn}</span>
                        <span className="wo-narrative__summary-sep">•</span>
                        <MapPin size={14} />
                        <span>{stepOne.branch} — {stepOne.siteLocation}</span>
                    </div>

                    <div className="wo-narrative__sku-grid">
                        {skuMap.map(sku => (
                            <button
                                key={sku.sku}
                                className={`wo-narrative__sku-card ${stepTwo.selectedSku?.sku === sku.sku ? 'wo-narrative__sku-card--selected' : ''}`}
                                onClick={() => setStepTwo({ selectedSku: sku })}
                            >
                                <div className="wo-narrative__sku-name">
                                    {isAr ? sku.nameAr : sku.nameEn}
                                </div>
                                <div className="wo-narrative__sku-meta">
                                    <span className="wo-narrative__sku-code">{sku.sku}</span>
                                    <span className={`wo-narrative__sku-category wo-narrative__sku-category--${sku.category}`}>
                                        {sku.category}
                                    </span>
                                </div>
                                <div className="wo-narrative__sku-stats">
                                    <span>{sku.estimatedHours}h {isAr ? 'مقدر' : 'est.'}</span>
                                    <span>{isAr ? `${sku.laborRate} ر.س/ساعة` : `SAR ${sku.laborRate}/hr`}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Step 3: Intelligent Matching ──────────────── */}
            {currentStep === 3 && (
                <div className="wo-narrative__card glass-panel wo-narrative__card--enter">
                    <h2 className="wo-narrative__card-title">
                        <Users size={20} />
                        {isAr ? 'الخطوة ٣: المطابقة الذكية' : 'Step 3: Intelligent Matching'}
                    </h2>

                    {/* Collapsed summaries */}
                    <div className="wo-narrative__summary-pill">
                        <Building2 size={14} />
                        <span>{stepOne.clientNameEn}</span>
                        <span className="wo-narrative__summary-sep">•</span>
                        <Package size={14} />
                        <span>{isAr ? stepTwo.selectedSku?.nameAr : stepTwo.selectedSku?.nameEn}</span>
                        <span className="wo-narrative__summary-sep">•</span>
                        <MapPin size={14} />
                        <span>{stepOne.branch}</span>
                    </div>

                    {/* Workers section */}
                    <div className="wo-narrative__match-section">
                        <h3 className="wo-narrative__match-heading">
                            <UserCheck size={16} />
                            {isAr
                                ? `الفنيون المتاحون (${filteredWorkers.length})`
                                : `Available Technicians (${filteredWorkers.length})`}
                        </h3>
                        {filteredWorkers.length === 0 ? (
                            <div className="wo-narrative__empty">
                                {isAr ? 'لا يوجد فنيون متاحون لهذا الفرع والخدمة' : 'No technicians available for this branch & service'}
                            </div>
                        ) : (
                            <div className="wo-narrative__worker-list">
                                {filteredWorkers.slice(0, 20).map(w => {
                                    const isSelected = stepThree.selectedWorkers.includes(w.id);
                                    const isOvertime = w.hoursWorked >= 35;
                                    const alt = isOvertime ? getAlternative(w) : null;

                                    return (
                                        <div key={w.id} className={`wo-narrative__worker-row ${isSelected ? 'wo-narrative__worker-row--selected' : ''} ${isOvertime ? 'wo-narrative__worker-row--warning' : ''}`}>
                                            <div className="wo-narrative__worker-info">
                                                <button
                                                    className="wo-narrative__worker-toggle"
                                                    onClick={() => toggleWorker(w.id)}
                                                >
                                                    {isSelected ? <Check size={16} /> : <span className="wo-narrative__worker-check" />}
                                                </button>
                                                <div>
                                                    <div className="wo-narrative__worker-name">
                                                        {isAr ? w.nameAr : w.nameEn}
                                                    </div>
                                                    <div className="wo-narrative__worker-meta">
                                                        {isAr ? w.departmentAr : w.department} • {isAr ? w.roleAr : w.role}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="wo-narrative__worker-hours">
                                                <span className={`wo-narrative__hours-badge ${isOvertime ? 'wo-narrative__hours-badge--amber' : 'wo-narrative__hours-badge--green'}`}>
                                                    {w.hoursWorked}h / 38h
                                                </span>
                                            </div>
                                            {isOvertime && isSelected && (
                                                <div className="wo-narrative__overtime-guard">
                                                    <AlertTriangle size={14} />
                                                    <span>
                                                        {isAr
                                                            ? `⚠ تحذير: ${w.hoursWorked}h — يقترب من الحد`
                                                            : `⚠ Narrative Warning: ${w.hoursWorked}h — nearing 38h limit`}
                                                    </span>
                                                    {alt && (
                                                        <button
                                                            className="wo-narrative__swap-btn"
                                                            onClick={() => swapWorker(w.id, alt.id)}
                                                        >
                                                            <RefreshCw size={12} />
                                                            {isAr
                                                                ? `بديل: ${alt.nameAr} (${alt.hoursWorked}h)`
                                                                : `Switch to: ${alt.nameEn} (${alt.hoursWorked}h)`}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Vehicles section */}
                    <div className="wo-narrative__match-section">
                        <h3 className="wo-narrative__match-heading">
                            <Truck size={16} />
                            {isAr
                                ? `المركبات المتاحة — ${stepOne.branch} (${filteredVehicles.length})`
                                : `Available Vehicles — ${stepOne.branch} (${filteredVehicles.length})`}
                        </h3>
                        {filteredVehicles.length === 0 ? (
                            <div className="wo-narrative__empty">
                                {isAr ? 'لا توجد مركبات متاحة' : 'No vehicles available for this branch'}
                            </div>
                        ) : (
                            <div className="wo-narrative__vehicle-list">
                                {filteredVehicles.slice(0, 8).map(v => (
                                    <button
                                        key={v.id}
                                        className={`wo-narrative__vehicle-card ${stepThree.selectedVehicle === v.id ? 'wo-narrative__vehicle-card--selected' : ''}`}
                                        onClick={() => setStepThree(p => ({ ...p, selectedVehicle: v.id }))}
                                    >
                                        <Truck size={16} />
                                        <span className="wo-narrative__vehicle-id">{v.id}</span>
                                        <span className="wo-narrative__vehicle-type">{isAr ? v.typeAr : v.typeEn}</span>
                                        <span className="wo-narrative__vehicle-plate">{isAr ? v.plateAr : v.plateEn}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Navigation Footer ────────────────────────── */}
            <div className="wo-narrative__footer">
                {currentStep > 1 && (
                    <button
                        className="wo-narrative__nav-btn wo-narrative__nav-btn--back"
                        onClick={() => setCurrentStep((currentStep - 1) as NarrativeStep)}
                    >
                        <ArrowLeft size={16} />
                        {isAr ? 'السابق' : 'Previous'}
                    </button>
                )}
                <div style={{ flex: 1 }} />
                {currentStep < 3 ? (
                    <button
                        className="wo-narrative__nav-btn wo-narrative__nav-btn--next"
                        disabled={!canAdvance(currentStep)}
                        onClick={() => setCurrentStep((currentStep + 1) as NarrativeStep)}
                    >
                        {isAr ? 'التالي' : 'Next'}
                        <ArrowRight size={16} />
                    </button>
                ) : (
                    <button
                        className="wo-narrative__nav-btn wo-narrative__nav-btn--submit"
                        disabled={!canAdvance(3) || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting
                            ? (isAr ? 'جاري الإنشاء...' : 'Creating Mission...')
                            : (isAr ? '🚀 إنشاء المهمة' : '🚀 Create Mission')}
                    </button>
                )}
            </div>
        </div>
    );
}
