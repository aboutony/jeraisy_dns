/*
  AXON Phase 5-E: LoadBalancer.ts
  Anti-burnout load balancing and 360° composite feedback scoring.

  Two responsibilities:

  1. WEEKLY UTILIZATION ENFORCEMENT
     Each certification tier carries a hard weekly job cap (default 6).
     When PriorityMatch.ts flags an installer as `saturated`, this module
     provides the authoritative gate — removing them from the eligible pool
     and selecting the next highest-ranked available candidate automatically.

  2. 360° FEEDBACK COMPOSITE SCORE
     Board-approved weighting model:
       Customer feedback   40%
       Auto-signals        30%   (on-time rate, TTI vs benchmark, photo pass rate)
       Supervisor rating   20%
       Peer rating         10%

     The composite score (0–100) feeds back into PriorityMatch.ts as the
     `customerRating` input, replacing simple star ratings with a richer signal.

  All functions are pure — no side-effects, fully injectable for unit tests.
*/

import type { InstallerProfile, MatchResult, UtilizationCaps, WorkOrderTarget } from './PriorityMatch';
import { rankInstallers, DEFAULT_UTILIZATION_CAPS } from './PriorityMatch';

// ── Weekly cap enforcement ────────────────────────────────────────────────────

export interface CapEnforcementConfig {
    caps: UtilizationCaps;
    /**
     * When true, saturated installers are silently excluded before ranking.
     * When false (default in PriorityMatch), they appear flagged in results.
     * LoadBalancer enforces hard exclusion.
     */
    hardExcludeSaturated: boolean;
}

export const DEFAULT_CAP_CONFIG: CapEnforcementConfig = {
    caps: DEFAULT_UTILIZATION_CAPS,
    hardExcludeSaturated: true,
};

/**
 * Filter installer pool to only those below their weekly utilization cap.
 * Saturated installers are removed entirely before scoring begins,
 * fulfilling the "automatically bypass them" directive.
 */
export function applyUtilizationCap(
    installers: InstallerProfile[],
    caps: UtilizationCaps = DEFAULT_UTILIZATION_CAPS
): { eligible: InstallerProfile[]; bypassed: InstallerProfile[] } {
    const eligible: InstallerProfile[] = [];
    const bypassed: InstallerProfile[] = [];

    for (const installer of installers) {
        if (installer.weeklyJobCount >= caps[installer.certificationTier]) {
            bypassed.push(installer);
        } else {
            eligible.push(installer);
        }
    }

    return { eligible, bypassed };
}

/**
 * Anti-burnout dispatch: apply cap filter then rank remaining candidates.
 * Bypassed (saturated) installers are appended with blocked=true so the
 * Operations Director can see the full pool state while the dispatch engine
 * only acts on eligible candidates.
 *
 * This is the primary entry point — replaces direct calls to rankInstallers()
 * when burnout protection is required.
 */
export function rankWithBurnoutProtection(
    installers: InstallerProfile[],
    order: WorkOrderTarget,
    config: CapEnforcementConfig = DEFAULT_CAP_CONFIG
): {
    ranked: MatchResult[];
    bypassedCount: number;
    eligibleCount: number;
} {
    const { eligible, bypassed } = applyUtilizationCap(installers, config.caps);

    // Rank only eligible (non-saturated) candidates
    const ranked = rankInstallers(eligible, order, config.caps);

    // Append bypassed installers as informational blocked entries
    const bypassedResults: MatchResult[] = bypassed.map(installer => ({
        installer,
        scoreBreakdown: {
            certificationScore:  0,
            ttiScore:            0,
            customerRatingScore: 0,
            geoProximityScore:   0,
            weightedTotal:       0,
        },
        blocked: true,
        blockReason: `Weekly cap reached: ${installer.weeklyJobCount}/${config.caps[installer.certificationTier]} jobs this week (${installer.certificationTier} tier).`,
        saturated: true,
    }));

    return {
        ranked: [...ranked, ...bypassedResults],
        bypassedCount: bypassed.length,
        eligibleCount: eligible.length,
    };
}

