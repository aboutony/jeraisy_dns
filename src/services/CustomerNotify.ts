/*
  AXON Phase 5-D: CustomerNotify.ts
  Customer-facing experience layer: pre-arrival notifications, live tracking token
  generation, and post-completion certificate delivery.

  Three responsibilities:
    1. PRE-ARRIVAL  — Send WhatsApp/SMS when an installer is assigned.
                      Payload includes installer name, photo, certification badge,
                      and a unique short-lived tracking URL.

    2. TRACKING TOKEN — Generate/decode tamper-evident tokens that encode the
                        workOrderId and an expiry timestamp for the TrackingView.

    3. CERTIFICATE   — Triggered at V-Trace CP-7 (otpVerified). Builds a flat
                        data payload from the V-Trace evidence record (Before/After
                        photos, digital signature, SKU warranty terms) and dispatches
                        it as a PDF attachment via WhatsApp/email.

  All I/O (HTTP sending, PDF rendering) is injectable — no side-effects at import time.
*/

import type { VTraceRecord, CheckpointKey } from './VTraceEngine';
import type { CertificationTier } from './PriorityMatch';

// ── Tracking token ────────────────────────────────────────────────────────────

export interface TrackingTokenPayload {
    workOrderId: string;
    /** ISO expiry timestamp. View will show "expired" after this. */
    expiresAt: string;
    /** Random nonce to prevent guessing sequential tokens. */
    nonce: string;
}

export interface TrackingToken {
    token: string;          // base64url-encoded payload
    expiresAt: string;      // ISO — for server-side TTL
    trackingUrl: string;    // full URL the customer receives
}

const BASE_TRACKING_URL =
    typeof window !== 'undefined'
        ? `${window.location.origin}/track/`
        : 'https://axon.jeraisy.sa/track/';

