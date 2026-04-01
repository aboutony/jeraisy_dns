/*
  AXON Phase 5-C: ComplaintRouter.ts
  Auto-routing engine that cross-references incoming complaints against
  V-Trace Completion Certificates to assign accountability correctly.

  Routing logic:
    - All complaints are resolved to a V-Trace record via workOrderId.
    - If category is 'installationQuality' → auto-route to the Field Supervisor
      recorded in that V-Trace record (supervisorId).
    - High/Critical severity → set escalationRequired = true regardless of category.
    - All other categories route to their default owner queue (see CATEGORY_ROUTING_MAP).

  Output:
    ComplaintRouting — a flat, storable routing decision record ready for
    persistence and notification dispatch.
*/

import type { VTraceRecord } from './VTraceEngine';

// ── Complaint types ───────────────────────────────────────────────────────────

export type ComplaintCategory =
    | 'installationQuality'
    | 'deliveryDelay'
    | 'staffBehavior'
    | 'productDamage'
    | 'invoicingError'
    | 'other';

export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RoutingDestination =
    | 'fieldSupervisor'   // installation issues — linked to V-Trace supervisorId
    | 'logistics'         // delivery/transit issues
    | 'hrDisciplinary'    // staff behaviour
    | 'qualityAssurance'  // product damage
    | 'finance'           // invoicing
    | 'management';       // escalations and 'other' with critical severity

export interface IncomingComplaint {
    complaintId: string;
    workOrderId: string;
    /** ISO timestamp of complaint submission. */
    submittedAt: string;
    category: ComplaintCategory;
    description: string;
    /** Customer name (display only). */
    submittedBy: string;
    severity: ComplaintSeverity;
    /** Optional site address — stored for conflict-of-interest cross-referencing. */
    siteAddress?: string;
}

export interface ComplaintRouting {
    complaintId: string;
    workOrderId: string;
    /** V-Trace record ID this routing decision is grounded in. */
    traceId: string;
    routedTo: RoutingDestination;
    /**
     * Supervisor ID from the V-Trace record.
     * Only populated when routedTo === 'fieldSupervisor'.
     */
    supervisorId?: number;
    routedAt: string;
    /** Human-readable explanation of the routing decision. */
    reason: string;
    /** True when severity is high/critical, or when no V-Trace record is found. */
    escalationRequired: boolean;
    /** Snapshot of the survey installation quality score at time of routing, if available. */
    surveyInstallationScore?: number;
}

export interface RoutingResult {
    routing: ComplaintRouting;
    /**
     * True if the V-Trace record was found and used for routing.
     * False means routing fell back to defaults (no trace available).
     */
    traceResolved: boolean;
    warnings: string[];
}

// ── Default routing map ───────────────────────────────────────────────────────

const CATEGORY_ROUTING_MAP: Record<ComplaintCategory, RoutingDestination> = {
    installationQuality: 'fieldSupervisor',  // overridden with supervisorId from V-Trace
    deliveryDelay:       'logistics',
    staffBehavior:       'hrDisciplinary',
    productDamage:       'qualityAssurance',
    invoicingError:      'finance',
    other:               'management',
};

// ── Severity escalation rules ─────────────────────────────────────────────────

export function requiresEscalation(
    severity: ComplaintSeverity,
    traceResolved: boolean
): boolean {
    if (!traceResolved) return true;           // no accountability chain → escalate
    return severity === 'high' || severity === 'critical';
}

// ── V-Trace lookup ────────────────────────────────────────────────────────────

/**
 * Resolve the V-Trace record for a given work order from an in-memory store.
 * In production, this would query the database; here it accepts the live
 * trace store (Map<workOrderId, VTraceRecord>) from the application layer.
 */
export function resolveVTrace(
    workOrderId: string,
    traceStore: Map<string, VTraceRecord>
): VTraceRecord | null {
    return traceStore.get(workOrderId) ?? null;
}

// ── Core routing function ─────────────────────────────────────────────────────

/**
 * Route an incoming complaint to the correct owner queue.
 *
 * Algorithm:
 *  1. Look up the V-Trace record for the complaint's work order.
 *  2. Determine the default routing destination from CATEGORY_ROUTING_MAP.
 *  3. If category is 'installationQuality', attach the supervisorId from the trace.
 *  4. Apply escalation flag for high/critical severity or missing trace.
 *  5. Return the routing decision with full audit metadata.
 *
 * @param complaint  - The incoming complaint to route.
 * @param traceStore - Live map of workOrderId → VTraceRecord.
 * @param nowIso     - Injectable timestamp for deterministic testing.
 */
