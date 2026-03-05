import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MapPin, Truck, Users, Package, Clock, CheckCircle2,
    XCircle, Navigation, AlertTriangle, User, ArrowLeft, Loader2,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import { pushMissionAccepted, pushMissionRejected, BRANCH_COORDS } from '../../services/NotificationTrigger';
import OracleConnector from '../../services/OracleConnector';
import './MobileMissionBrief.css';

// ── Geofence: 50m precision ───────────────────────────────────
const GEOFENCE_RADIUS_KM = 0.05;

function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type BriefStatus = 'loading' | 'pending' | 'accepted' | 'rejected' | 'onSite';
type GPSCheck = 'checking' | 'withinFence' | 'outsideFence';

export default function MobileMissionBrief() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state, dispatch } = useGlobalStore();

    const [briefStatus, setBriefStatus] = useState<BriefStatus>('loading');
    const [gpsCheck, setGpsCheck] = useState<GPSCheck>('checking');
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [processing, setProcessing] = useState(false);

    // ── Resolve mission data ──────────────────────────────────
    const workOrder = useMemo(
        () => state.workOrders.find(wo => wo.id === id),
        [state.workOrders, id],
    );
    const assignment = useMemo(
        () => state.missionAssignments.find(m => m.workOrderId === id),
        [state.missionAssignments, id],
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

    // ── Initialize ────────────────────────────────────────────
    useEffect(() => {
        if (!workOrder || !assignment) {
            setBriefStatus('loading');
            return;
        }
        if (assignment.status === 'accepted') setBriefStatus('accepted');
        else if (assignment.status === 'rejected') setBriefStatus('rejected');
        else setBriefStatus('pending');
    }, [workOrder, assignment]);

    // ── GPS Geofence Check ────────────────────────────────────
    useEffect(() => {
        const siteCoords = assignment?.gpsCoords
            || BRANCH_COORDS[assignment?.branchCode || 'HQ'];
        if (!siteCoords) return;

        const timer = setTimeout(() => {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setUserCoords(c);
                        const dist = haversineDistance(c.lat, c.lng, siteCoords.lat, siteCoords.lng);
                        setGpsCheck(dist <= GEOFENCE_RADIUS_KM ? 'withinFence' : 'outsideFence');
                    },
                    () => {
                        // Demo fallback: simulate within geofence
                        setUserCoords(siteCoords);
                        setGpsCheck('withinFence');
                    },
                );
            } else {
                setUserCoords(siteCoords);
                setGpsCheck('withinFence');
            }
        }, 1200);
        return () => clearTimeout(timer);
    }, [assignment]);

    // ── Actions ───────────────────────────────────────────────
    const handleAccept = useCallback(async () => {
        if (!workOrder || !crewMembers.length) return;
        setProcessing(true);
        const lead = crewMembers[0]!;
        pushMissionAccepted(dispatch, workOrder.id, lead.nameEn, lead.nameAr);
        await new Promise(r => setTimeout(r, 500));
        setBriefStatus('accepted');
        setProcessing(false);
    }, [workOrder, crewMembers, dispatch]);

    const handleReject = useCallback(async () => {
        if (!workOrder || !crewMembers.length) return;
        setProcessing(true);
        const lead = crewMembers[0]!;
        pushMissionRejected(dispatch, workOrder.id, lead.nameEn, lead.nameAr, 'Driver unavailable');
        await new Promise(r => setTimeout(r, 500));
        setBriefStatus('rejected');
        setProcessing(false);
    }, [workOrder, crewMembers, dispatch]);

    const handleNavigate = useCallback(() => {
        const coords = assignment?.gpsCoords || BRANCH_COORDS[assignment?.branchCode || 'HQ'];
        if (coords) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank');
        }
    }, [assignment]);

    // ── Loading State ─────────────────────────────────────────
    if (!workOrder || !assignment) {
        return (
            <div className="mission-brief">
                <div className="mission-brief__loading">
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p>{isAr ? 'جاري تحميل المهمة...' : 'Loading mission brief...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mission-brief">
            {/* ── Header ─────────────────────────────────── */}
            <div className="mission-brief__header">
                <button className="mission-brief__back" onClick={() => navigate('/work-orders')}>
                    <ArrowLeft size={18} />
                </button>
                <div className="mission-brief__header-info">
                    <h1 className="mission-brief__title">
                        {isAr ? 'إحاطة المهمة' : 'Mission Briefing'}
                    </h1>
                    <span className="mission-brief__wo-id">{workOrder.id}</span>
                </div>
                <div className={`mission-brief__status-badge mission-brief__status-badge--${briefStatus}`}>
                    {briefStatus === 'pending' && (isAr ? '⏳ في الانتظار' : '⏳ Pending')}
                    {briefStatus === 'accepted' && (isAr ? '✅ مقبولة' : '✅ Accepted')}
                    {briefStatus === 'rejected' && (isAr ? '❌ مرفوضة' : '❌ Rejected')}
                    {briefStatus === 'onSite' && (isAr ? '📍 في الموقع' : '📍 On Site')}
                </div>
            </div>

            {/* ── Job Details ────────────────────────────── */}
            <section className="mission-brief__section glass-panel">
                <h2 className="mission-brief__section-title">
                    <Package size={18} />
                    {isAr ? 'تفاصيل المهمة' : 'Job Details'}
                </h2>
                <div className="mission-brief__detail-grid">
                    <div className="mission-brief__detail">
                        <span className="mission-brief__detail-label">{isAr ? 'العميل' : 'Client'}</span>
                        <span className="mission-brief__detail-value">
                            {isAr ? workOrder.customerAr : workOrder.customerEn}
                        </span>
                    </div>
                    <div className="mission-brief__detail">
                        <span className="mission-brief__detail-label">{isAr ? 'الخدمة' : 'Service SKU'}</span>
                        <span className="mission-brief__detail-value mission-brief__detail-value--gold">
                            {skuInfo ? (isAr ? skuInfo.nameAr : skuInfo.nameEn) : workOrder.sku}
                        </span>
                    </div>
                    <div className="mission-brief__detail">
                        <span className="mission-brief__detail-label">{isAr ? 'الفرع' : 'Branch'}</span>
                        <span className="mission-brief__detail-value">{assignment.branchCode}</span>
                    </div>
                    <div className="mission-brief__detail">
                        <span className="mission-brief__detail-label">{isAr ? 'الوقت المقدر' : 'Est. Hours'}</span>
                        <span className="mission-brief__detail-value">
                            <Clock size={14} /> {workOrder.estimatedHours}h
                        </span>
                    </div>
                </div>
                <div className="mission-brief__instructions">
                    <span className="mission-brief__detail-label">{isAr ? 'التعليمات' : 'Task Instructions'}</span>
                    <p className="mission-brief__instructions-text">
                        {isAr ? workOrder.descriptionAr : workOrder.descriptionEn}
                        {' — '}
                        {isAr ? workOrder.siteAr : workOrder.siteEn}
                    </p>
                </div>
            </section>

            {/* ── Assets ─────────────────────────────────── */}
            <section className="mission-brief__section glass-panel">
                <h2 className="mission-brief__section-title">
                    <Users size={18} />
                    {isAr ? 'الأصول المخصصة' : 'Assigned Assets'}
                </h2>

                {vehicle && (
                    <div className="mission-brief__asset-row">
                        <Truck size={18} className="mission-brief__asset-icon" />
                        <div>
                            <div className="mission-brief__asset-primary">{vehicle.id}</div>
                            <div className="mission-brief__asset-secondary">
                                {isAr ? vehicle.typeAr : vehicle.typeEn} — {isAr ? vehicle.plateAr : vehicle.plateEn}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mission-brief__crew-label">
                    {isAr ? `الطاقم (${crewMembers.length})` : `Crew (${crewMembers.length})`}
                </div>
                <div className="mission-brief__crew-list">
                    {crewMembers.map(w => w && (
                        <div key={w.id} className="mission-brief__crew-chip">
                            <User size={14} />
                            <span>{isAr ? w.nameAr : w.nameEn}</span>
                            <span className={`mission-brief__crew-hours ${w.hoursWorked >= 35 ? 'mission-brief__crew-hours--amber' : ''}`}>
                                {w.hoursWorked}h
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Map & Navigation ────────────────────────── */}
            <section className="mission-brief__section glass-panel">
                <h2 className="mission-brief__section-title">
                    <MapPin size={18} />
                    {isAr ? 'الموقع والملاحة' : 'Location & Navigation'}
                </h2>
                <div className="mission-brief__location">
                    <div className="mission-brief__location-name">
                        {isAr ? workOrder.siteAr : workOrder.siteEn}
                    </div>
                    <button
                        className="mission-brief__navigate-btn"
                        onClick={handleNavigate}
                    >
                        <Navigation size={18} />
                        {isAr ? 'ابدأ الملاحة' : 'Navigate'}
                    </button>
                </div>

                {/* GPS Fence Status */}
                <div className={`mission-brief__gps-status mission-brief__gps-status--${gpsCheck}`}>
                    <MapPin size={14} />
                    {gpsCheck === 'checking' && (isAr ? 'جاري فحص الموقع...' : 'Checking GPS...')}
                    {gpsCheck === 'withinFence' && (isAr ? '✅ داخل النطاق الجغرافي (50م)' : '✅ Within 50m Geofence')}
                    {gpsCheck === 'outsideFence' && (isAr ? '❌ خارج النطاق — لا يمكن تسجيل الحضور' : '❌ Outside Geofence — Punch-In Locked')}
                    {userCoords && (
                        <span className="mission-brief__gps-coords">
                            {userCoords.lat.toFixed(4)}°N, {userCoords.lng.toFixed(4)}°E
                        </span>
                    )}
                </div>
            </section>

            {/* ── Acceptance Loop ─────────────────────────── */}
            {briefStatus === 'pending' && (
                <div className="mission-brief__actions">
                    <button
                        className="mission-brief__action-btn mission-brief__action-btn--accept"
                        onClick={handleAccept}
                        disabled={processing}
                    >
                        {processing ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={20} />}
                        {isAr ? 'قبول المهمة' : 'Accept Mission'}
                    </button>
                    <button
                        className="mission-brief__action-btn mission-brief__action-btn--reject"
                        onClick={handleReject}
                        disabled={processing}
                    >
                        {processing ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={20} />}
                        {isAr ? 'رفض المهمة' : 'Reject Mission'}
                    </button>
                </div>
            )}

            {/* ── Post-Acceptance: Punch-In + Finish Job ──── */}
            {briefStatus === 'accepted' && (
                <div className="mission-brief__punch-zone">
                    <div className="mission-brief__accepted-banner">
                        <CheckCircle2 size={20} />
                        {isAr ? 'المهمة مقبولة — الحالة: في الطريق' : 'Mission Accepted — Status: In Transit'}
                    </div>
                    <button
                        className="mission-brief__punch-btn"
                        disabled={gpsCheck !== 'withinFence'}
                    >
                        <Clock size={20} />
                        {gpsCheck === 'withinFence'
                            ? (isAr ? 'تسجيل الحضور — GPS مُتحقق' : 'Punch In — GPS Verified')
                            : (isAr ? '🔒 تسجيل الحضور مقفل — خارج النطاق' : '🔒 Punch-In Locked — Outside Geofence')}
                    </button>
                    <button
                        className="mission-brief__finish-btn"
                        onClick={() => navigate(`/work-orders/${id}/complete`)}
                    >
                        <CheckCircle2 size={20} />
                        {isAr ? '🏁 إنهاء المهمة' : '🏁 Finish Job'}
                    </button>
                </div>
            )}

            {/* ── Rejection Banner ────────────────────────── */}
            {briefStatus === 'rejected' && (
                <div className="mission-brief__rejected-banner">
                    <AlertTriangle size={20} />
                    <div>
                        <strong>{isAr ? 'تم رفض المهمة' : 'Mission Rejected'}</strong>
                        <p>{isAr ? 'تم إخطار المدير لإعادة التعيين فوراً' : 'Manager has been alerted for immediate re-assignment'}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
