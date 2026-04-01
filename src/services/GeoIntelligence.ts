/*
  AXON Phase 5-E: GeoIntelligence.ts
  Regional demand vs. capacity intelligence for KSA operational zones.

  Three responsibilities:

  1. DEMAND vs. CAPACITY HEATMAP
     Per-region metrics: open work order demand, active installer capacity,
     idle cost (SAR), and a utilization ratio. Regions are classified as
     'over-capacity', 'balanced', or 'under-capacity'.

  2. CROSS-REGIONAL DEPLOYMENT RECOMMENDATIONS
     When a region is over-capacity AND another has high Cost-of-Idle,
     auto-generate a deployment recommendation to the Operations Director
     with named idle candidates and estimated cost savings.

  3. STRUCTURED OFFBOARDING FLOW
     Identify installers idle > 60 days who have declined re-training twice.
     Produce an auto-archive record with full accountability trail.

  All functions are pure — injectable data sources, no direct store access.
  SAR figures use the same AVERAGE_DAILY_RATE_SAR constant as CostOfIdleCalculator.ts
  (2100 ÷ 22 ≈ 95.45 SAR/day) to guarantee board-level numerical consistency.
*/

import { AVERAGE_DAILY_RATE_SAR } from './CostOfIdleCalculator';

// ── Region definitions ────────────────────────────────────────────────────────

export type KsaRegion = 'riyadh' | 'jeddah' | 'dammam';

export const REGION_LABELS: Record<KsaRegion, { en: string; ar: string }> = {
    riyadh:  { en: 'Riyadh',  ar: 'الرياض' },
    jeddah:  { en: 'Jeddah',  ar: 'جدة'    },
    dammam:  { en: 'Dammam',  ar: 'الدمام' },
};

/** Approximate region centre-point (used for cross-regional distance estimates). */
export const REGION_COORDS: Record<KsaRegion, { lat: number; lng: number }> = {
    riyadh:  { lat: 24.7136, lng: 46.6753 },
    jeddah:  { lat: 21.4858, lng: 39.1925 },
    dammam:  { lat: 26.3927, lng: 49.9777 },
};

// ── Heatmap types ─────────────────────────────────────────────────────────────

export type RegionStatus = 'overCapacity' | 'balanced' | 'underCapacity';

export interface RegionMetrics {
    region:           KsaRegion;
    /** Open (pending/scheduled/inProgress) work orders in the region. */
    openOrderCount:   number;
    /** Installers available (not assigned, not idle-blocked) in the region. */
    availableCount:   number;
    /** Installers currently idle in the region. */
    idleCount:        number;
    /** Accumulated idle cost for this region (SAR). */
    idleCostSar:      number;
    /**
     * Utilization ratio: openOrderCount / availableCount.
     * > 1.2 → over-capacity, < 0.7 → under-capacity (with idle), else balanced.
     */
    utilizationRatio: number;
    status:           RegionStatus;
}

export interface DemandCapacityHeatmap {
    regions:       RegionMetrics[];
    totalIdleSar:  number;
    generatedAt:   string;
}

// ── Classification thresholds ─────────────────────────────────────────────────

const OVER_CAPACITY_RATIO  = 1.2;
const UNDER_CAPACITY_RATIO = 0.7;

function classifyRegion(ratio: number, idleCount: number): RegionStatus {
    if (ratio > OVER_CAPACITY_RATIO) return 'overCapacity';
    if (ratio < UNDER_CAPACITY_RATIO && idleCount > 0) return 'underCapacity';
    return 'balanced';
}

// ── Heatmap builder ───────────────────────────────────────────────────────────

export interface RegionInput {
    region:         KsaRegion;
    openOrderCount: number;
    availableCount: number;
    idleCount:      number;
    idleDaysList:   number[];   // one entry per idle installer
    dailyRateOverrides?: Map<number, number>; // workerId → SAR/day
}

/**
 * Build the Demand vs. Capacity heatmap from regional input snapshots.
 * Idle cost is computed using the same daily rate formula as CostOfIdleCalculator.
 */
export function buildDemandCapacityHeatmap(
    inputs: RegionInput[],
    nowIso: string = new Date().toISOString()
): DemandCapacityHeatmap {
    const regions: RegionMetrics[] = inputs.map(input => {
        const idleCostSar = input.idleDaysList.reduce(
            (sum, days) => sum + days * AVERAGE_DAILY_RATE_SAR,
            0
        );
        const roundedCost = Math.round(idleCostSar * 100) / 100;

        const ratio = input.availableCount > 0
            ? Math.round((input.openOrderCount / input.availableCount) * 1000) / 1000
            : input.openOrderCount > 0 ? 99 : 0;

        return {
            region:           input.region,
            openOrderCount:   input.openOrderCount,
            availableCount:   input.availableCount,
            idleCount:        input.idleCount,
            idleCostSar:      roundedCost,
            utilizationRatio: ratio,
            status:           classifyRegion(ratio, input.idleCount),
        };
    });

    const totalIdleSar = Math.round(
        regions.reduce((sum, r) => sum + r.idleCostSar, 0) * 100
    ) / 100;

    return { regions, totalIdleSar, generatedAt: nowIso };
}

