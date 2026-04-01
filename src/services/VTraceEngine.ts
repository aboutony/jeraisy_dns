/*
  AXON Phase 5-C: VTraceEngine.ts
  Tamper-proof, sequential 9-checkpoint chain of custody for every field mission.

  Checkpoint sequence (must be satisfied in order):
    CP-1  issued            Admin publishes the work order
    CP-2  accepted          Installer accepts; GPS coordinates locked
    CP-3  materialReviewed  JIT knowledge acknowledged (PDF/Video read)  ← Punch-In gate
    CP-4  onSiteCheckIn     GPS-verified arrival at job site
    CP-5  installationStart TTI clock starts
    CP-6  photoUpload       Min. 3 quality photos uploaded
    CP-7  otpVerified       Customer OTP confirmed (SMS/WhatsApp)
    CP-8  surveyCompleted   30-second satisfaction micro-form submitted
    CP-9  certificateIssued Completion certificate generated → PDF routed to V-Vault

  JIT Knowledge Delivery:
    On CP-2 (accepted), trigger AssetPreCache protocol and send WhatsApp deep-link
    to the installer with the product's PDF/Video manual from V-Vault.
    The installer cannot advance to CP-4 (onSiteCheckIn / Punch-In) until
    CP-3 (materialReviewed) flag is TRUE.

  V-Vault routing:
    Photo assets (CP-6) and the completion certificate PDF (CP-9) are pushed
    to V-Vault via the injectable uploadToVault function.
*/

import type { PreCacheAsset } from './AssetPreCache';
import { buildPreCacheJob, executePreCacheCycle } from './AssetPreCache';

// ── Checkpoint definitions ────────────────────────────────────────────────────

export type CheckpointKey =
    | 'issued'
    | 'accepted'
    | 'materialReviewed'
    | 'onSiteCheckIn'
    | 'installationStart'
    | 'photoUpload'
    | 'otpVerified'
    | 'surveyCompleted'
    | 'certificateIssued';

/** Canonical order — index used for sequence validation. */
export const CHECKPOINT_SEQUENCE: CheckpointKey[] = [
    'issued',
    'accepted',
    'materialReviewed',
    'onSiteCheckIn',
    'installationStart',
    'photoUpload',
    'otpVerified',
    'surveyCompleted',
    'certificateIssued',
];

export const CHECKPOINT_LABELS: Record<CheckpointKey, { en: string; ar: string }> = {
    issued:           { en: 'Work Order Issued (Admin)',          ar: 'إصدار أمر العمل (مشرف)' },
    accepted:         { en: 'Accepted — GPS Locked',              ar: 'قبول المهمة — GPS مقفل' },
    materialReviewed: { en: 'Material Reviewed (JIT Ack.)',        ar: 'مراجعة المواد (إقرار JIT)' },
    onSiteCheckIn:    { en: 'On-Site Check-In (GPS Verified)',     ar: 'تسجيل وصول — GPS محدد' },
    installationStart:{ en: 'Installation Start — TTI Clock',     ar: 'بدء التركيب — ساعة TTI' },
    photoUpload:      { en: 'Quality Photo Upload (Min. 3)',       ar: 'رفع الصور (3 على الأقل)' },
    otpVerified:      { en: 'Customer OTP Verified',               ar: 'تحقق OTP من العميل' },
    surveyCompleted:  { en: 'Satisfaction Survey (30 sec)',        ar: 'استبيان الرضا (30 ثانية)' },
    certificateIssued:{ en: 'Completion Certificate → V-Vault',   ar: 'شهادة الإنجاز ← V-Vault' },
};

// ── Core data types ───────────────────────────────────────────────────────────

export interface CheckpointEvent {
    checkpoint: CheckpointKey;
    /** ISO timestamp of the event. */
    timestamp: string;
    /** Worker ID or admin ID who triggered this checkpoint. */
    actorId: number;
    /** GPS fix at the moment of logging. Required for CP-2 and CP-4. */
    gpsCoords?: { lat: number; lng: number };
    /** Checkpoint-specific evidence or metadata (photos, OTP hash, etc.). */
    metadata: Record<string, unknown>;
}

