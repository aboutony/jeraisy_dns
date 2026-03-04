import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Camera, WifiOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import OracleConnector from '../../services/OracleConnector';
import SyncQueue from '../../services/SyncQueue';
import './PunchClock.css';

// ── Geofence: 50-meter precision per production spec ──────────
const GEOFENCE_RADIUS_KM = parseFloat(import.meta.env.VITE_GEOFENCE_RADIUS_KM || '0.05');

const SITES = {
    riyadh: { lat: 24.7136, lng: 46.6753, radiusKm: GEOFENCE_RADIUS_KM },
    jeddah: { lat: 21.4858, lng: 39.1925, radiusKm: GEOFENCE_RADIUS_KM },
};

type GPSStatus = 'checking' | 'verified' | 'outside';

function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
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

// ── Demo Worker ID (simulates logged-in worker) ───────────────
const DEMO_WORKER_ID = 1000;

export default function PunchClock() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state, punchIn, punchOut } = useGlobalStore();

    const [gpsStatus, setGpsStatus] = useState<GPSStatus>('checking');
    const [matchedSite, setMatchedSite] = useState<'riyadh' | 'jeddah' | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [punchingState, setPunchingState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

    // Find the current worker from global state
    const currentWorker = state.workers.find((w) => w.id === DEMO_WORKER_ID);
    const isPunchedIn = currentWorker?.punchedIn || false;
    const isOnline = state.connection.online;
    const otLimit = state.thresholds.overtimeHoursLimit;

    // GPS Check — 50m precision enforcement
    useEffect(() => {
        const timer = setTimeout(() => {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setCoords({ lat: latitude, lng: longitude });

                        for (const [key, site] of Object.entries(SITES)) {
                            const dist = haversineDistance(latitude, longitude, site.lat, site.lng);
                            if (dist <= site.radiusKm) {
                                setGpsStatus('verified');
                                setMatchedSite(key as 'riyadh' | 'jeddah');
                                return;
                            }
                        }
                        setGpsStatus('outside');
                    },
                    () => {
                        // Demo fallback: simulate Riyadh geofence match
                        setCoords({ lat: 24.7136, lng: 46.6753 });
                        setGpsStatus('verified');
                        setMatchedSite('riyadh');
                    }
                );
            } else {
                // Fallback demo
                setCoords({ lat: 24.7136, lng: 46.6753 });
                setGpsStatus('verified');
                setMatchedSite('riyadh');
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // Timer: count up while punched in
    useEffect(() => {
        if (!isPunchedIn) {
            setElapsed(0);
            return;
        }
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, [isPunchedIn]);

    const formatTime = useCallback((seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    const handlePunch = async () => {
        if (!coords || !matchedSite) return;
        setPunchingState('syncing');

        try {
            if (isPunchedIn) {
                // ── END TASK ─────────────────────────────────────
                punchOut(DEMO_WORKER_ID, matchedSite, coords);

                // Immediately trigger Oracle API call
                await OracleConnector.syncWorkOrder(
                    currentWorker?.assignedWorkOrder || 'WO-2026-002',
                    { status: 'inProgress', actualHours: currentWorker?.hoursWorked || 0 }
                );
                console.log('[PunchClock] ✅ End Task → Oracle sync triggered');

                // Queue offline if needed
                if (!isOnline) {
                    await SyncQueue.enqueue(
                        `/work-orders/${currentWorker?.assignedWorkOrder}/sync`,
                        'POST',
                        {
                            workerId: DEMO_WORKER_ID,
                            type: 'punch-out',
                            timestamp: new Date().toISOString(),
                            site: matchedSite,
                            coords,
                        }
                    );
                }
            } else {
                // ── START TASK ────────────────────────────────────
                if (currentWorker && currentWorker.hoursWorked >= otLimit) {
                    setPunchingState('error');
                    setTimeout(() => setPunchingState('idle'), 2000);
                    return; // Blocked — overtime guardrail
                }

                punchIn(DEMO_WORKER_ID, matchedSite, coords, 'WO-2026-002');

                // Immediately trigger Oracle API call
                await OracleConnector.syncWorkOrder('WO-2026-002', {
                    status: 'inProgress',
                    actualHours: currentWorker?.hoursWorked || 0,
                });
                console.log('[PunchClock] ✅ Start Task → Oracle sync triggered');

                // Queue offline if needed
                if (!isOnline) {
                    await SyncQueue.enqueue(
                        '/punch-events',
                        'POST',
                        {
                            workerId: DEMO_WORKER_ID,
                            type: 'punch-in',
                            timestamp: new Date().toISOString(),
                            site: matchedSite,
                            coords,
                            workOrderId: 'WO-2026-002',
                        }
                    );
                }
            }
            setPunchingState('success');
        } catch {
            setPunchingState('error');
        }

        setTimeout(() => setPunchingState('idle'), 2000);
    };

    // Check if overtime-blocked
    const isOvertimeBlocked = currentWorker ? currentWorker.hoursWorked >= otLimit : false;

    return (
        <div className="punch-clock">
            <div className="punch-clock__header">
                <h1 className="punch-clock__title">{t('punchClock.title')}</h1>
                <p className="punch-clock__subtitle">{t('punchClock.subtitle')}</p>
            </div>

            {!isOnline && (
                <div className="punch-clock__offline">
                    <WifiOff size={14} style={{ verticalAlign: 'middle', marginInlineEnd: '6px' }} />
                    {t('punchClock.offlineQueued')}
                </div>
            )}

            {/* Overtime Guardrail Alert */}
            {isOvertimeBlocked && (
                <div className="punch-clock__overtime-alert">
                    {t('workforce.overtimeBlocked')}
                </div>
            )}

            {/* GPS Status */}
            <div
                className={`punch-clock__gps ${gpsStatus === 'verified'
                    ? 'punch-clock__gps--verified'
                    : gpsStatus === 'outside'
                        ? 'punch-clock__gps--outside'
                        : ''
                    }`}
            >
                <div
                    className={`punch-clock__gps-icon ${gpsStatus === 'verified'
                        ? 'punch-clock__gps-icon--verified'
                        : gpsStatus === 'outside'
                            ? 'punch-clock__gps-icon--outside'
                            : 'punch-clock__gps-icon--checking'
                        }`}
                >
                    <MapPin size={28} />
                </div>
                <div className="punch-clock__gps-status">
                    {gpsStatus === 'checking' && t('punchClock.gpsChecking')}
                    {gpsStatus === 'verified' && t('punchClock.gpsVerified')}
                    {gpsStatus === 'outside' && t('punchClock.gpsOutside')}
                </div>
                {coords && (
                    <div className="punch-clock__gps-coords">
                        {coords.lat.toFixed(4)}°N, {coords.lng.toFixed(4)}°E
                        <span className="punch-clock__gps-radius">
                            {isAr ? `نطاق: ${GEOFENCE_RADIUS_KM * 1000}م` : `Radius: ${GEOFENCE_RADIUS_KM * 1000}m`}
                        </span>
                    </div>
                )}
                {matchedSite && (
                    <div className="punch-clock__gps-site">
                        <MapPin size={14} />
                        {isAr
                            ? matchedSite === 'riyadh' ? 'مصنع الرياض' : 'مصنع جدة'
                            : matchedSite === 'riyadh' ? 'Riyadh Facility' : 'Jeddah Facility'}
                    </div>
                )}
            </div>

            {/* Current Task */}
            <div className="punch-clock__task">
                <div className="punch-clock__task-title">{t('punchClock.taskDetails')}</div>
                <div className="punch-clock__task-row">
                    <span className="punch-clock__task-label">
                        {isAr ? 'أمر العمل' : 'Work Order'}
                    </span>
                    <span className="punch-clock__task-value">WO-2026-002</span>
                </div>
                <div className="punch-clock__task-row">
                    <span className="punch-clock__task-label">
                        {isAr ? 'العميل' : 'Client'}
                    </span>
                    <span className="punch-clock__task-value">
                        {isAr ? 'شركة دار الأركان' : 'Dar Al-Arkan Co.'}
                    </span>
                </div>
                <div className="punch-clock__task-row">
                    <span className="punch-clock__task-label">
                        {isAr ? 'المنتج' : 'SKU'}
                    </span>
                    <span className="punch-clock__task-value">COM-OFFICE-SET-12</span>
                </div>
                <div className="punch-clock__task-row">
                    <span className="punch-clock__task-label">{t('punchClock.currentSite')}</span>
                    <span className="punch-clock__task-value">
                        {isAr ? 'مشروع النرجس - الرياض' : 'Al-Narjis - Riyadh'}
                    </span>
                </div>
                {currentWorker && (
                    <div className="punch-clock__task-row">
                        <span className="punch-clock__task-label">
                            {isAr ? 'الساعات هذا الأسبوع' : 'Hours This Week'}
                        </span>
                        <span className={`punch-clock__task-value ${currentWorker.hoursWorked >= 38 ? 'punch-clock__task-value--danger' : ''}`}>
                            {currentWorker.hoursWorked}h / {currentWorker.weeklyLimit}h
                        </span>
                    </div>
                )}
            </div>

            {/* Timer */}
            <div className="punch-clock__timer">
                <div className="punch-clock__timer-display">{formatTime(elapsed)}</div>
                <div className="punch-clock__timer-label">{t('punchClock.elapsedTime')}</div>
            </div>

            {/* Punch Button */}
            <div className="punch-clock__action">
                <button
                    className={`punch-clock__btn ${isPunchedIn ? 'punch-clock__btn--end' : 'punch-clock__btn--start'} ${punchingState === 'syncing' ? 'punch-clock__btn--syncing' : ''}`}
                    onClick={handlePunch}
                    disabled={gpsStatus !== 'verified' || isOvertimeBlocked || punchingState === 'syncing'}
                >
                    {punchingState === 'syncing' ? (
                        <>
                            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                            {isAr ? 'مزامنة مع Oracle...' : 'Syncing with Oracle...'}
                        </>
                    ) : punchingState === 'success' ? (
                        <>
                            <CheckCircle2 size={22} />
                            {isAr ? '✅ تم بنجاح' : '✅ Synced!'}
                        </>
                    ) : punchingState === 'error' ? (
                        <>
                            <XCircle size={22} />
                            {isAr ? '❌ فشل المزامنة' : '❌ Sync Failed'}
                        </>
                    ) : isPunchedIn ? (
                        <>
                            <Clock size={22} />
                            {t('punchClock.punchOut')}
                        </>
                    ) : (
                        <>
                            <Clock size={22} />
                            {t('punchClock.punchIn')}
                        </>
                    )}
                </button>
            </div>

            {/* Photo Upload */}
            <div className="punch-clock__upload">
                <div className="punch-clock__upload-icon">
                    <Camera size={32} color="var(--text-muted)" />
                </div>
                <div className="punch-clock__upload-text">{t('punchClock.uploadPhoto')}</div>
            </div>
        </div>
    );
}