/**
 * Get the top N non-blocked, non-saturated candidates after burnout protection.
 * This is the list the dispatcher sees as actionable assignments.
 */
export function getTopCandidates(
    installers: InstallerProfile[],
    order: WorkOrderTarget,
    n = 5,
    config: CapEnforcementConfig = DEFAULT_CAP_CONFIG
): MatchResult[] {
    const { ranked } = rankWithBurnoutProtection(installers, order, config);
    return ranked.filter(r => !r.blocked).slice(0, n);
}

// ── Weekly utilization summary ────────────────────────────────────────────────

export interface TierUtilizationSummary {
    tier: string;
    totalInstallers: number;
    saturatedCount: number;
    saturationRate: number;   // 0–1
    avgJobCount: number;
    cap: number;
}

/**
 * Produce a per-tier utilization summary for the Operations dashboard.
 */
export function buildTierUtilizationSummary(
    installers: InstallerProfile[],
    caps: UtilizationCaps = DEFAULT_UTILIZATION_CAPS
): TierUtilizationSummary[] {
    const tiers = ['foundation', 'pro', 'master'] as const;

    return tiers.map(tier => {
        const pool      = installers.filter(i => i.certificationTier === tier);
        const saturated = pool.filter(i => i.weeklyJobCount >= caps[tier]);
        const avgJobs   = pool.length > 0
            ? Math.round((pool.reduce((s, i) => s + i.weeklyJobCount, 0) / pool.length) * 10) / 10
            : 0;

        return {
            tier,
            totalInstallers: pool.length,
            saturatedCount:  saturated.length,
            saturationRate:  pool.length > 0 ? Math.round((saturated.length / pool.length) * 1000) / 1000 : 0,
            avgJobCount:     avgJobs,
            cap:             caps[tier],
        };
    });
}

// ── 360° Composite Feedback Score ────────────────────────────────────────────

/**
 * Board-approved weighting model:
 *   Customer   40%  — direct customer satisfaction ratings
 *   AutoSignal 30%  — on-time arrival, TTI vs benchmark, photo pass rate
 *   Supervisor 20%  — field supervisor performance evaluation
 *   Peer       10%  — colleague peer assessment
 */
export const FEEDBACK_WEIGHTS = {
    customer:   0.40,
    autoSignal: 0.30,
    supervisor: 0.20,
    peer:       0.10,
} as const;

export interface CustomerFeedback {
    /** Average star rating across all completed jobs. Range: 0–5. */
    avgStarRating: number;
    /** Number of ratings received. Used for confidence weighting. */
    ratingCount: number;
}

export interface AutoSignalFeedback {
    /**
     * On-time arrival rate: fraction of jobs where installer arrived within
     * scheduled window. Range: 0–1.
     */
    onTimeRate: number;
    /**
     * TTI efficiency: average (benchmark / actual). Values > 1 are capped at 1.
     * Range: 0–1.
     */
    ttiEfficiency: number;
    /**
     * Photo QA pass rate: fraction of photo uploads that passed quality review.
     * Range: 0–1.
     */
    photoPassRate: number;
}

export interface SupervisorFeedback {
    /** Field supervisor evaluation score. Range: 0–5. */
    score: number;
    /** Number of evaluations. Used for confidence weighting. */
    evaluationCount: number;
}

export interface PeerFeedback {
    /** Peer assessment average. Range: 0–5. */
    score: number;
    peerCount: number;
}

export interface FeedbackInputs {
    customer:   CustomerFeedback;
    autoSignal: AutoSignalFeedback;
    supervisor: SupervisorFeedback;
    peer:       PeerFeedback;
}

export interface CompositeScoreBreakdown {
    customerComponent:   number;   // 0–100 pre-weight sub-score
    autoSignalComponent: number;
    supervisorComponent: number;
    peerComponent:       number;
    /** Weighted composite. Range: 0–100. Used as PriorityMatch customerRating input (÷20 → 0–5). */
    compositeScore:      number;
    /** Confidence flag: low when rating counts are below minimum thresholds. */
    lowConfidence:       boolean;
}