export interface VaultUploadResult {
    vaultPath: string;
    sha256Hash: string;
    uploadedAt: string;
    documentId: string; // UUID from axon_vvault_documents
}

export interface CompletionCertificate {
    vaultPath: string;
    sha256Hash: string;
    issuedAt: string;
    documentId: string;
}

export interface SatisfactionSurveyData {
    overallRating: number;       // 1–5
    installationQuality: number; // 1–5
    staffProfessionalism: number;// 1–5
    comments?: string;
    submittedAt: string;
}

export interface VTraceRecord {
    /** UUID — primary key for this chain of custody record. */
    traceId: string;
    workOrderId: string;
    /** Field supervisor responsible for this mission. */
    supervisorId: number;
    /** All installer IDs assigned to this work order. */
    installerIds: number[];
    /** Ordered map of completed checkpoint events. */
    checkpoints: Partial<Record<CheckpointKey, CheckpointEvent>>;
    /** Set once CP-9 fires. */
    completionCertificate?: CompletionCertificate;
    /** Survey data from CP-8. */
    surveyData?: SatisfactionSurveyData;
    /** ISO timestamp of record creation (CP-1). */
    createdAt: string;
    status: 'active' | 'completed' | 'voided';
}

// ── JIT Knowledge (WhatsApp / App) ────────────────────────────────────────────

export interface JitKnowledgePayload {
    installerId: number;
    /** Installer phone in E.164 format, e.g. +966501234567 */
    phoneNumber: string;
    workOrderId: string;
    skuCode: string;
    /** V-Vault deep-link URL to the PDF/Video manual. */
    manualUrl: string;
    language: 'ar' | 'en';
}

export interface WhatsAppMessageResult {
    messageId: string;
    status: 'sent' | 'queued' | 'failed';
    sentAt: string;
}

/**
 * Injectable WhatsApp sender — accepts any function matching this signature.
 * In production, wire this to the WhatsApp Business API client.
 * In tests, pass a mock that returns a controlled result.
 */
export type WhatsAppSender = (
    to: string,
    templateName: string,
    params: Record<string, string>
) => Promise<WhatsAppMessageResult>;

/**
 * Trigger JIT knowledge delivery on mission acceptance (CP-2).
 * Sends a WhatsApp deep-link to the installer's phone with the
 * product manual URL from V-Vault.
 */