export function routeComplaint(
    complaint: IncomingComplaint,
    traceStore: Map<string, VTraceRecord>,
    nowIso: string = new Date().toISOString()
): RoutingResult {
    const warnings: string[] = [];
    const trace = resolveVTrace(complaint.workOrderId, traceStore);
    const traceResolved = trace !== null;

    if (!traceResolved) {
        warnings.push(
            `No V-Trace record found for WO ${complaint.workOrderId}. ` +
            `Routing to management with escalation flag.`
        );
    }

    let routedTo: RoutingDestination = CATEGORY_ROUTING_MAP[complaint.category];
    let supervisorId: number | undefined;
    let reason: string;
    let surveyInstallationScore: number | undefined;

    if (complaint.category === 'installationQuality') {
        if (trace) {
            supervisorId = trace.supervisorId;
            surveyInstallationScore = trace.surveyData?.installationQuality;

            const scoreNote = surveyInstallationScore !== undefined
                ? ` Survey installation score: ${surveyInstallationScore}/5.`
                : ' No survey data on record.';

            reason =
                `Installation quality complaint on WO ${complaint.workOrderId} ` +
                `auto-routed to Field Supervisor (ID: ${supervisorId}) ` +
                `from V-Trace record ${trace.traceId}.${scoreNote}`;
        } else {
            routedTo = 'management';
            reason =
                `Installation quality complaint on WO ${complaint.workOrderId} — ` +
                `no V-Trace record found; escalated to management.`;
            warnings.push('Field Supervisor cannot be resolved without a V-Trace record.');
        }
    } else {
        reason =
            `${complaint.category} complaint on WO ${complaint.workOrderId} ` +
            `routed to ${routedTo}` +
            (trace ? ` (V-Trace: ${trace.traceId})` : ' (no V-Trace)') + '.';
    }

    // Severity override: high/critical always escalates
    if (complaint.severity === 'critical' || complaint.severity === 'high') {
        if (routedTo !== 'management') {
            reason += ` Escalation required: severity is '${complaint.severity}'.`;
        }
    }

    const routing: ComplaintRouting = {
        complaintId:             complaint.complaintId,
        workOrderId:             complaint.workOrderId,
        traceId:                 trace?.traceId ?? 'UNRESOLVED',
        routedTo,
        supervisorId,
        routedAt:                nowIso,
        reason,
        escalationRequired:      requiresEscalation(complaint.severity, traceResolved),
        surveyInstallationScore,
    };

    console.log(
        `[ComplaintRouter] 🎯 ${complaint.complaintId} → ${routedTo}` +
        (supervisorId ? ` (supervisor: ${supervisorId})` : '') +
        (routing.escalationRequired ? ' ⚠️ ESCALATE' : '')
    );

    return { routing, traceResolved, warnings };
}

// ── Batch routing ─────────────────────────────────────────────────────────────

/**
 * Route multiple complaints at once.
 * Results are returned in input order; failures are captured as warnings rather
 * than throwing, so one bad complaint does not block the rest.
 */
export function routeComplaints(
    complaints: IncomingComplaint[],
    traceStore: Map<string, VTraceRecord>,
    nowIso: string = new Date().toISOString()
): RoutingResult[] {
    return complaints.map(complaint => {
        try {
            return routeComplaint(complaint, traceStore, nowIso);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const fallbackRouting: ComplaintRouting = {
                complaintId:        complaint.complaintId,
                workOrderId:        complaint.workOrderId,
                traceId:            'ERROR',
                routedTo:           'management',
                routedAt:           nowIso,
                reason:             `Routing error: ${errMsg}`,
                escalationRequired: true,
            };
            return {
                routing:       fallbackRouting,
                traceResolved: false,
                warnings:      [`Routing failed for ${complaint.complaintId}: ${errMsg}`],
            };
        }
    });
}

// ── Supervisor summary helper ─────────────────────────────────────────────────

/**
 * Aggregate all installation-quality complaints assigned to a given supervisor.
 * Used to build the supervisor accountability view.
 */
export function getComplaintsForSupervisor(
    supervisorId: number,
    routings: ComplaintRouting[]
): ComplaintRouting[] {
    return routings.filter(
        r => r.routedTo === 'fieldSupervisor' && r.supervisorId === supervisorId
    );
}

/**
 * Check whether a complaint should be added to an installer's open-complaint list
 * (used by PriorityMatch.ts Conflict-of-Interest filter).
 * Returns the address ref if the complaint qualifies, or null otherwise.
 */
export function extractConflictRef(
    complaint: IncomingComplaint,
    routing: ComplaintRouting
): string | null {
    // Only unresolved installation-quality complaints create a CoI flag
    if (
        complaint.category === 'installationQuality' &&
        routing.routedTo === 'fieldSupervisor' &&
        complaint.siteAddress
    ) {
        return complaint.siteAddress;
    }
    return null;
}