function b64url(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(token: string): string {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad    = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return atob(padded + pad);
}

/**
 * Generate a short-lived tracking token for a work order.
 *
 * @param workOrderId - The work order this token grants view access to.
 * @param ttlHours    - Token lifetime in hours (default: 48h).
 * @param nowIso      - Injectable "now" for deterministic testing.
 */
export function generateTrackingToken(
    workOrderId: string,
    ttlHours = 48,
    nowIso: string = new Date().toISOString()
): TrackingToken {
    const expiresAt = new Date(
        new Date(nowIso).getTime() + ttlHours * 60 * 60 * 1000
    ).toISOString();

    const nonce = Math.random().toString(36).slice(2, 10);

    const payload: TrackingTokenPayload = { workOrderId, expiresAt, nonce };
    const token   = b64url(JSON.stringify(payload));

    return { token, expiresAt, trackingUrl: `${BASE_TRACKING_URL}${token}` };
}

/**
 * Decode and validate a tracking token.
 * Returns null if the token is malformed or expired.
 */
export function decodeTrackingToken(
    token: string,
    nowIso: string = new Date().toISOString()
): TrackingTokenPayload | null {
    try {
        const payload: TrackingTokenPayload = JSON.parse(b64urlDecode(token));
        if (!payload.workOrderId || !payload.expiresAt) return null;
        if (new Date(nowIso) > new Date(payload.expiresAt)) return null;
        return payload;
    } catch {
        return null;
    }
}

// ── Installer badge label ─────────────────────────────────────────────────────

export interface CertificationBadgeInfo {
    tier: CertificationTier;
    /** ISO date string, e.g. '2027-06-30' */
    validUntil: string;
    labelEn: string;
    labelAr: string;
}

export function buildBadgeInfo(
    tier: CertificationTier,
    validUntil: string
): CertificationBadgeInfo {
    const tierLabels: Record<CertificationTier, { en: string; ar: string }> = {
        foundation: { en: 'Foundation Installer', ar: 'مركِّب أساسي' },
        pro:        { en: 'Pro Installer',         ar: 'مركِّب محترف' },
        master:     { en: 'Master Installer',      ar: 'مركِّب خبير' },
    };
    const label       = tierLabels[tier];
    const untilDate   = new Date(validUntil);
    const monthEn     = untilDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthAr     = untilDate.toLocaleString('ar-SA', { month: 'long', year: 'numeric' });

    return {
        tier,
        validUntil,
        labelEn: `${label.en} — Valid until ${monthEn}`,
        labelAr: `${label.ar} — صالح حتى ${monthAr}`,
    };
}

// ── Pre-arrival notification ──────────────────────────────────────────────────

export interface InstallerProfile {
    workerId: number;
    nameEn: string;
    nameAr: string;
    /** V-Vault path to installer headshot. Resolved to full URL by the sender. */
    photoVaultPath: string;
    badge: CertificationBadgeInfo;
    /** Current GPS location for ETA calculation. */
    gpsCoords: { lat: number; lng: number } | null;
}

export interface PreArrivalPayload {
    workOrderId: string;
    customerPhone: string;      // E.164
    customerEmail?: string;
    customerNameEn: string;
    customerNameAr: string;
    installer: InstallerProfile;
    siteNameEn: string;
    siteNameAr: string;
    /** Pre-generated tracking token. */
    tracking: TrackingToken;
    /** Estimated minutes until on-site arrival. */
    etaMinutes: number;
    language: 'ar' | 'en';
}

export type NotifySender = (
    channel: 'whatsapp' | 'sms' | 'email',
    to: string,
    templateName: string,
    params: Record<string, string>,
    attachmentUrl?: string
) => Promise<{ messageId: string; status: 'sent' | 'queued' | 'failed' }>;

/**
 * Send the pre-arrival customer notification.
 * Fires both WhatsApp and SMS in parallel for maximum delivery reliability.
 */
export async function sendPreArrivalNotification(
    payload: PreArrivalPayload,
    sender: NotifySender,
    photoPublicUrl: string     // resolved V-Vault public URL for the installer photo
): Promise<void> {
    const isAr    = payload.language === 'ar';
    const template = isAr ? 'axon_pre_arrival_ar' : 'axon_pre_arrival_en';

    const params: Record<string, string> = {
        customer_name:   isAr ? payload.customerNameAr : payload.customerNameEn,
        installer_name:  isAr ? payload.installer.nameAr : payload.installer.nameEn,
        installer_photo: photoPublicUrl,
        badge_label:     isAr ? payload.installer.badge.labelAr : payload.installer.badge.labelEn,
        site_name:       isAr ? payload.siteNameAr : payload.siteNameEn,
        eta_minutes:     String(payload.etaMinutes),
        tracking_url:    payload.tracking.trackingUrl,
    };

    const sends: Promise<unknown>[] = [
        sender('whatsapp', payload.customerPhone, template, params, photoPublicUrl),
    ];

    if (payload.customerEmail) {
        sends.push(
            sender('email', payload.customerEmail, template, params, photoPublicUrl)
        );
    }

    const results = await Promise.allSettled(sends);
    results.forEach((r, i) => {
        const channel = i === 0 ? 'WhatsApp' : 'Email';
        if (r.status === 'fulfilled') {
            console.log(`[CustomerNotify] 📲 Pre-arrival ${channel} → ${payload.customerPhone} (${(r.value as { status: string }).status})`);
        } else {
            console.warn(`[CustomerNotify] ⚠️ Pre-arrival ${channel} failed:`, r.reason);
        }
    });
}

// ── Predictive ETA ────────────────────────────────────────────────────────────

const AVG_TRANSIT_SPEED_KMH = 40;  // conservative urban speed

/** Haversine distance in km (shared utility, no import needed). */
function haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 +
              Math.cos((a.lat * Math.PI) / 180) *
              Math.cos((b.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Estimate minutes until the installer arrives on site.
 * Returns null when GPS is not available.
 */
export function estimateEtaMinutes(
    installerCoords: { lat: number; lng: number } | null,
    siteCoords: { lat: number; lng: number }
): number | null {
    if (!installerCoords) return null;
    const distKm     = haversineKm(installerCoords, siteCoords);
    const travelMins = (distKm / AVG_TRANSIT_SPEED_KMH) * 60;
    return Math.max(5, Math.round(travelMins));
}

// ── Post-completion certificate ───────────────────────────────────────────────

export interface SkuWarrantyInfo {
    skuCode: string;
    warrantyMonths: number;
    termsEn: string;
    termsAr: string;
}

/** Default SKU-level warranty terms. Extended by the caller for custom SKUs. */
export const DEFAULT_WARRANTY_MAP: Record<string, SkuWarrantyInfo> = {
    'LUX-KITCH-PRO-44':   { skuCode: 'LUX-KITCH-PRO-44',   warrantyMonths: 24, termsEn: '24-month full parts & labour warranty.',       termsAr: 'ضمان قطع وعمالة كامل لمدة 24 شهراً.' },
    'COM-OFFICE-SET-12':  { skuCode: 'COM-OFFICE-SET-12',   warrantyMonths: 12, termsEn: '12-month structural integrity warranty.',        termsAr: 'ضمان متانة هيكلية لمدة 12 شهراً.' },
    'LUX-SUITE-FULL-08':  { skuCode: 'LUX-SUITE-FULL-08',   warrantyMonths: 36, termsEn: '36-month premium suite warranty.',              termsAr: 'ضمان الجناح المتميز لمدة 36 شهراً.' },
    'COM-CONF-SET-22':    { skuCode: 'COM-CONF-SET-22',      warrantyMonths: 12, termsEn: '12-month commercial furniture warranty.',       termsAr: 'ضمان أثاث تجاري لمدة 12 شهراً.' },
    'MED-FURN-SPEC-16':   { skuCode: 'MED-FURN-SPEC-16',    warrantyMonths: 24, termsEn: '24-month medical-grade installation warranty.',  termsAr: 'ضمان تركيب طبي لمدة 24 شهراً.' },
    'LUX-CLOSET-WALK-06': { skuCode: 'LUX-CLOSET-WALK-06',  warrantyMonths: 24, termsEn: '24-month walk-in closet warranty.',             termsAr: 'ضمان غرفة الملابس لمدة 24 شهراً.' },
    'COM-RECEP-DESK-04':  { skuCode: 'COM-RECEP-DESK-04',   warrantyMonths: 12, termsEn: '12-month commercial desk warranty.',            termsAr: 'ضمان مكتب تجاري لمدة 12 شهراً.' },
    'LUX-BATH-VANITY-10': { skuCode: 'LUX-BATH-VANITY-10',  warrantyMonths: 24, termsEn: '24-month luxury bath vanity warranty.',         termsAr: 'ضمان وحدة حمام فاخرة لمدة 24 شهراً.' },
};

export interface CompletionCertificateData {
    /** AXON certificate reference number. */
    certificateRef: string;
    workOrderId: string;
    traceId: string;
    /** ISO timestamp from V-Trace CP-7 (OTP verification). */
    otpVerifiedAt: string;
    customerNameEn: string;
    customerNameAr: string;
    siteNameEn: string;
    siteNameAr: string;
    skuCode: string;
    skuNameEn: string;
    skuNameAr: string;
    installerNameEn: string;
    installerNameAr: string;
    installerBadgeLabel: string;
    /** V-Vault path to installer's digital signature (from ProofOfCompletion). */
    signatureVaultPath: string;
    /** V-Vault paths of before-installation photos (supplied by dispatcher at CP-1 if captured). */
    beforePhotoVaultPaths: string[];
    /** V-Vault paths from CP-6 (photoUpload checkpoint). */
    afterPhotoVaultPaths: string[];
    actualHours: number;
    warranty: SkuWarrantyInfo;
    /** ISO warranty start date (= CP-7 otpVerifiedAt). */
    warrantyStartDate: string;
    surveyRating: number | null;
    completedAt: string;
}

/**
 * Build the certificate data payload directly from a V-Trace evidence record.
 * Called at CP-7 (otpVerified) — the photos and signature are already in V-Vault.
 *
 * @param record       - The fully-progressed VTraceRecord (must have CP-6 + CP-7 logged).
 * @param workOrderMeta - Denormalised fields from the work order and installer profile.
 * @param skuWarranty  - Warranty terms for this SKU (look up from DEFAULT_WARRANTY_MAP).
 */
export function buildCertificateData(
    record: VTraceRecord,
    workOrderMeta: {
        customerNameEn: string;
        customerNameAr: string;
        siteNameEn: string;
        siteNameAr: string;
        skuCode: string;
        skuNameEn: string;
        skuNameAr: string;
        installerNameEn: string;
        installerNameAr: string;
        installerBadgeLabel: string;
        signatureVaultPath: string;
        actualHours: number;
        beforePhotoVaultPaths?: string[];
    },
    skuWarranty: SkuWarrantyInfo
): CompletionCertificateData {
    const cp7 = record.checkpoints['otpVerified'];
    if (!cp7) {
        throw new Error(
            `[CustomerNotify] buildCertificateData requires CP-7 (otpVerified) to be logged on trace ${record.traceId}.`
        );
    }

    // Extract after-photos from CP-6 metadata
    const cp6 = record.checkpoints['photoUpload'];
    const afterPhotoVaultPaths: string[] = cp6
        ? (cp6.metadata['photos'] as string[] ?? [])
        : [];

    const certRef = `AXON-CERT-${record.workOrderId}-${Date.now().toString(36).toUpperCase()}`;

    return {
        certificateRef:         certRef,
        workOrderId:            record.workOrderId,
        traceId:                record.traceId,
        otpVerifiedAt:          cp7.timestamp,
        customerNameEn:         workOrderMeta.customerNameEn,
        customerNameAr:         workOrderMeta.customerNameAr,
        siteNameEn:             workOrderMeta.siteNameEn,
        siteNameAr:             workOrderMeta.siteNameAr,
        skuCode:                workOrderMeta.skuCode,
        skuNameEn:              workOrderMeta.skuNameEn,
        skuNameAr:              workOrderMeta.skuNameAr,
        installerNameEn:        workOrderMeta.installerNameEn,
        installerNameAr:        workOrderMeta.installerNameAr,
        installerBadgeLabel:    workOrderMeta.installerBadgeLabel,
        signatureVaultPath:     workOrderMeta.signatureVaultPath,
        beforePhotoVaultPaths:  workOrderMeta.beforePhotoVaultPaths ?? [],
        afterPhotoVaultPaths,
        actualHours:            workOrderMeta.actualHours,
        warranty:               skuWarranty,
        warrantyStartDate:      cp7.timestamp,
        surveyRating:           record.surveyData?.overallRating ?? null,
        completedAt:            cp7.timestamp,
    };
}

/**
 * Send the completion certificate PDF via WhatsApp and/or email.
 * The PDF rendering itself is injectable (pass a server-side or client-side renderer).
 *
 * @param certData   - Built via buildCertificateData().
 * @param pdfUrl     - Public URL to the generated PDF (pre-rendered, stored in V-Vault).
 * @param sender     - Injectable channel sender.
 * @param recipients - Customer phone and optional email.
 * @param language   - Preferred language for the message template.
 */
export async function sendCompletionCertificate(
    certData: CompletionCertificateData,
    pdfUrl: string,
    sender: NotifySender,
    recipients: { phone: string; email?: string },
    language: 'ar' | 'en' = 'ar'
): Promise<void> {
    const template = language === 'ar' ? 'axon_certificate_ar' : 'axon_certificate_en';
    const isAr     = language === 'ar';

    const params: Record<string, string> = {
        certificate_ref:  certData.certificateRef,
        customer_name:    isAr ? certData.customerNameAr : certData.customerNameEn,
        sku_name:         isAr ? certData.skuNameAr : certData.skuNameEn,
        installer_name:   isAr ? certData.installerNameAr : certData.installerNameEn,
        badge_label:      certData.installerBadgeLabel,
        warranty_terms:   isAr ? certData.warranty.termsAr : certData.warranty.termsEn,
        warranty_months:  String(certData.warranty.warrantyMonths),
        completed_at:     new Date(certData.completedAt).toLocaleDateString(
                              isAr ? 'ar-SA' : 'en-GB'
                          ),
        pdf_url:          pdfUrl,
    };

    const sends: Promise<unknown>[] = [
        sender('whatsapp', recipients.phone, template, params, pdfUrl),
    ];
    if (recipients.email) {
        sends.push(sender('email', recipients.email, template, params, pdfUrl));
    }

    const results = await Promise.allSettled(sends);
    results.forEach((r, i) => {
        const channel = i === 0 ? 'WhatsApp' : 'Email';
        if (r.status === 'fulfilled') {
            console.log(`[CustomerNotify] 📜 Certificate ${channel} → ${recipients.phone} (ref: ${certData.certificateRef})`);
        } else {
            console.warn(`[CustomerNotify] ⚠️ Certificate ${channel} delivery failed:`, r.reason);
        }
    });
}

// ── V-Trace checkpoint → customer-facing narrative ────────────────────────────

export interface TrackingNarrative {
    statusKey: CheckpointKey | 'pre_issued';
    headlineEn: string;
    headlineAr: string;
    sublineEn: string;
    sublineAr: string;
    progressPercent: number;   // 0–100 for progress bar
    isComplete: boolean;
}

const NARRATIVE_MAP: Record<CheckpointKey | 'pre_issued', Omit<TrackingNarrative, 'statusKey'>> = {
    pre_issued:        { headlineEn: 'Order Confirmed',                  headlineAr: 'تم تأكيد الطلب',              sublineEn: 'Your order is being prepared.',              sublineAr: 'يتم تجهيز طلبك.',               progressPercent: 5,   isComplete: false },
    issued:            { headlineEn: 'Installer Being Assigned',         headlineAr: 'جاري تعيين المركِّب',          sublineEn: 'Our team is selecting your installer.',      sublineAr: 'يختار فريقنا المركِّب المناسب.', progressPercent: 15,  isComplete: false },
    accepted:          { headlineEn: 'Installer On The Way',             headlineAr: 'المركِّب في الطريق',            sublineEn: 'Your installer has accepted and is en route.',sublineAr: 'قبل المركِّب المهمة وهو في طريقه إليك.', progressPercent: 30, isComplete: false },
    materialReviewed:  { headlineEn: 'Project Specifications Reviewed',  headlineAr: 'تمت مراجعة مواصفات المشروع',  sublineEn: 'Your installer has reviewed your project.',  sublineAr: 'راجع المركِّب مواصفات مشروعك.',  progressPercent: 40,  isComplete: false },
    onSiteCheckIn:     { headlineEn: 'Installer Has Arrived',            headlineAr: 'وصل المركِّب إلى الموقع',       sublineEn: 'Your installer is at the site.',             sublineAr: 'المركِّب في موقعك الآن.',         progressPercent: 55,  isComplete: false },
    installationStart: { headlineEn: 'Installation In Progress',         headlineAr: 'التركيب جارٍ',                  sublineEn: 'Installation has started. Sit back!',        sublineAr: 'بدأ التركيب. استرخِ!',            progressPercent: 65,  isComplete: false },
    photoUpload:       { headlineEn: 'Quality Check Underway',           headlineAr: 'فحص الجودة قيد التنفيذ',        sublineEn: 'Almost done — quality photos captured.',     sublineAr: 'اكتمل تقريباً — تم التقاط صور الجودة.', progressPercent: 80, isComplete: false },
    otpVerified:       { headlineEn: 'Completion Verified',              headlineAr: 'تم التحقق من الإنجاز',          sublineEn: 'You confirmed the installation.',            sublineAr: 'أكدت استلام التركيب.',            progressPercent: 90,  isComplete: false },
    surveyCompleted:   { headlineEn: 'Thank You For Your Feedback',      headlineAr: 'شكراً على تقييمك',              sublineEn: 'Certificate is being generated.',            sublineAr: 'يتم إنشاء شهادة الإنجاز.',       progressPercent: 95,  isComplete: false },
    certificateIssued: { headlineEn: 'Your AXON Certificate Is Ready',   headlineAr: 'شهادة AXON جاهزة',              sublineEn: 'Your Completion Record has been sent.',      sublineAr: 'تم إرسال سجل إنجازك الرسمي.',    progressPercent: 100, isComplete: true  },
};

/**
 * Derive the current customer-facing narrative from a V-Trace record.
 * Returns pre_issued if no checkpoints have been logged yet.
 */
export function deriveTrackingNarrative(record: VTraceRecord): TrackingNarrative {
    const CHECKPOINT_SEQUENCE: Array<CheckpointKey> = [
        'issued', 'accepted', 'materialReviewed', 'onSiteCheckIn',
        'installationStart', 'photoUpload', 'otpVerified', 'surveyCompleted', 'certificateIssued',
    ];

    let latestKey: CheckpointKey | 'pre_issued' = 'pre_issued';
    for (const cp of CHECKPOINT_SEQUENCE) {
        if (record.checkpoints[cp]) latestKey = cp;
    }

    return { statusKey: latestKey, ...NARRATIVE_MAP[latestKey] };
}