const MIN_RATINGS_FOR_CONFIDENCE = 3;

/**
 * Compute the 360° composite score from all four feedback channels.
 *
 * Auto-signal sub-score averages the three auto-generated signals:
 *   (onTimeRate + ttiEfficiency + photoPassRate) / 3  → normalised to 0–100.
 *
 * Low confidence is flagged when any scored channel has fewer than
 * MIN_RATINGS_FOR_CONFIDENCE data points.
 */
export function computeCompositeScore(inputs: FeedbackInputs): CompositeScoreBreakdown {
    // Normalise each channel to 0–100
    const customerComponent   = Math.min(100, (inputs.customer.avgStarRating / 5) * 100);
    const autoSignalComponent = Math.min(100, ((
        inputs.autoSignal.onTimeRate +
        inputs.autoSignal.ttiEfficiency +
        inputs.autoSignal.photoPassRate
    ) / 3) * 100);
    const supervisorComponent = Math.min(100, (inputs.supervisor.score / 5) * 100);
    const peerComponent       = Math.min(100, (inputs.peer.score / 5) * 100);

    const compositeScore = Math.round((
        customerComponent   * FEEDBACK_WEIGHTS.customer   +
        autoSignalComponent * FEEDBACK_WEIGHTS.autoSignal +
        supervisorComponent * FEEDBACK_WEIGHTS.supervisor +
        peerComponent       * FEEDBACK_WEIGHTS.peer
    ) * 100) / 100;

    const lowConfidence =
        inputs.customer.ratingCount    < MIN_RATINGS_FOR_CONFIDENCE ||
        inputs.supervisor.evaluationCount < MIN_RATINGS_FOR_CONFIDENCE ||
        inputs.peer.peerCount          < MIN_RATINGS_FOR_CONFIDENCE;

    return {
        customerComponent:   Math.round(customerComponent   * 100) / 100,
        autoSignalComponent: Math.round(autoSignalComponent * 100) / 100,
        supervisorComponent: Math.round(supervisorComponent * 100) / 100,
        peerComponent:       Math.round(peerComponent       * 100) / 100,
        compositeScore,
        lowConfidence,
    };
}

/**
 * Convert a composite score (0–100) to the 0–5 star input expected by
 * PriorityMatch.ts scoreCustomerRating().
 */
export function compositeScoreToStarRating(compositeScore: number): number {
    return Math.round((compositeScore / 100) * 5 * 100) / 100;
}

// ── Hero widget: Cost-of-Idle + 1-click CTA data ─────────────────────────────

export interface ResolveIdleAction {
    workerId: number;
    name: string;
    idleDays: number;
    costOfIdleSar: number;
    /** Recommended action derived from idle duration and training status. */
    recommendedAction: 'assign' | 'retrain' | 'crossDeploy' | 'offboard';
    /** Reason for the recommended action. */
    actionReason: string;
}

/**
 * Build the 1-click 'Resolve Idle Installers' action list for the hero widget CTA.
 * Integrates idle cost data with utilization context to produce prioritized actions.
 *
 * @param idleRecords   - From CostOfIdleCalculator.buildCostOfIdleReport().records
 * @param idleDayMap    - Map of workerId → idleDays (same source as idle calculator)
 * @param retrainingDeclineMap - Map of workerId → number of times declined re-training
 * @param OFFBOARD_THRESHOLD_DAYS - Days idle before offboarding is triggered (default 60)
 * @param MAX_RETRAIN_DECLINES    - Max declined re-training invitations before offboard (default 2)
 */