// ── Cross-regional deployment recommendations ─────────────────────────────────

export interface DeploymentCandidate {
    workerId:    number;
    name:        string;
    homeRegion:  KsaRegion;
    idleDays:    number;
    idleCostSar: number;
    certificationTier: string;
}

export interface CrossRegionalRecommendation {
    /** Region that is short on capacity. */
    targetRegion:       KsaRegion;
    /** Region that has surplus idle installers. */
    sourceRegion:       KsaRegion;
    /** Cost-of-idle in the source region that motivates the move. */
    sourceIdleCostSar:  number;
    /** Estimated cost saving if top N candidates are deployed. */
    estimatedSavingSar: number;
    /** Approximate inter-region travel distance in km (Haversine). */
    distanceKm:         number;
    /** Top candidates recommended for redeployment. */
    candidates:         DeploymentCandidate[];
    /** ISO generation timestamp. */
    generatedAt:        string;
    /** Narrative for the Operations Director notification. */
    narrativeEn:        string;
    narrativeAr:        string;
}

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
    return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

/**
 * Scan the heatmap and generate cross-regional deployment recommendations.
 *
 * Logic:
 *  - For each over-capacity region, find the under-capacity or balanced region
 *    with the highest idle cost.
 *  - If the source region has meaningful idle cost (> threshold), emit a
 *    recommendation with the top deployment candidates.
 *
 * @param heatmap          - Output of buildDemandCapacityHeatmap()
 * @param idleCandidates   - All idle installers with home region
 * @param minIdleCostSar   - Minimum source idle cost to trigger recommendation (default 2000 SAR)
 * @param maxCandidates    - Max candidates to surface per recommendation
 * @param nowIso           - Injectable timestamp
 */
export function generateCrossRegionalRecommendations(
    heatmap: DemandCapacityHeatmap,
    idleCandidates: DeploymentCandidate[],
    minIdleCostSar = 2_000,
    maxCandidates  = 5,
    nowIso: string = new Date().toISOString()
): CrossRegionalRecommendation[] {
    const recommendations: CrossRegionalRecommendation[] = [];

    const overCapacity   = heatmap.regions.filter(r => r.status === 'overCapacity');
    const hasIdleRegions = heatmap.regions
        .filter(r => r.idleCostSar >= minIdleCostSar)
        .sort((a, b) => b.idleCostSar - a.idleCostSar);

    for (const target of overCapacity) {
        // Find best source: most idle cost, different region
        const source = hasIdleRegions.find(r => r.region !== target.region);
        if (!source) continue;

        const candidates = idleCandidates
            .filter(c => c.homeRegion === source.region)
            .sort((a, b) => b.idleCostSar - a.idleCostSar)
            .slice(0, maxCandidates);

        if (candidates.length === 0) continue;

        const estimatedSaving = Math.round(
            candidates.reduce((s, c) => s + c.idleCostSar, 0) * 100
        ) / 100;

        const distKm = haversineKm(
            REGION_COORDS[source.region],
            REGION_COORDS[target.region]
        );

        const sourceLabel  = REGION_LABELS[source.region];
        const targetLabel  = REGION_LABELS[target.region];
        const sarFormatted = `SAR ${estimatedSaving.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`;

        recommendations.push({
            targetRegion:       target.region,
            sourceRegion:       source.region,
            sourceIdleCostSar:  source.idleCostSar,
            estimatedSavingSar: estimatedSaving,
            distanceKm:         distKm,
            candidates,
            generatedAt:        nowIso,
            narrativeEn:
                `AXON Deployment Alert: ${targetLabel.en} is over-capacity ` +
                `(ratio ${target.utilizationRatio}×). ${sourceLabel.en} has ` +
                `${source.idleCount} idle installer(s) with accumulated cost ` +
                `SAR ${source.idleCostSar.toLocaleString('en-SA', { minimumFractionDigits: 2 })}. ` +
                `Deploying top ${candidates.length} candidate(s) recovers ${sarFormatted}.`,
            narrativeAr:
                `تنبيه AXON للنشر: منطقة ${targetLabel.ar} تعاني من زيادة الطلب ` +
                `(نسبة ${target.utilizationRatio}×). تمتلك ${sourceLabel.ar} ` +
                `${source.idleCount} مركِّب(ين) خاملاً بتكلفة متراكمة ` +
                `${source.idleCostSar.toLocaleString('ar-SA')} ر.س. ` +
                `نشر أفضل ${candidates.length} مرشح(ين) يُوفِّر ${sarFormatted}.`,
        });
    }

    return recommendations;
}

