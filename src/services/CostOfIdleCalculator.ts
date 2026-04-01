/*
  AXON Phase 5-B: CostOfIdleCalculator.ts
  Calculates the financial cost of underutilised idle installers.

  Hero Widget placement: first data point, top-left of AXON-MOD-009 dashboard.
  Consumed by the frontend as a pure data object — zero UI logic in this file.

  Formula:
    costOfIdle (per installer) = dailyRateSar × idleDays
    totalCostSar               = Σ costOfIdle across all idle installers
    dayOverDayDeltaSar         = totalCostSar(today) − totalCostSar(yesterday)

  Daily rate derivation:
    AVERAGE_SALARY_SAR / WORKING_DAYS_PER_MONTH
    = 2100 / 22 ≈ 95.45 SAR/day

  "Idle" definition:
    A worker whose status is 'idle' or 'offDuty' AND has no assigned work order.
    Workers on break, in overtime, or actively punched-in are excluded.
*/

import type { Worker } from '../store/types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const AVERAGE_MONTHLY_SALARY_SAR = 2_100;
export const WORKING_DAYS_PER_MONTH     = 22;
export const AVERAGE_DAILY_RATE_SAR     = AVERAGE_MONTHLY_SALARY_SAR / WORKING_DAYS_PER_MONTH;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface IdleInstallerRecord {
    workerId: number;
    name: string;
    /** Calendar days since last work order assignment (≥ 1). */
    idleDays: number;
    dailyRateSar: number;
    costOfIdleSar: number;
}

export interface CostOfIdleReport {
    /** Summed cost across all idle installers (SAR). First hero metric. */
    totalCostSar: number;
    /** Count of installers currently classified as idle. */
    idleCount: number;
    /** Per-installer breakdown, sorted by costOfIdleSar descending. */
    records: IdleInstallerRecord[];
    /**
     * Difference between today's total and yesterday's total (SAR).
     * Positive = cost grew (more idle days accumulated / new idle installers).
     * Negative = cost shrank (installers were assigned).
     * Null when no prior snapshot is available.
     */
    dayOverDayDeltaSar: number | null;
    /** ISO timestamp of report generation. */
    generatedAt: string;
}