export function buildResolveIdleActions(
    idleRecords: Array<{ workerId: number; name: string; idleDays: number; costOfIdleSar: number }>,
    retrainingDeclineMap: Map<number, number> = new Map(),
    OFFBOARD_THRESHOLD_DAYS = 60,
    MAX_RETRAIN_DECLINES    = 2
): ResolveIdleAction[] {
    return idleRecords.map(record => {
        const declineCount = retrainingDeclineMap.get(record.workerId) ?? 0;

        let recommendedAction: ResolveIdleAction['recommendedAction'];
        let actionReason: string;

        if (record.idleDays >= OFFBOARD_THRESHOLD_DAYS && declineCount >= MAX_RETRAIN_DECLINES) {
            recommendedAction = 'offboard';
            actionReason      = `Idle ${record.idleDays} days; declined re-training ${declineCount}× — auto-archive triggered.`;
        } else if (record.idleDays >= OFFBOARD_THRESHOLD_DAYS) {
            recommendedAction = 'retrain';
            actionReason      = `Idle ${record.idleDays} days — eligible for re-training invitation.`;
        } else if (record.idleDays >= 14) {
            recommendedAction = 'crossDeploy';
            actionReason      = `Idle ${record.idleDays} days — consider cross-regional deployment.`;
        } else {
            recommendedAction = 'assign';
            actionReason      = `Available — assign to next eligible work order.`;
        }

        return {
            workerId:          record.workerId,
            name:              record.name,
            idleDays:          record.idleDays,
            costOfIdleSar:     record.costOfIdleSar,
            recommendedAction,
            actionReason,
        };
    });
}

// ── Skills gap analysis ───────────────────────────────────────────────────────

export interface SkuCertificationGap {
    skuCode: string;
    skuName: string;
    requiredTier: 'pro' | 'master';
    certifiedCount: number;
    demandCount: number;
    /** Negative = shortage (demand exceeds supply). */
    surplus: number;
    /** Idle installers eligible for upgrade training to fill this gap. */
    trainingCandidates: Array<{ workerId: number; name: string; currentTier: string; idleDays: number }>;
}

/**
 * Identify SKUs where certified installer supply is below current demand,
 * and surface idle candidates eligible for training to fill the gap.
 *
 * @param skuDemandMap      - Map of skuCode → number of open orders requiring it
 * @param skuTierMap        - Map of skuCode → minimum certification tier required
 * @param skuNameMap        - Map of skuCode → display name
 * @param installerProfiles - Full installer pool with certificationTier
 * @param idleRecords       - From CostOfIdleCalculator to identify training candidates
 */
export function analyzeSkillsGap(
    skuDemandMap: Map<string, number>,
    skuTierMap: Map<string, 'pro' | 'master'>,
    skuNameMap: Map<string, string>,
    installerProfiles: InstallerProfile[],
    idleRecords: Array<{ workerId: number; name: string; idleDays: number }>
): SkuCertificationGap[] {
    const gaps: SkuCertificationGap[] = [];

    const tierRank: Record<string, number> = { foundation: 0, pro: 1, master: 2 };

    for (const [skuCode, demand] of skuDemandMap) {
        const requiredTier = skuTierMap.get(skuCode) ?? 'pro';
        const certified    = installerProfiles.filter(
            i => tierRank[i.certificationTier] >= tierRank[requiredTier]
        );
        const surplus = certified.length - demand;

        if (surplus < 0) {
            // Find idle installers one tier below the required level — training candidates
            const oneBelow: Record<'pro' | 'master', string> = { pro: 'foundation', master: 'pro' };
            const upgradeTier = oneBelow[requiredTier];
            const candidates  = idleRecords
                .filter(r => {
                    const profile = installerProfiles.find(i => i.workerId === r.workerId);
                    return profile?.certificationTier === upgradeTier;
                })
                .sort((a, b) => a.idleDays - b.idleDays)  // lowest idle days first (fresher skills)
                .slice(0, 5)
                .map(r => ({
                    workerId:    r.workerId,
                    name:        r.name,
                    currentTier: upgradeTier,
                    idleDays:    r.idleDays,
                }));

            gaps.push({
                skuCode,
                skuName:            skuNameMap.get(skuCode) ?? skuCode,
                requiredTier,
                certifiedCount:     certified.length,
                demandCount:        demand,
                surplus,
                trainingCandidates: candidates,
            });
        }
    }

    // Worst gaps first
    return gaps.sort((a, b) => a.surplus - b.surplus);
}
