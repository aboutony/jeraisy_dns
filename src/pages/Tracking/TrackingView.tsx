/*
  AXON Phase 5-D: TrackingView.tsx
  Customer-facing live tracking web-view.

  Route: /track/:token
  Access: Public (no admin auth). Token encodes workOrderId + expiry.
  Layout: Mobile-first, lightweight — zero GlobalStore dependency.

  Displays:
    - Installer profile card (name, photo, certification badge)
    - Predictive Narrative chain (current V-Trace status → customer language)
    - Dynamic ETA (TTI-based when in installation, GPS-based when in transit)
    - 'Report a Concern' CTA → AXON Escalation Flow (bypasses general support)
*/

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle2, Clock, MapPin, Shield, AlertTriangle,
    Star, ChevronRight, Loader2, XCircle, BadgeCheck,
} from 'lucide-react';
import {
    decodeTrackingToken,
    deriveTrackingNarrative,
} from '../../services/CustomerNotify';
import type { TrackingNarrative } from '../../services/CustomerNotify';
import type { VTraceRecord } from '../../services/VTraceEngine';
import './TrackingView.css';

// ── Tracking data shape (fetched/injected by the app shell) ──────────────────

export interface TrackingViewData {
    workOrderId: string;
    customerNameEn: string;
    customerNameAr: string;
    siteNameEn: string;
    siteNameAr: string;
    skuNameEn: string;
    skuNameAr: string;
    installerNameEn: string;
    installerNameAr: string;
    installerPhotoUrl: string;
    installerBadgeLabelEn: string;
    installerBadgeLabelAr: string;
    /** 1–5 customer rating if survey completed, else null. */
    surveyRating: number | null;
    /** ISO timestamp of current/latest V-Trace checkpoint. */
    lastCheckpointAt: string;
    /** Estimated minutes remaining (transit or installation). Null = unknown. */
    etaMinutes: number | null;
    /** Snapshot of V-Trace record for narrative derivation. */
    vTraceRecord: VTraceRecord;
    language: 'ar' | 'en';
}

// ── Demo/fallback data loader ─────────────────────────────────────────────────
// In production this is replaced by a GET /track/:token API response.

function useDemoTrackingData(workOrderId: string): {
    data: TrackingViewData | null;
    loading: boolean;
    error: string | null;
} {
    const [data, setData]       = useState<TrackingViewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!workOrderId) {
                setError('Invalid tracking link.');
                setLoading(false);
                return;
            }
            // Stub record — in production replaced by API fetch
            const stubRecord: VTraceRecord = {
                traceId:       `VTR-demo-${workOrderId}`,
                workOrderId,
                supervisorId:  1,
                installerIds:  [42],
                checkpoints: {
                    issued:   { checkpoint: 'issued',   timestamp: new Date(Date.now() - 3600000).toISOString(), actorId: 1, metadata: {} },
                    accepted: { checkpoint: 'accepted', timestamp: new Date(Date.now() - 1800000).toISOString(), actorId: 42,
                                gpsCoords: { lat: 24.7136, lng: 46.6753 }, metadata: {} },
                },
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                status: 'active',
            };

            const demoData: TrackingViewData = {
                workOrderId,
                customerNameEn:      'Al-Rajhi Residence',
                customerNameAr:      'مقر الراجحي',
                siteNameEn:          'Al-Malqa Villa — Riyadh',
                siteNameAr:          'فيلا الملقا — الرياض',
                skuNameEn:           'Luxury Kitchen Pro',
                skuNameAr:           'مطبخ فاخر برو',
                installerNameEn:     'Mohammed Al-Qahtani',
                installerNameAr:     'محمد القحطاني',
                installerPhotoUrl:   '',
                installerBadgeLabelEn: 'Master Installer — Valid until June 2027',
                installerBadgeLabelAr: 'مركِّب خبير — صالح حتى يونيو 2027',
                surveyRating:        null,
                lastCheckpointAt:    stubRecord.checkpoints['accepted']!.timestamp,
                etaMinutes:          22,
                vTraceRecord:        stubRecord,
                language:            'en',
            };
            setData(demoData);
            setLoading(false);
        }, 900);
        return () => clearTimeout(timer);
    }, [workOrderId]);

    return { data, loading, error };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InstallerCard({ data }: { data: TrackingViewData }) {
    const isAr = data.language === 'ar';
    return (
        <div className="tv-installer-card">
            <div className="tv-installer-card__avatar">
                {data.installerPhotoUrl
                    ? <img src={data.installerPhotoUrl} alt="installer" className="tv-installer-card__photo" />
                    : <div className="tv-installer-card__avatar-placeholder">
                        {(isAr ? data.installerNameAr : data.installerNameEn).charAt(0)}
                      </div>
                }
                <div className="tv-installer-card__badge-dot" title="Verified">
                    <BadgeCheck size={16} />
                </div>
            </div>
            <div className="tv-installer-card__info">
                <p className="tv-installer-card__name">
                    {isAr ? data.installerNameAr : data.installerNameEn}
                </p>
                <p className="tv-installer-card__badge">
                    <Shield size={13} />
                    {isAr ? data.installerBadgeLabelAr : data.installerBadgeLabelEn}
                </p>
            </div>
        </div>
    );
}