export interface IdleSnapshot {
    /** ISO date string (YYYY-MM-DD) this snapshot covers. */
    date: string;
    totalCostSar: number;
    idleCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determine whether a worker is currently idle (not generating value).
 * Workers with an active assignment or punch-in are excluded.
 */
export function isIdle(worker: Worker): boolean {
    if (worker.assignedWorkOrder !== null) return false;
    if (worker.punchedIn) return false;
    return worker.status === 'idle' || worker.status === 'offDuty';
}

/**
 * Calculate idle days from the worker's last known activity timestamp.
 * Falls back to 1 day when no timestamp is available (conservative minimum).
 *
 * @param lastActivityIso - ISO timestamp of last punch-out or work-order completion.
 * @param nowIso          - Reference "now" ISO timestamp (injectable for testing).
 */
export function calcIdleDays(
    lastActivityIso: string | null,
    nowIso: string = new Date().toISOString()
): number {
    if (!lastActivityIso) return 1;
    const diffMs = new Date(nowIso).getTime() - new Date(lastActivityIso).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
}

/**
 * Derive a per-worker daily rate.
 * Uses the global average unless the worker carries an explicit rate override.
 */
export function getDailyRate(dailyRateOverride?: number): number {
    return dailyRateOverride ?? AVERAGE_DAILY_RATE_SAR;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Build a full Cost-of-Idle report from the current worker pool.
 *
 * @param workers             - Full worker array from GlobalStore.
 * @param lastActivityMap     - Map of workerId → ISO timestamp of last activity.
 *                              Workers absent from the map default to 1 idle day.
 * @param priorSnapshot       - Yesterday's snapshot for day-over-day delta.
 *                              Pass null on first run.
 * @param dailyRateOverrideMap - Optional per-worker daily rate overrides (SAR).
 * @param nowIso              - Injectable "now" for deterministic testing.
 */
export function buildCostOfIdleReport(
    workers: Worker[],
    lastActivityMap: Map<number, string>,
    priorSnapshot: IdleSnapshot | null = null,
    dailyRateOverrideMap: Map<number, number> = new Map(),
    nowIso: string = new Date().toISOString()
): CostOfIdleReport {
    const idleWorkers = workers.filter(isIdle);

    const records: IdleInstallerRecord[] = idleWorkers.map(worker => {
        const lastActivity = lastActivityMap.get(worker.id) ?? null;
        const idleDays     = calcIdleDays(lastActivity, nowIso);
        const dailyRate    = getDailyRate(dailyRateOverrideMap.get(worker.id));
        return {
            workerId:      worker.id,
            name:          worker.nameEn || worker.nameAr,
            idleDays,
            dailyRateSar:  Math.round(dailyRate * 100) / 100,
            costOfIdleSar: Math.round(idleDays * dailyRate * 100) / 100,
        };
    });

    records.sort((a, b) => b.costOfIdleSar - a.costOfIdleSar);

    const totalCostSar = Math.round(
        records.reduce((sum, r) => sum + r.costOfIdleSar, 0) * 100
    ) / 100;

    const dayOverDayDeltaSar =
        priorSnapshot !== null
            ? Math.round((totalCostSar - priorSnapshot.totalCostSar) * 100) / 100
            : null;

    return {
        totalCostSar,
        idleCount: records.length,
        records,
        dayOverDayDeltaSar,
        generatedAt: nowIso,
    };
}

// ── Snapshot helpers (for day-over-day tracking) ──────────────────────────────

/** Extract a lightweight snapshot from a full report for persistence/comparison. */
export function snapshotFromReport(report: CostOfIdleReport): IdleSnapshot {
    const date = report.generatedAt.slice(0, 10); // YYYY-MM-DD
    return {
        date,
        totalCostSar: report.totalCostSar,
        idleCount:    report.idleCount,
    };
}

/**
 * Format the hero widget data object consumed directly by the dashboard renderer.
 * Shape is intentionally flat — no JSX or styling in this layer.
 */
export interface HeroWidgetData {
    totalCostSarFormatted: string;          // e.g. "SAR 18,340.50"
    idleCount: number;
    dayOverDayDeltaSar: number | null;
    deltaDirection: 'up' | 'down' | 'flat' | 'unknown';
    deltaFormatted: string | null;          // e.g. "+SAR 950.00" or "-SAR 190.00"
    ctaLabel: string;
    topOffenders: Pick<IdleInstallerRecord, 'workerId' | 'name' | 'idleDays' | 'costOfIdleSar'>[];
}

export function buildHeroWidgetData(report: CostOfIdleReport): HeroWidgetData {
    const fmt = (sar: number) =>
        `SAR ${sar.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let deltaDirection: HeroWidgetData['deltaDirection'] = 'unknown';
    let deltaFormatted: string | null = null;

    if (report.dayOverDayDeltaSar !== null) {
        if (report.dayOverDayDeltaSar > 0) {
            deltaDirection = 'up';
            deltaFormatted = `+${fmt(report.dayOverDayDeltaSar)}`;
        } else if (report.dayOverDayDeltaSar < 0) {
            deltaDirection = 'down';
            deltaFormatted = `-${fmt(Math.abs(report.dayOverDayDeltaSar))}`;
        } else {
            deltaDirection = 'flat';
            deltaFormatted = `${fmt(0)}`;
        }
    }

    return {
        totalCostSarFormatted: fmt(report.totalCostSar),
        idleCount:             report.idleCount,
        dayOverDayDeltaSar:    report.dayOverDayDeltaSar,
        deltaDirection,
        deltaFormatted,
        ctaLabel:              'Resolve Idle Installers',
        topOffenders:          report.records.slice(0, 5).map(r => ({
            workerId:      r.workerId,
            name:          r.name,
            idleDays:      r.idleDays,
            costOfIdleSar: r.costOfIdleSar,
        })),
    };
}
