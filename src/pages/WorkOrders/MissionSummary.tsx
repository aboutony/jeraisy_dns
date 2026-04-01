import { useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, FileText, Clock, Users, Truck,
    CheckCircle2, Star, Camera, PenTool, Printer,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import OracleConnector from '../../services/OracleConnector';
import './MissionSummary.css';

export default function MissionSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();
    const printRef = useRef<HTMLDivElement>(null);

    const workOrder = useMemo(
        () => state.workOrders.find(wo => wo.id === id),
        [state.workOrders, id],
    );
    const assignment = useMemo(
        () => state.missionAssignments.find(m => m.workOrderId === id),
        [state.missionAssignments, id],
    );
    const evidence = useMemo(
        () => state.completedMissions.find(e => e.workOrderId === id),
        [state.completedMissions, id],
    );
    const crewMembers = useMemo(
        () => (assignment?.crewIds || []).map(cid => state.workers.find(w => w.id === cid)).filter(Boolean),
        [state.workers, assignment],
    );
    const vehicle = useMemo(
        () => assignment?.vehicleId ? state.vehicles.find(v => v.id === assignment.vehicleId) : null,
        [state.vehicles, assignment],
    );
    const skuInfo = useMemo(
        () => OracleConnector.getSkuLaborMap().find(s => s.sku === workOrder?.sku),
        [workOrder],
    );

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    if (!workOrder || !assignment) {
        return (
            <div className="msummary">
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    {isAr ? 'المهمة غير موجودة' : 'Mission not found'}
                </p>
            </div>
        );
    }

    const laborCost = evidence ? Math.round(evidence.actualHours * 65) : 0;
    const roiContrib = evidence ? Math.round(evidence.actualHours * 65 * 0.20 + 350 * 0.15) : 0;

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="msummary">
            {/* ── Header (non-print) ───────────────────────── */}
            <div className="msummary__header no-print">
                <button className="msummary__back" onClick={() => navigate('/work-orders')}>
                    <ArrowLeft size={18} />
                </button>
                <div className="msummary__header-info">
                    <h1 className="msummary__page-title">
                        {isAr ? 'ملخص المهمة' : 'Mission Summary'}
                    </h1>
                    <span className="msummary__wo-id">{workOrder.id}</span>
                </div>
                <button className="msummary__print-btn" onClick={handlePrint}>
                    <Printer size={16} />
                    {isAr ? 'طباعة PDF' : 'Print / PDF'}
                </button>
            </div>

            {/* ── Printable Report ─────────────────────────── */}
            <div className="msummary__report" ref={printRef}>
                {/* Logo Row */}
                <div className="msummary__brand">
                    <div className="msummary__brand-logo">AXON</div>
                    <div className="msummary__brand-subtitle">
                        {isAr ? 'تقرير إكمال المهمة' : 'Mission Completion Report'}
                    </div>
                </div>

                {/* Title */}
                <div className="msummary__report-title">
                    <FileText size={20} />
                    <span>{workOrder.id}</span>
                    <span className="msummary__completed-badge">
                        <CheckCircle2 size={14} />
                        {isAr ? 'مكتمل' : 'Completed'}
                    </span>
                </div>

                {/* Timeline */}
                <div className="msummary__timeline glass-panel">
                    <h3 className="msummary__section-title">
                        <Clock size={16} />
                        {isAr ? 'الجدول الزمني' : 'Timeline'}
                    </h3>
                    <div className="msummary__timeline-steps">
                        <div className="msummary__timeline-step">
                            <div className="msummary__timeline-dot msummary__timeline-dot--gold" />
                            <div>
                                <div className="msummary__timeline-label">{isAr ? 'تم الإنشاء' : 'Created'}</div>
                                <div className="msummary__timeline-date">{formatDate(assignment.assignedAt)}</div>
                            </div>
                        </div>
                        {assignment.respondedAt && (
                            <div className="msummary__timeline-step">
                                <div className="msummary__timeline-dot msummary__timeline-dot--blue" />
                                <div>
                                    <div className="msummary__timeline-label">{isAr ? 'تم القبول' : 'Accepted'}</div>
                                    <div className="msummary__timeline-date">{formatDate(assignment.respondedAt)}</div>
                                </div>
                            </div>
                        )}
                        {evidence && (
                            <div className="msummary__timeline-step">
                                <div className="msummary__timeline-dot msummary__timeline-dot--green" />
                                <div>
                                    <div className="msummary__timeline-label">{isAr ? 'تم الإكمال' : 'Completed'}</div>
                                    <div className="msummary__timeline-date">{formatDate(evidence.completedAt)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Job Details */}
                <div className="msummary__details glass-panel">
                    <h3 className="msummary__section-title">
                        <FileText size={16} />
                        {isAr ? 'تفاصيل المهمة' : 'Job Details'}
                    </h3>
                    <div className="msummary__grid">
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'العميل' : 'Client'}</span>
                            <span className="msummary__value">{isAr ? workOrder.customerAr : workOrder.customerEn}</span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'الخدمة' : 'Service'}</span>
                            <span className="msummary__value msummary__value--gold">
                                {skuInfo ? (isAr ? skuInfo.nameAr : skuInfo.nameEn) : workOrder.sku}
                            </span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'الفرع' : 'Branch'}</span>
                            <span className="msummary__value">{assignment.branchCode}</span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'الموقع' : 'Site'}</span>
                            <span className="msummary__value">{isAr ? workOrder.siteAr : workOrder.siteEn}</span>
                        </div>
                    </div>
                </div>

                {/* Resources */}
                <div className="msummary__resources glass-panel">
                    <h3 className="msummary__section-title">
                        <Users size={16} />
                        {isAr ? 'الموارد' : 'Resources'}
                    </h3>
                    {vehicle && (
                        <div className="msummary__resource-row">
                            <Truck size={16} />
                            <span className="msummary__resource-id">{vehicle.id}</span>
                            <span className="msummary__resource-desc">
                                {isAr ? vehicle.typeAr : vehicle.typeEn}
                            </span>
                        </div>
                    )}
                    <div className="msummary__crew">
                        {crewMembers.map(w => w && (
                            <span key={w.id} className="msummary__crew-chip">
                                {isAr ? w.nameAr : w.nameEn}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Hours & Cost */}
                <div className="msummary__financials glass-panel">
                    <h3 className="msummary__section-title">
                        <Star size={16} />
                        {isAr ? 'المالية والأداء' : 'Financial & Performance'}
                    </h3>
                    <div className="msummary__grid">
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'الساعات المقدرة' : 'Estimated Hours'}</span>
                            <span className="msummary__value">{workOrder.estimatedHours}h</span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'الساعات الفعلية' : 'Actual Hours'}</span>
                            <span className="msummary__value msummary__value--gold">
                                {evidence?.actualHours || '—'}h
                            </span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'تكلفة العمالة' : 'Labor Cost'}</span>
                            <span className="msummary__value">SAR {laborCost.toLocaleString()}</span>
                        </div>
                        <div className="msummary__item">
                            <span className="msummary__label">{isAr ? 'مساهمة الوفورات' : 'ROI Contribution'}</span>
                            <span className="msummary__value msummary__value--green">SAR {roiContrib.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Evidence */}
                {evidence && (
                    <div className="msummary__evidence glass-panel">
                        <h3 className="msummary__section-title">
                            <Camera size={16} />
                            {isAr ? 'أدلة الإنجاز' : 'Completion Evidence'}
                        </h3>
                        {evidence.photos.length > 0 && (
                            <div className="msummary__photos">
                                {evidence.photos.map((p, i) => (
                                    <img key={i} src={p} alt={`Evidence ${i + 1}`} className="msummary__photo" />
                                ))}
                            </div>
                        )}

                        {evidence.jobNotes && (
                            <div className="msummary__notes">
                                <span className="msummary__label">{isAr ? 'ملاحظات الفني' : 'Technician Notes'}</span>
                                <p className="msummary__notes-text">{evidence.jobNotes}</p>
                            </div>
                        )}

                        {evidence.signatureDataUrl && (
                            <div className="msummary__signature-block">
                                <div className="msummary__sig-label">
                                    <PenTool size={14} />
                                    {isAr ? 'توقيع العميل' : 'Client Signature'}
                                </div>
                                <img src={evidence.signatureDataUrl} alt="Client Signature" className="msummary__sig-img" />
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="msummary__footer">
                    <div>{isAr ? 'AXON — تنسيق التميز الميداني' : 'AXON — Orchestrating Field Excellence'}</div>
                    <div>{isAr ? 'تقرير آلي — سري' : 'Auto-generated report — Confidential'}</div>
                </div>
            </div>
        </div>
    );
}