function ProgressBar({ percent }: { percent: number }) {
    return (
        <div className="tv-progress">
            <div className="tv-progress__track">
                <div
                    className="tv-progress__fill"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="tv-progress__label">{percent}%</span>
        </div>
    );
}

function CheckpointTimeline({ narrative }: { narrative: TrackingNarrative }) {
    const steps: Array<{ pct: number; label: string }> = [
        { pct: 15,  label: 'Assigned' },
        { pct: 30,  label: 'En Route' },
        { pct: 55,  label: 'On Site' },
        { pct: 65,  label: 'Installing' },
        { pct: 80,  label: 'QC Check' },
        { pct: 100, label: 'Complete' },
    ];
    return (
        <div className="tv-timeline">
            {steps.map(s => {
                const done    = narrative.progressPercent >= s.pct;
                const current = narrative.progressPercent < s.pct &&
                                narrative.progressPercent >= (s.pct - 25);
                return (
                    <div
                        key={s.label}
                        className={[
                            'tv-timeline__step',
                            done    ? 'tv-timeline__step--done'    : '',
                            current ? 'tv-timeline__step--current' : '',
                        ].join(' ').trim()}
                    >
                        <div className="tv-timeline__dot">
                            {done && <CheckCircle2 size={14} />}
                        </div>
                        <span className="tv-timeline__label">{s.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

function EtaBadge({ minutes, isComplete }: { minutes: number | null; isComplete: boolean }) {
    if (isComplete) {
        return (
            <div className="tv-eta tv-eta--complete">
                <CheckCircle2 size={18} />
                <span>Installation Complete</span>
            </div>
        );
    }
    if (minutes === null) {
        return (
            <div className="tv-eta tv-eta--unknown">
                <Clock size={18} />
                <span>ETA calculating…</span>
            </div>
        );
    }
    return (
        <div className="tv-eta">
            <Clock size={18} />
            <span>
                {minutes < 60
                    ? `~${minutes} min away`
                    : `~${Math.round(minutes / 60)}h away`}
            </span>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrackingView() {
    const { token } = useParams<{ token: string }>();

    // Decode token → workOrderId
    const tokenPayload = useMemo(() => {
        if (!token) return null;
        return decodeTrackingToken(token);
    }, [token]);

    const { data, loading, error } = useDemoTrackingData(
        tokenPayload?.workOrderId ?? ''
    );

    const narrative = useMemo(
        () => data ? deriveTrackingNarrative(data.vTraceRecord) : null,
        [data]
    );

    const isAr = data?.language === 'ar';

    // ── Token invalid / expired ───────────────────────────────────────────────
    if (!tokenPayload) {
        return (
            <div className="tv-root tv-root--error">
                <XCircle size={48} className="tv-error-icon" />
                <h1 className="tv-error-title">Invalid or Expired Link</h1>
                <p className="tv-error-body">
                    This tracking link has expired or is invalid. Please contact AXON support.
                </p>
            </div>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="tv-root tv-root--loading">
                <div className="tv-spinner">
                    <Loader2 size={36} />
                </div>
                <p className="tv-loading-text">Loading your tracking info…</p>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error || !data || !narrative) {
        return (
            <div className="tv-root tv-root--error">
                <AlertTriangle size={48} className="tv-error-icon" />
                <h1 className="tv-error-title">Tracking Unavailable</h1>
                <p className="tv-error-body">{error ?? 'Unable to load tracking data.'}</p>
            </div>
        );
    }

    const handleReportConcern = () => {
        // Route to AXON Escalation Flow — bypasses general support queue.
        // In production: POST /escalations/new?workOrderId=...&source=tracking
        const escalationUrl = `/support/escalate?wo=${data.workOrderId}&source=tracking&token=${token}`;
        window.location.href = escalationUrl;
    };

    return (
        <div className={`tv-root${isAr ? ' tv-root--rtl' : ''}`}>

            {/* ── Brand header ──────────────────────────────────────────── */}
            <header className="tv-header">
                <div className="tv-header__logo">AXON</div>
                <div className="tv-header__tagline">
                    {isAr ? 'تتبع التركيب المباشر' : 'Live Installation Tracking'}
                </div>
            </header>

            {/* ── Narrative hero ────────────────────────────────────────── */}
            <section className="tv-hero">
                <h1 className="tv-hero__headline">
                    {isAr ? narrative.headlineAr : narrative.headlineEn}
                </h1>
                <p className="tv-hero__subline">
                    {isAr ? narrative.sublineAr : narrative.sublineEn}
                </p>
                <EtaBadge minutes={data.etaMinutes} isComplete={narrative.isComplete} />
                <ProgressBar percent={narrative.progressPercent} />
            </section>

            {/* ── Checkpoint timeline ───────────────────────────────────── */}
            <section className="tv-section">
                <h2 className="tv-section__title">
                    {isAr ? 'مراحل التركيب' : 'Installation Progress'}
                </h2>
                <CheckpointTimeline narrative={narrative} />
            </section>

            {/* ── Installer profile card ────────────────────────────────── */}
            <section className="tv-section">
                <h2 className="tv-section__title">
                    {isAr ? 'المركِّب المعين' : 'Your Installer'}
                </h2>
                <InstallerCard data={data} />
            </section>

            {/* ── Job summary ───────────────────────────────────────────── */}
            <section className="tv-section tv-summary">
                <div className="tv-summary__row">
                    <MapPin size={16} className="tv-summary__icon" />
                    <div>
                        <span className="tv-summary__label">
                            {isAr ? 'الموقع' : 'Site'}
                        </span>
                        <span className="tv-summary__value">
                            {isAr ? data.siteNameAr : data.siteNameEn}
                        </span>
                    </div>
                </div>
                <div className="tv-summary__row">
                    <Shield size={16} className="tv-summary__icon" />
                    <div>
                        <span className="tv-summary__label">
                            {isAr ? 'الخدمة' : 'Service'}
                        </span>
                        <span className="tv-summary__value">
                            {isAr ? data.skuNameAr : data.skuNameEn}
                        </span>
                    </div>
                </div>
                {data.surveyRating !== null && (
                    <div className="tv-summary__row">
                        <Star size={16} className="tv-summary__icon tv-summary__icon--gold" />
                        <div>
                            <span className="tv-summary__label">
                                {isAr ? 'تقييمك' : 'Your Rating'}
                            </span>
                            <span className="tv-summary__value tv-summary__value--gold">
                                {'★'.repeat(data.surveyRating)}{'☆'.repeat(5 - data.surveyRating)}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Report a Concern CTA ──────────────────────────────────── */}
            {!narrative.isComplete && (
                <section className="tv-section">
                    <button
                        className="tv-concern-btn"
                        onClick={handleReportConcern}
                        aria-label="Report a concern"
                    >
                        <AlertTriangle size={18} />
                        <span>{isAr ? 'الإبلاغ عن مشكلة' : 'Report a Concern'}</span>
                        <ChevronRight size={18} className="tv-concern-btn__arrow" />
                    </button>
                    <p className="tv-concern-note">
                        {isAr
                            ? 'يصل مباشرة إلى فريق الإشراف الميداني لدى AXON — لا يمر عبر خدمة العملاء العامة.'
                            : 'Routes directly to the AXON Field Supervision team — bypasses general support.'}
                    </p>
                </section>
            )}

            {/* ── Footer ───────────────────────────────────────────────── */}
            <footer className="tv-footer">
                <p className="tv-footer__ref">
                    {isAr ? 'رقم الطلب' : 'Order Ref'}: {data.workOrderId}
                </p>
                <p className="tv-footer__brand">
                    {isAr ? 'مدعوم من AXON — تنسيق التميز الميداني' : 'Powered by AXON — Orchestrating Field Excellence'}
                </p>
            </footer>
        </div>
    );
}
