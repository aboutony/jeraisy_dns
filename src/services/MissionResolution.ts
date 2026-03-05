/* ============================================================
   JERAISY DNS — Mission Resolution Service
   Triple-Update logic: WO Complete → Asset Release → Hours Lock
   ============================================================ */

import type {
    GlobalAction,
    CompletionEvidence,
    Notification,
} from '../store/types';

// ── ROI Constants ─────────────────────────────────────────────
const LABOR_COST_PER_HOUR = 65; // SAR avg loaded labor cost
const LOGISTICS_COST_PER_MISSION = 350; // SAR avg logistics overhead

/**
 * Execute the Triple-Update upon mission completion.
 * 1. WO Status → 'completed'
 * 2. Asset Release → vehicle 'available', crew 'idle'
 * 3. Hours Finalization → lock actual hours into compliance ledger
 * 4. ROI → compute and return savings increment
 */
export function resolveMission(
    dispatch: React.Dispatch<GlobalAction>,
    evidence: CompletionEvidence,
): number {
    // ── 1. Store completion evidence & update WO status ────────
    dispatch({ type: 'MISSION_COMPLETED', payload: evidence });

    // ── 2. Finalize hours for each crew member (punch out) ────
    // The MISSION_COMPLETED reducer handles: WO→completed, vehicle→available,
    // workers→idle, mission→completed. This is the "Triple Update".

    // ── 3. Fire completion notification to manager ────────────
    const notification: Notification = {
        id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        titleAr: '✅ تم إكمال المهمة بنجاح',
        titleEn: '✅ Mission Completed Successfully',
        messageAr: `تم إكمال المهمة ${evidence.workOrderId}. الساعات الفعلية: ${evidence.actualHours}h. تم توقيع العميل.`,
        messageEn: `Mission ${evidence.workOrderId} completed. Actual hours: ${evidence.actualHours}h. Client signed off.`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        read: false,
        source: 'mission',
    };
    dispatch({ type: 'NOTIFICATION_ADDED', payload: notification });

    // ── 4. Compute ROI savings contribution ───────────────────
    // recovered = estimated_waste_avoided (labor + logistics)
    const laborRecovered = evidence.actualHours * LABOR_COST_PER_HOUR * 0.20; // 20% recovery
    const logisticsRecovered = LOGISTICS_COST_PER_MISSION * 0.15; // 15% fleet efficiency
    const totalRecovered = Math.round(laborRecovered + logisticsRecovered);

    console.log(`[MissionResolution] ✅ Triple-Update complete for ${evidence.workOrderId}`);
    console.log(`[MissionResolution] 💰 ROI contribution: SAR ${totalRecovered}`);

    return totalRecovered;
}

/**
 * Generate a Mission Summary data object for the PDF/report view.
 */
export interface MissionSummaryData {
    workOrderId: string;
    customerEn: string;
    customerAr: string;
    skuNameEn: string;
    skuNameAr: string;
    branchCode: string;
    siteLocation: string;
    crewNames: { en: string; ar: string }[];
    vehicleId: string | null;
    estimatedHours: number;
    actualHours: number;
    createdAt: string;
    acceptedAt: string | null;
    completedAt: string;
    signatureDataUrl: string;
    photos: string[];
    jobNotes: string;
    laborCostSar: number;
    roiContribution: number;
}

export function buildMissionSummary(
    evidence: CompletionEvidence,
    woData: {
        customerEn: string; customerAr: string;
        skuNameEn: string; skuNameAr: string;
        estimatedHours: number; siteEn: string;
    },
    crewNames: { en: string; ar: string }[],
    vehicleId: string | null,
    branchCode: string,
    assignedAt: string,
    respondedAt: string | null,
): MissionSummaryData {
    const laborCost = Math.round(evidence.actualHours * LABOR_COST_PER_HOUR);
    const roiContribution = Math.round(evidence.actualHours * LABOR_COST_PER_HOUR * 0.20 + LOGISTICS_COST_PER_MISSION * 0.15);

    return {
        workOrderId: evidence.workOrderId,
        customerEn: woData.customerEn,
        customerAr: woData.customerAr,
        skuNameEn: woData.skuNameEn,
        skuNameAr: woData.skuNameAr,
        branchCode,
        siteLocation: woData.siteEn,
        crewNames,
        vehicleId,
        estimatedHours: woData.estimatedHours,
        actualHours: evidence.actualHours,
        createdAt: assignedAt,
        acceptedAt: respondedAt,
        completedAt: evidence.completedAt,
        signatureDataUrl: evidence.signatureDataUrl,
        photos: evidence.photos,
        jobNotes: evidence.jobNotes,
        laborCostSar: laborCost,
        roiContribution,
    };
}

export default {
    resolveMission,
    buildMissionSummary,
};
