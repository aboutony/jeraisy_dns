/*
  AXON Phase 5-B: PriorityMatch.ts
  Efficiency-First dispatch scoring engine for the 600-person installer pool.

  Scoring weights (sum = 1.0):
    Certification Tier      30%
    TTI Performance         25%
    Customer Rating         25%
    Geo-Proximity           20%

  Hard-blocks (bypass scoring entirely):
    - Conflict-of-Interest: unresolved complaint at target address/order series
    - SKU Complexity ≥ 4:   must be Pro or Master tier

  Soft-cap:
    - Weekly utilization cap per tier (configurable). Saturated installers are
      returned in results but flagged; the caller decides whether to soft-exclude.
*/

import type { DigitalPassport, WorkOrderPriority } from './ZoneConstraintFilter';

// ── Certification Tier ────────────────────────────────────────────────────────

export type CertificationTier = 'foundation' | 'pro' | 'master';

const TIER_WEIGHTS: Record<CertificationTier, number> = {
    foundation: 0.40,
    pro:        0.70,
    master:     1.00,
};

// SKU Complexity Index (1 = trivial, 5 = highly specialised)
export type SkuComplexityIndex = 1 | 2 | 3 | 4 | 5;

// Minimum tier required by complexity
const COMPLEXITY_TIER_GATE: Record<number, CertificationTier> = {
    4: 'pro',
    5: 'master',
};

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface InstallerProfile {
    workerId: number;
    name: string;
    certificationTier: CertificationTier;
    /** Actual TTI value for this SKU (lower = faster, better). Unit: hours. */
    ttiActual: number;
    /** SKU benchmark TTI from axon_passport_tti_benchmarks. Unit: hours. */
    ttiBenchmark: number;
    /** 360° customer feedback average. Range: 0–5. */
    customerRating: number;
    /** Current GPS fix. Null if offline or unavailable. */
    gpsCoords: { lat: number; lng: number } | null;
    /** Number of jobs completed or accepted this calendar week. */
    weeklyJobCount: number;
    /**
     * Order IDs or address fingerprints with unresolved complaints.
     * Populated by the CRM/Oracle complaint feed at scheduling time.
     */
    openComplaints: string[];
    passport: DigitalPassport | null;
}

export interface WorkOrderTarget {
    workOrderId: string;
    skuCode: string;
    skuComplexityIndex: SkuComplexityIndex;
    siteCoords: { lat: number; lng: number };
    orderPriority: WorkOrderPriority;
    /**
     * Normalised address fingerprint used for conflict-of-interest lookup
     * (e.g. "riyadh:olaya-district:building-44").
     */
    addressRef: string;
    /** Optional series tag — blocks installer if they have an open complaint
     *  in the same series (e.g. "KITCH-PRO-44-SERIES"). */
    orderSeries?: string;
}

export interface UtilizationCaps {
    foundation: number; // max jobs/week before saturated
    pro: number;
    master: number;
}

export const DEFAULT_UTILIZATION_CAPS: UtilizationCaps = {
    foundation: 6,
    pro:        6,
    master:     6,
};

export interface ScoreBreakdown {
    certificationScore: number;   // 0–1 (pre-weight)
    ttiScore: number;             // 0–1 (pre-weight)
    customerRatingScore: number;  // 0–1 (pre-weight)
    geoProximityScore: number;    // 0–1 (pre-weight)
    weightedTotal: number;        // 0–100 final score
}