export async function triggerJitKnowledge(
    payload: JitKnowledgePayload,
    sender: WhatsAppSender
): Promise<WhatsAppMessageResult> {
    const templateName = payload.language === 'ar'
        ? 'axon_jit_manual_ar'
        : 'axon_jit_manual_en';

    const params: Record<string, string> = {
        work_order_id: payload.workOrderId,
        sku_code:      payload.skuCode,
        manual_url:    payload.manualUrl,
    };

    const result = await sender(payload.phoneNumber, templateName, params);
    console.log(
        `[VTraceEngine] 📲 JIT WhatsApp → installer ${payload.installerId} ` +
        `(WO: ${payload.workOrderId}) status: ${result.status}`
    );
    return result;
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Returns true if all checkpoints that must precede `target` are already logged.
 */
export function canAdvanceTo(record: VTraceRecord, target: CheckpointKey): boolean {
    const targetIndex = CHECKPOINT_SEQUENCE.indexOf(target);
    if (targetIndex === 0) return true; // CP-1 (issued) is always openable
    for (let i = 0; i < targetIndex; i++) {
        const prior = CHECKPOINT_SEQUENCE[i];
        if (!record.checkpoints[prior]) return false;
    }
    return true;
}

/**
 * Punch-In gate: installer may not punch in until CP-3 (materialReviewed) is logged.
 */
export function isPunchInAllowed(record: VTraceRecord): boolean {
    return !!record.checkpoints['materialReviewed'];
}

/**
 * Photo upload gate: CP-6 requires at least 3 photos in its metadata.
 */
export function hasMinimumPhotos(event: CheckpointEvent): boolean {
    const photos = event.metadata['photos'];
    return Array.isArray(photos) && photos.length >= 3;
}

// ── Record lifecycle ──────────────────────────────────────────────────────────

/** Generate a lightweight UUID-style trace ID. */
function newTraceId(): string {
    const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `VTR-${hex()}-${hex()}-${hex()}-${Date.now().toString(16)}`;
}

/**
 * Initialise a new V-Trace record for a work order.
 * Automatically logs CP-1 (issued) with the admin actor.
 */
export function createVTraceRecord(
    workOrderId: string,
    supervisorId: number,
    installerIds: number[],
    issuedByAdminId: number,
    nowIso: string = new Date().toISOString()
): VTraceRecord {
    const traceId = newTraceId();
    const issuedEvent: CheckpointEvent = {
        checkpoint: 'issued',
        timestamp: nowIso,
        actorId: issuedByAdminId,
        metadata: { action: 'work_order_issued' },
    };

    const record: VTraceRecord = {
        traceId,
        workOrderId,
        supervisorId,
        installerIds,
        checkpoints: { issued: issuedEvent },
        createdAt: nowIso,
        status: 'active',
    };

    console.log(`[VTraceEngine] 🔗 Trace created: ${traceId} → WO ${workOrderId}`);
    return record;
}

/**
 * Log a checkpoint event onto an existing V-Trace record.
 * Enforces sequential ordering and checkpoint-specific validation rules.
 *
 * Returns an updated record copy (immutable pattern — caller stores the result).
 *
 * Throws if:
 *  - The record is not active.
 *  - Prior checkpoints are not yet satisfied.
 *  - CP-6 is attempted with fewer than 3 photos.
 *  - A checkpoint is re-logged (idempotency protection).
 */
export function logCheckpoint(
    record: VTraceRecord,
    event: CheckpointEvent,
    nowIso: string = new Date().toISOString()
): VTraceRecord {
    if (record.status !== 'active') {
        throw new Error(
            `[VTraceEngine] Cannot log checkpoint on ${record.status} trace ${record.traceId}.`
        );
    }

    if (record.checkpoints[event.checkpoint]) {
        throw new Error(
            `[VTraceEngine] Checkpoint '${event.checkpoint}' already logged on trace ${record.traceId}.`
        );
    }

    if (!canAdvanceTo(record, event.checkpoint)) {
        const idx = CHECKPOINT_SEQUENCE.indexOf(event.checkpoint);
        const missing = CHECKPOINT_SEQUENCE[idx - 1];
        throw new Error(
            `[VTraceEngine] Cannot log '${event.checkpoint}' — prior checkpoint '${missing}' is not yet satisfied.`
        );
    }

    // CP-6 guard: minimum 3 quality photos
    if (event.checkpoint === 'photoUpload' && !hasMinimumPhotos(event)) {
        throw new Error(
            `[VTraceEngine] CP-6 photoUpload requires minimum 3 photos in metadata.photos[].`
        );
    }

    // CP-4 guard: must have GPS coords for on-site verification
    if (event.checkpoint === 'onSiteCheckIn' && !event.gpsCoords) {
        throw new Error(
            `[VTraceEngine] CP-4 onSiteCheckIn requires gpsCoords (GPS-verified arrival).`
        );
    }

    // CP-2 guard: GPS required for acceptance lock
    if (event.checkpoint === 'accepted' && !event.gpsCoords) {
        throw new Error(
            `[VTraceEngine] CP-2 accepted requires gpsCoords (GPS locked on acceptance).`
        );
    }

    const updatedEvent: CheckpointEvent = { ...event, timestamp: event.timestamp || nowIso };
    const updatedRecord: VTraceRecord = {
        ...record,
        checkpoints: { ...record.checkpoints, [event.checkpoint]: updatedEvent },
    };

    // Auto-complete the record on CP-9
    if (event.checkpoint === 'certificateIssued') {
        (updatedRecord as VTraceRecord).status = 'completed';
    }

    console.log(
        `[VTraceEngine] ✅ CP logged: ${event.checkpoint} on trace ${record.traceId} ` +
        `(actor: ${event.actorId}, t: ${updatedEvent.timestamp})`
    );
    return updatedRecord;
}

// ── CP-2: Acceptance + AssetPreCache + JIT trigger ────────────────────────────

export interface AcceptancePayload {
    installerId: number;
    gpsCoords: { lat: number; lng: number };
    assets: PreCacheAsset[];
    jitKnowledge: JitKnowledgePayload;
    whatsAppSender: WhatsAppSender;
    downloadFn: (path: string) => Promise<Uint8Array>;
    hashFn: (data: Uint8Array) => string;
}

/**
 * Handle full CP-2 acceptance flow:
 *  1. Log the accepted checkpoint on the V-Trace record.
 *  2. Build and execute the AssetPreCache cycle for offline-first asset availability.
 *  3. Fire JIT knowledge WhatsApp message to the installer.
 *
 * Returns the updated VTraceRecord. The PreCacheJobStatus is logged and discarded
 * here — the caller (mobile app) should separately store the job for canPunchIn() gating.
 */
export async function handleMissionAcceptance(
    record: VTraceRecord,
    payload: AcceptancePayload,
    nowIso: string = new Date().toISOString()
): Promise<VTraceRecord> {
    // Step 1: Log CP-2
    const updatedRecord = logCheckpoint(record, {
        checkpoint: 'accepted',
        timestamp: nowIso,
        actorId: payload.installerId,
        gpsCoords: payload.gpsCoords,
        metadata: { skuCode: payload.jitKnowledge.skuCode },
    });

    // Step 2: AssetPreCache
    const job = buildPreCacheJob(record.workOrderId, payload.installerId, payload.assets);
    const cacheResult = await executePreCacheCycle(job, payload.downloadFn, payload.hashFn);
    console.log(
        `[VTraceEngine] 📦 AssetPreCache: ${cacheResult.downloadedCount}/${cacheResult.totalCount} ` +
        `assets cached, verified: ${cacheResult.cacheVerified}`
    );

    // Step 3: WhatsApp JIT delivery
    await triggerJitKnowledge(payload.jitKnowledge, payload.whatsAppSender);

    return updatedRecord;
}

// ── CP-8: Survey logging helper ───────────────────────────────────────────────

export function logSurveyCheckpoint(
    record: VTraceRecord,
    actorId: number,
    survey: SatisfactionSurveyData
): VTraceRecord {
    const event: CheckpointEvent = {
        checkpoint: 'surveyCompleted',
        timestamp: survey.submittedAt,
        actorId,
        metadata: {
            overallRating:         survey.overallRating,
            installationQuality:   survey.installationQuality,
            staffProfessionalism:  survey.staffProfessionalism,
            comments:              survey.comments ?? '',
        },
    };
    const updated = logCheckpoint(record, event, survey.submittedAt);
    return { ...updated, surveyData: survey };
}

// ── CP-9: Completion certificate → V-Vault ────────────────────────────────────

export interface CertificateGenerationPayload {
    actorId: number;
    /** Raw PDF bytes to be hashed and uploaded. */
    pdfBytes: Uint8Array;
    hashFn: (data: Uint8Array) => string;
    uploadFn: (path: string, data: Uint8Array, meta: Record<string, string>) => Promise<VaultUploadResult>;
}

/**
 * Generate the completion certificate, upload to V-Vault, and log CP-9.
 * Returns the final (status: 'completed') VTraceRecord.
 */
export async function issueCertificate(
    record: VTraceRecord,
    payload: CertificateGenerationPayload,
    nowIso: string = new Date().toISOString()
): Promise<VTraceRecord> {
    const sha256Hash = payload.hashFn(payload.pdfBytes);
    const vaultPath  = `v-vault/certificates/${record.workOrderId}/${record.traceId}.pdf`;

    const uploadResult = await payload.uploadFn(vaultPath, payload.pdfBytes, {
        workOrderId: record.workOrderId,
        traceId:     record.traceId,
        documentType:'completion_certificate',
        sha256Hash,
    });

    const certificate: CompletionCertificate = {
        vaultPath:  uploadResult.vaultPath,
        sha256Hash: uploadResult.sha256Hash,
        issuedAt:   nowIso,
        documentId: uploadResult.documentId,
    };

    const event: CheckpointEvent = {
        checkpoint: 'certificateIssued',
        timestamp: nowIso,
        actorId: payload.actorId,
        metadata: {
            vaultPath:  certificate.vaultPath,
            sha256Hash: certificate.sha256Hash,
            documentId: certificate.documentId,
        },
    };

    const updated = logCheckpoint(record, event, nowIso);
    console.log(
        `[VTraceEngine] 📜 Certificate issued → V-Vault: ${vaultPath} (doc: ${uploadResult.documentId})`
    );
    return { ...updated, completionCertificate: certificate };
}

// ── Photo upload helper (CP-6) ────────────────────────────────────────────────

export interface PhotoUploadPayload {
    actorId: number;
    /** Base64-encoded photo strings (min. 3). */
    photos: string[];
    workOrderId: string;
    hashFn: (data: Uint8Array) => string;
    uploadFn: (path: string, data: Uint8Array, meta: Record<string, string>) => Promise<VaultUploadResult>;
    base64ToUint8: (b64: string) => Uint8Array;
}

/**
 * Upload quality photos to V-Vault and log CP-6.
 * Enforces the 3-photo minimum before any upload is attempted.
 */
export async function handlePhotoUpload(
    record: VTraceRecord,
    payload: PhotoUploadPayload,
    nowIso: string = new Date().toISOString()
): Promise<VTraceRecord> {
    if (payload.photos.length < 3) {
        throw new Error(
            `[VTraceEngine] CP-6 requires at least 3 photos, received ${payload.photos.length}.`
        );
    }

    const vaultRefs: string[] = [];
    for (let i = 0; i < payload.photos.length; i++) {
        const bytes    = payload.base64ToUint8(payload.photos[i]);
        const hash     = payload.hashFn(bytes);
        const path     = `v-vault/photos/${payload.workOrderId}/${record.traceId}/photo-${i + 1}.jpg`;
        const result   = await payload.uploadFn(path, bytes, {
            workOrderId: payload.workOrderId,
            traceId:     record.traceId,
            documentType:'installation_photo',
            sha256Hash:  hash,
            photoIndex:  String(i + 1),
        });
        vaultRefs.push(result.vaultPath);
    }

    const event: CheckpointEvent = {
        checkpoint: 'photoUpload',
        timestamp: nowIso,
        actorId: payload.actorId,
        metadata: { photos: vaultRefs, count: vaultRefs.length },
    };

    return logCheckpoint(record, event, nowIso);
}

// ── Audit helper ──────────────────────────────────────────────────────────────

/** Return the ordered list of completed checkpoints with their timestamps. */
export function getAuditTrail(
    record: VTraceRecord
): Array<{ checkpoint: CheckpointKey; label: string; timestamp: string; actorId: number }> {
    return CHECKPOINT_SEQUENCE
        .filter(cp => !!record.checkpoints[cp])
        .map(cp => {
            const event = record.checkpoints[cp]!;
            return {
                checkpoint: cp,
                label:      CHECKPOINT_LABELS[cp].en,
                timestamp:  event.timestamp,
                actorId:    event.actorId,
            };
        });
}

/** Return the next checkpoint that has not yet been logged, or null if complete. */
export function getNextCheckpoint(record: VTraceRecord): CheckpointKey | null {
    for (const cp of CHECKPOINT_SEQUENCE) {
        if (!record.checkpoints[cp]) return cp;
    }
    return null;
}
