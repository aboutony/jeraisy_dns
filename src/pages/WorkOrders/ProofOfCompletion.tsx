import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Camera, PenTool, FileText, CheckCircle2, ArrowLeft,
    Loader2, Upload, Trash2, Clock, Star,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import { resolveMission } from '../../services/MissionResolution';
import OracleConnector from '../../services/OracleConnector';
import './ProofOfCompletion.css';

type ProtocolStep = 'photo' | 'signature' | 'notes' | 'submitting' | 'done';

export default function ProofOfCompletion() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state, dispatch } = useGlobalStore();

    const [step, setStep] = useState<ProtocolStep>('photo');
    const [photos, setPhotos] = useState<string[]>([]);
    const [signatureData, setSignatureData] = useState<string>('');
    const [jobNotes, setJobNotes] = useState('');
    const [actualHours, setActualHours] = useState(0);
    const [roiGained, setRoiGained] = useState(0);

    // Canvas refs for signature
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);

    // Resolve
    const workOrder = useMemo(
        () => state.workOrders.find(wo => wo.id === id),
        [state.workOrders, id],
    );
    const assignment = useMemo(
        () => state.missionAssignments.find(m => m.workOrderId === id),
        [state.missionAssignments, id],
    );
    const skuInfo = useMemo(
        () => OracleConnector.getSkuLaborMap().find(s => s.sku === workOrder?.sku),
        [workOrder],
    );

    useEffect(() => {
        if (workOrder) {
            setActualHours(workOrder.estimatedHours);
        }
    }, [workOrder]);

    // ── Photo Handler ─────────────────────────────────────────
    const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotos(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const removePhoto = useCallback((index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ── Signature Canvas ──────────────────────────────────────
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        ctx.strokeStyle = 'var(--jeraisy-gold)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Background
        ctx.fillStyle = 'rgba(18, 18, 20, 0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Guide line
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
        ctx.beginPath();
        ctx.moveTo(20, canvas.height - 40);
        ctx.lineTo(canvas.width - 20, canvas.height - 40);
        ctx.stroke();

        // Reset stroke for actual drawing
        ctx.strokeStyle = '#d4af37';
    }, []);

    useEffect(() => {
        if (step === 'signature') {
            setTimeout(initCanvas, 100);
        }
    }, [step, initCanvas]);

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        isDrawingRef.current = true;
        const ctx = canvas.getContext('2d')!;
        ctx.strokeStyle = '#d4af37';
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    }, []);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    }, []);

    const endDraw = useCallback(() => {
        isDrawingRef.current = false;
        const canvas = canvasRef.current;
        if (canvas) {
            setSignatureData(canvas.toDataURL('image/png'));
        }
    }, []);

    const clearSignature = useCallback(() => {
        setSignatureData('');
        initCanvas();
    }, [initCanvas]);

    // ── Submit: Completion Protocol ───────────────────────────
    const handleSubmit = useCallback(async () => {
        if (!workOrder || !assignment) return;
        setStep('submitting');

        const crewLead = assignment.crewIds[0] || 0;
        const evidence = {
            workOrderId: workOrder.id,
            photos,
            signatureDataUrl: signatureData,
            jobNotes,
            actualHours,
            completedAt: new Date().toISOString(),
            completedBy: crewLead,
        };

        // Fire the triple-update + get ROI
        const savedAmount = resolveMission(dispatch, evidence);
        setRoiGained(savedAmount);

        await new Promise(r => setTimeout(r, 800));
        setStep('done');
    }, [workOrder, assignment, photos, signatureData, jobNotes, actualHours, dispatch]);

    // ── Step validation ───────────────────────────────────────
    const canProceed = (s: ProtocolStep): boolean => {
        if (s === 'photo') return photos.length >= 1;
        if (s === 'signature') return signatureData.length > 0;
        if (s === 'notes') return actualHours > 0;
        return true;
    };

    // ── Loading / Not Found ───────────────────────────────────
    if (!workOrder || !assignment) {
        return (
            <div className="poc">
                <div className="poc__loading">
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        );
    }

    // ── Protocol Steps ────────────────────────────────────────
    const stepIndicators = [
        { key: 'photo', icon: Camera, en: 'Photo Evidence', ar: 'صور الإنجاز' },
        { key: 'signature', icon: PenTool, en: 'Client Sign-off', ar: 'توقيع العميل' },
        { key: 'notes', icon: FileText, en: 'Job Notes', ar: 'ملاحظات' },
    ];

    return (
        <div className="poc">
            {/* ── Header ──────────────────────────────────── */}
            <div className="poc__header">
                <button className="poc__back" onClick={() => navigate(`/work-orders/${id}/brief`)}>
                    <ArrowLeft size={18} />
                </button>
                <div className="poc__header-info">
                    <h1 className="poc__title">
                        {isAr ? 'بروتوكول الإكمال' : 'Completion Protocol'}
                    </h1>
                    <span className="poc__wo-id">{workOrder.id}</span>
                </div>
            </div>

            {/* ── Step Indicators ──────────────────────────── */}
            {step !== 'done' && step !== 'submitting' && (
                <div className="poc__stepper">
                    {stepIndicators.map((s, i) => (
                        <div key={s.key} className={`poc__step ${step === s.key ? 'poc__step--active' : ''} ${stepIndicators.findIndex(x => x.key === step) > i ? 'poc__step--done' : ''
                            }`}>
                            <div className="poc__step-circle">
                                <s.icon size={14} />
                            </div>
                            <span className="poc__step-label">{isAr ? s.ar : s.en}</span>
                            {i < stepIndicators.length - 1 && <div className="poc__step-line" />}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Step 1: Photo Evidence ───────────────────── */}
            {step === 'photo' && (
                <div className="poc__card glass-panel">
                    <h2 className="poc__card-title">
                        <Camera size={20} />
                        {isAr ? 'الخطوة ١: صور إثبات الإنجاز' : 'Step 1: Photo Evidence'}
                    </h2>
                    <p className="poc__card-desc">
                        {isAr
                            ? 'التقط صورة واحدة على الأقل للعمل المكتمل'
                            : 'Capture at least one photo of the completed work'}
                    </p>

                    <div className="poc__photos-grid">
                        {photos.map((p, i) => (
                            <div key={i} className="poc__photo-thumb">
                                <img src={p} alt={`Evidence ${i + 1}`} />
                                <button className="poc__photo-remove" onClick={() => removePhoto(i)}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        <label className="poc__photo-add">
                            <Upload size={24} />
                            <span>{isAr ? 'إضافة صورة' : 'Add Photo'}</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    <div className="poc__nav">
                        <div />
                        <button
                            className="poc__nav-btn poc__nav-btn--next"
                            disabled={!canProceed('photo')}
                            onClick={() => setStep('signature')}
                        >
                            {isAr ? 'التالي' : 'Next'} →
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Digital Signature ─────────────────── */}
            {step === 'signature' && (
                <div className="poc__card glass-panel">
                    <h2 className="poc__card-title">
                        <PenTool size={20} />
                        {isAr ? 'الخطوة ٢: توقيع العميل' : 'Step 2: Client Sign-off'}
                    </h2>
                    <p className="poc__card-desc">
                        {isAr
                            ? 'اطلب من العميل التوقيع أدناه للتحقق من إنجاز العمل'
                            : 'Have the client sign below to validate completion'}
                    </p>

                    <div className="poc__signature-wrapper">
                        <canvas
                            ref={canvasRef}
                            className="poc__signature-canvas"
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={endDraw}
                            onMouseLeave={endDraw}
                            onTouchStart={startDraw}
                            onTouchMove={draw}
                            onTouchEnd={endDraw}
                        />
                        <div className="poc__signature-actions">
                            <button className="poc__clear-sig" onClick={clearSignature}>
                                <Trash2 size={14} />
                                {isAr ? 'مسح' : 'Clear'}
                            </button>
                        </div>
                    </div>

                    <div className="poc__nav">
                        <button className="poc__nav-btn poc__nav-btn--back" onClick={() => setStep('photo')}>
                            ← {isAr ? 'السابق' : 'Back'}
                        </button>
                        <button
                            className="poc__nav-btn poc__nav-btn--next"
                            disabled={!canProceed('signature')}
                            onClick={() => setStep('notes')}
                        >
                            {isAr ? 'التالي' : 'Next'} →
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Job Notes & Hours ─────────────────── */}
            {step === 'notes' && (
                <div className="poc__card glass-panel">
                    <h2 className="poc__card-title">
                        <FileText size={20} />
                        {isAr ? 'الخطوة ٣: ملاحظات وساعات العمل' : 'Step 3: Job Notes & Hours'}
                    </h2>

                    <div className="poc__field">
                        <label>{isAr ? 'الساعات الفعلية' : 'Actual Hours Worked'}</label>
                        <div className="poc__hours-input">
                            <Clock size={16} />
                            <input
                                type="number"
                                min={0.5}
                                max={24}
                                step={0.5}
                                value={actualHours}
                                onChange={e => setActualHours(parseFloat(e.target.value) || 0)}
                                className="poc__input"
                            />
                            <span className="poc__hours-unit">h</span>
                            <span className="poc__hours-est">
                                {isAr ? `المقدر: ${workOrder.estimatedHours}h` : `Est: ${workOrder.estimatedHours}h`}
                            </span>
                        </div>
                    </div>

                    <div className="poc__field">
                        <label>{isAr ? 'ملاحظات الموقع' : 'Site Anomaly Notes'}</label>
                        <textarea
                            className="poc__textarea"
                            rows={4}
                            value={jobNotes}
                            onChange={e => setJobNotes(e.target.value)}
                            placeholder={isAr
                                ? 'أي ملاحظات أو مشاكل في الموقع...'
                                : 'Any site-specific anomalies or observations...'}
                        />
                    </div>

                    {/* Summary before submit */}
                    <div className="poc__summary">
                        <div className="poc__summary-title">{isAr ? 'ملخص الإنجاز' : 'Completion Summary'}</div>
                        <div className="poc__summary-row">
                            <span>{isAr ? 'الصور' : 'Photos'}</span>
                            <span className="poc__summary-value">{photos.length}</span>
                        </div>
                        <div className="poc__summary-row">
                            <span>{isAr ? 'التوقيع' : 'Signature'}</span>
                            <span className="poc__summary-value poc__summary-value--green">
                                {signatureData ? '✅' : '❌'}
                            </span>
                        </div>
                        <div className="poc__summary-row">
                            <span>{isAr ? 'الخدمة' : 'Service'}</span>
                            <span className="poc__summary-value">
                                {skuInfo ? (isAr ? skuInfo.nameAr : skuInfo.nameEn) : workOrder.sku}
                            </span>
                        </div>
                        <div className="poc__summary-row">
                            <span>{isAr ? 'العميل' : 'Client'}</span>
                            <span className="poc__summary-value">
                                {isAr ? workOrder.customerAr : workOrder.customerEn}
                            </span>
                        </div>
                    </div>

                    <div className="poc__nav">
                        <button className="poc__nav-btn poc__nav-btn--back" onClick={() => setStep('signature')}>
                            ← {isAr ? 'السابق' : 'Back'}
                        </button>
                        <button
                            className="poc__nav-btn poc__nav-btn--submit"
                            disabled={!canProceed('notes')}
                            onClick={handleSubmit}
                        >
                            <CheckCircle2 size={18} />
                            {isAr ? '🚀 إنهاء المهمة' : '🚀 Finish Job'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Submitting ───────────────────────────────── */}
            {step === 'submitting' && (
                <div className="poc__done-screen">
                    <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--jeraisy-gold)' }} />
                    <h2>{isAr ? 'جاري التحديث الثلاثي...' : 'Executing Triple-Update...'}</h2>
                    <p>{isAr ? 'أمر العمل • المركبة • الطاقم' : 'Work Order • Vehicle • Crew'}</p>
                </div>
            )}

            {/* ── Done: ROI Feedback ───────────────────────── */}
            {step === 'done' && (
                <div className="poc__done-screen poc__done-screen--success">
                    <div className="poc__done-icon">
                        <CheckCircle2 size={64} />
                    </div>
                    <h2 className="poc__done-title">
                        {isAr ? 'تم إكمال المهمة بنجاح' : 'Mission Completed Successfully'}
                    </h2>
                    <p className="poc__done-subtitle">
                        {isAr ? 'تم تنفيذ التحديث الثلاثي' : 'Triple-Update executed'}
                    </p>

                    <div className="poc__roi-card glass-panel">
                        <Star size={20} style={{ color: 'var(--jeraisy-gold)' }} />
                        <div>
                            <div className="poc__roi-label">{isAr ? 'مساهمة العائد على الاستثمار' : 'ROI Contribution'}</div>
                            <div className="poc__roi-value">SAR {roiGained.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="poc__done-checklist">
                        <div className="poc__done-check"><CheckCircle2 size={16} /> {isAr ? 'أمر العمل → مكتمل' : 'Work Order → Completed ✓'}</div>
                        <div className="poc__done-check"><CheckCircle2 size={16} /> {isAr ? 'المركبة → متاحة' : 'Vehicle → Available ✓'}</div>
                        <div className="poc__done-check"><CheckCircle2 size={16} /> {isAr ? 'الطاقم → في حالة استعداد' : 'Crew → Idle/Available ✓'}</div>
                        <div className="poc__done-check"><CheckCircle2 size={16} /> {isAr ? 'الساعات → محسوبة' : 'Hours → Finalized ✓'}</div>
                        <div className="poc__done-check"><CheckCircle2 size={16} /> {isAr ? 'الوفورات → محدثة' : 'Savings → Updated ✓'}</div>
                    </div>

                    <div className="poc__done-actions">
                        <button
                            className="poc__done-btn poc__done-btn--summary"
                            onClick={() => navigate(`/work-orders/${id}/summary`)}
                        >
                            <FileText size={16} />
                            {isAr ? 'ملخص المهمة' : 'View Mission Summary'}
                        </button>
                        <button
                            className="poc__done-btn poc__done-btn--home"
                            onClick={() => navigate('/work-orders')}
                        >
                            {isAr ? 'العودة لأوامر العمل' : 'Back to Work Orders'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