export interface MatchResult {
    installer: InstallerProfile;
    scoreBreakdown: ScoreBreakdown;
    /** Hard-blocked: must not be dispatched. */
    blocked: boolean;
    blockReason?: string;
    /** Soft-cap reached: can still be dispatched but flagged for load balancing. */
    saturated: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHT_CERTIFICATION  = 0.30;
const WEIGHT_TTI            = 0.25;
const WEIGHT_CUSTOMER       = 0.25;
const WEIGHT_GEO            = 0.20;

/**
 * Maximum dispatch radius used to normalise geo-proximity to 0–1.
 * Installers beyond this distance score 0 on proximity (not blocked).
 */
const MAX_DISPATCH_RADIUS_KM = 150;

// ── Scoring helpers ───────────────────────────────────────────────────────────

/** Haversine great-circle distance in kilometres. */
function haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const chord =
        sinDLat * sinDLat +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        sinDLng * sinDLng;
    return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

export function scoreCertification(tier: CertificationTier): number {
    return TIER_WEIGHTS[tier];
}

/**
 * TTI score: benchmark / actual, capped at 1.0.
 * An installer who matches the benchmark exactly scores 1.0.
 * Faster than benchmark scores 1.0 (capped). Slower scores proportionally less.
 * Falls back to 0.5 when no TTI data is available (ttiActual = 0).
 */
export function scoreTTI(ttiActual: number, ttiBenchmark: number): number {
    if (ttiActual <= 0 || ttiBenchmark <= 0) return 0.50;
    return Math.min(1.0, ttiBenchmark / ttiActual);
}

/** Customer rating score: raw rating divided by 5-star maximum. */
export function scoreCustomerRating(rating: number): number {
    if (rating <= 0) return 0;
    return Math.min(1.0, rating / 5.0);
}

/**
 * Geo-proximity score: linear falloff from 1.0 at 0 km to 0.0 at MAX_DISPATCH_RADIUS_KM.
 * Returns 0.5 when GPS is unavailable (penalise but don't hard-block).
 */
export function scoreGeoProximity(
    installerCoords: { lat: number; lng: number } | null,
    siteCoords: { lat: number; lng: number }
): number {
    if (!installerCoords) return 0.50;
    const distKm = haversineKm(installerCoords, siteCoords);
    return Math.max(0, 1 - distKm / MAX_DISPATCH_RADIUS_KM);
}

// ── Conflict-of-Interest check ────────────────────────────────────────────────

/**
 * Returns true if the installer has an open complaint that matches the target
 * order's address fingerprint or order series.
 */
export function hasConflictOfInterest(
    installer: InstallerProfile,
    order: WorkOrderTarget
): boolean {
    if (installer.openComplaints.length === 0) return false;
    for (const complaint of installer.openComplaints) {
        if (complaint === order.addressRef) return true;
        if (order.orderSeries && complaint === order.orderSeries) return true;
    }
    return false;
}

// ── SKU Complexity gate ───────────────────────────────────────────────────────

/**
 * Returns true when the installer's tier satisfies the complexity requirement.
 * Complexity ≥ 4 requires Pro; complexity 5 requires Master.
 */
export function meetsSkuComplexityRequirement(
    tier: CertificationTier,
    complexity: SkuComplexityIndex
): boolean {
    const required = COMPLEXITY_TIER_GATE[complexity];
    if (!required) return true; // complexity 1–3: no tier restriction
    const tierRank: Record<CertificationTier, number> = { foundation: 0, pro: 1, master: 2 };
    return tierRank[tier] >= tierRank[required];
}

// ── Utilization / saturation check ───────────────────────────────────────────

export function isSaturated(
    installer: InstallerProfile,
    caps: UtilizationCaps
): boolean {
    return installer.weeklyJobCount >= caps[installer.certificationTier];
}

// ── Core scoring function ─────────────────────────────────────────────────────

export function scoreInstaller(
    installer: InstallerProfile,
    order: WorkOrderTarget,
    caps: UtilizationCaps = DEFAULT_UTILIZATION_CAPS
): MatchResult {
    // ── Hard-block: Conflict of Interest ─────────────────────────────────────
    if (hasConflictOfInterest(installer, order)) {
        return {
            installer,
            scoreBreakdown: { certificationScore: 0, ttiScore: 0, customerRatingScore: 0, geoProximityScore: 0, weightedTotal: 0 },
            blocked: true,
            blockReason: 'Conflict-of-Interest: unresolved complaint at target address/order series.',
            saturated: false,
        };
    }

    // ── Hard-block: SKU Complexity gate ──────────────────────────────────────
    if (!meetsSkuComplexityRequirement(installer.certificationTier, order.skuComplexityIndex)) {
        const required = COMPLEXITY_TIER_GATE[order.skuComplexityIndex];
        return {
            installer,
            scoreBreakdown: { certificationScore: 0, ttiScore: 0, customerRatingScore: 0, geoProximityScore: 0, weightedTotal: 0 },
            blocked: true,
            blockReason: `SKU Complexity ${order.skuComplexityIndex} requires minimum tier '${required}'; installer is '${installer.certificationTier}'.`,
            saturated: false,
        };
    }

    // ── Score computation ─────────────────────────────────────────────────────
    const certificationScore  = scoreCertification(installer.certificationTier);
    const ttiScore            = scoreTTI(installer.ttiActual, installer.ttiBenchmark);
    const customerRatingScore = scoreCustomerRating(installer.customerRating);
    const geoProximityScore   = scoreGeoProximity(installer.gpsCoords, order.siteCoords);

    const weightedTotal =
        (certificationScore  * WEIGHT_CERTIFICATION +
         ttiScore            * WEIGHT_TTI +
         customerRatingScore * WEIGHT_CUSTOMER +
         geoProximityScore   * WEIGHT_GEO) * 100;

    return {
        installer,
        scoreBreakdown: {
            certificationScore,
            ttiScore,
            customerRatingScore,
            geoProximityScore,
            weightedTotal: Math.round(weightedTotal * 100) / 100,
        },
        blocked: false,
        saturated: isSaturated(installer, caps),
    };
}

// ── Pool-level ranking ────────────────────────────────────────────────────────

/**
 * Score and rank all installers for a given work order.
 *
 * Returns all results sorted by weighted score descending.
 * Blocked installers are appended at the bottom regardless of score.
 * Saturated-but-unblocked installers remain in ranked order so the dispatcher
 * can make an informed override decision.
 */
export function rankInstallers(
    installers: InstallerProfile[],
    order: WorkOrderTarget,
    caps: UtilizationCaps = DEFAULT_UTILIZATION_CAPS
): MatchResult[] {
    const results = installers.map(i => scoreInstaller(i, order, caps));

    results.sort((a, b) => {
        // Blocked always last
        if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
        // Among non-blocked: higher score first
        return b.scoreBreakdown.weightedTotal - a.scoreBreakdown.weightedTotal;
    });

    return results;
}

/**
 * Convenience: return only the eligible (non-blocked) ranked candidates.
 * Saturated candidates are included but the `saturated` flag is set.
 */
export function getEligibleRanked(
    installers: InstallerProfile[],
    order: WorkOrderTarget,
    caps: UtilizationCaps = DEFAULT_UTILIZATION_CAPS
): MatchResult[] {
    return rankInstallers(installers, order, caps).filter(r => !r.blocked);
}