// ── Structured offboarding flow ───────────────────────────────────────────────

export type OffboardingTrigger = 'idleThresholdExceeded' | 'retrainingRefused';

export interface OffboardingRecord {
    workerId:              number;
    name:                  string;
    homeRegion:            KsaRegion;
    idleDays:              number;
    accumulatedIdleCostSar: number;
    retrainingDeclineCount: number;
    triggers:              OffboardingTrigger[];
    /** ISO timestamp when the offboarding flow was triggered. */
    triggeredAt:           string;
    /** Auto-generated archive reference. */
    archiveRef:            string;
    statusEn:              string;
    statusAr:              string;
}

/**
 * Identify installers who meet the auto-archive criteria and produce
 * structured offboarding records.
 *
 * Criteria (both must be true):
 *   - Idle for more than IDLE_THRESHOLD_DAYS calendar days
 *   - Declined re-training at least MAX_RETRAIN_DECLINES times
 */
export function triggerOffboardingFlow(
    candidates: Array<{
        workerId: number;
        name: string;
        homeRegion: KsaRegion;
        idleDays: number;
        retrainingDeclineCount: number;
    }>,
    IDLE_THRESHOLD_DAYS  = 60,
    MAX_RETRAIN_DECLINES = 2,
    nowIso: string = new Date().toISOString()
): OffboardingRecord[] {
    const records: OffboardingRecord[] = [];

    for (const c of candidates) {
        const triggers: OffboardingTrigger[] = [];
        if (c.idleDays > IDLE_THRESHOLD_DAYS) triggers.push('idleThresholdExceeded');
        if (c.retrainingDeclineCount >= MAX_RETRAIN_DECLINES) triggers.push('retrainingRefused');

        if (triggers.length < 2) continue; // both criteria must fire

        const accumulatedCost = Math.round(c.idleDays * AVERAGE_DAILY_RATE_SAR * 100) / 100;
        const archiveRef = `AXON-OFB-${c.workerId}-${Date.now().toString(36).toUpperCase()}`;

        records.push({
            workerId:               c.workerId,
            name:                   c.name,
            homeRegion:             c.homeRegion,
            idleDays:               c.idleDays,
            accumulatedIdleCostSar: accumulatedCost,
            retrainingDeclineCount: c.retrainingDeclineCount,
            triggers,
            triggeredAt:            nowIso,
            archiveRef,
            statusEn: `Auto-archive initiated: idle ${c.idleDays} days, declined re-training ${c.retrainingDeclineCount}×.`,
            statusAr: `بدء الأرشفة التلقائية: خامل لمدة ${c.idleDays} يوماً، رفض إعادة التدريب ${c.retrainingDeclineCount} مرات.`,
        });
    }

    return records;
}

// ── Operational intelligence summary ─────────────────────────────────────────
// Single composite object for the Operations Director dashboard.

export interface OperationalIntelligenceSummary {
    heatmap:             DemandCapacityHeatmap;
    deploymentAlerts:    CrossRegionalRecommendation[];
    offboardingPipeline: OffboardingRecord[];
    /** Total SAR recoverable by acting on all deployment recommendations. */
    totalRecoverableSar: number;
    /** Total SAR being burned by offboarding-eligible idle installers. */
    offboardingIdleBurnSar: number;
    generatedAt:         string;
}

export function buildOperationalIntelligence(
    heatmap:             DemandCapacityHeatmap,
    deploymentAlerts:    CrossRegionalRecommendation[],
    offboardingPipeline: OffboardingRecord[],
    nowIso: string = new Date().toISOString()
): OperationalIntelligenceSummary {
    const totalRecoverableSar = Math.round(
        deploymentAlerts.reduce((s, r) => s + r.estimatedSavingSar, 0) * 100
    ) / 100;

    const offboardingIdleBurnSar = Math.round(
        offboardingPipeline.reduce((s, r) => s + r.accumulatedIdleCostSar, 0) * 100
    ) / 100;

    return {
        heatmap,
        deploymentAlerts,
        offboardingPipeline,
        totalRecoverableSar,
        offboardingIdleBurnSar,
        generatedAt: nowIso,
    };
}
