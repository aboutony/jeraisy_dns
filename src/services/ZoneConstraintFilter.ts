/*
 AXON Phase 5-A: ZoneConstraintFilter.ts
 Backend logic for zone-classification hard-block in dispatch stack.
 SPEC: For Premium or Diplomatic orders, installer without verified bilingual must be block-listed.
 No UI changes in this file; pure logic module.
*/

export type WorkOrderPriority = 'standard' | 'premium' | 'diplomatic';
export type ZoneClassification = 'rural' | 'urban' | 'highSecurity' | 'diplomatic' | 'premium' | 'general';

export interface DigitalPassport {
    passportId: string;
    workerId: number;
    nationalId: string;
    tradeLicense: string;
    specializations: string[];
    languageProficiency: Record<string, 'none' | 'basic' | 'intermediate' | 'verified'>;
    verifiedBilingual: boolean;
    certificationBadges: Array<{ badgeKey: string; badgeName: string; awardedAt: string; expiresAt?: string }>;
    ttiBenchmarks: Array<{ sku: string; metricName: string; metricValue: number; unit: string }>;
    compositeScore: number;
    complianceDocuments: Array<{ documentId: string; complianceType: string; validFrom: string; validUntil: string; vaultPath: string }>;
}

export interface ZoneConstraintOptions {
    zoneToggleEnabled: boolean; // zone classification toggle
    hardBlockOnPremiumDiplomatic: boolean;
    preferredLanguages?: string[]; // e.g., ['english', 'arabic']
}

export interface DispatchCandidate {
    workerId: number;
    name: string;
    passport: DigitalPassport | null;
    currentStatus: 'available' | 'assigned' | 'offline';
    assignedWorkOrder?: string | null;
}

export interface EligibilityResult {
    candidate: DispatchCandidate;
    blocked: boolean;
    reason?: string;
}

export function isPremiumOrDiplomatic(priority: WorkOrderPriority): boolean {
    return priority === 'premium' || priority === 'diplomatic';
}

export function hasVerifiedBilingual(passport: DigitalPassport | null): boolean {
    if (!passport) return false;
    if (passport.verifiedBilingual) return true;

    const requiredLanguagePairs: Array<[string, string]> = [
        ['english', 'arabic'],
        ['english', 'french'],
        ['arabic', 'french'],
    ];

    for (const [a, b] of requiredLanguagePairs) {
        const aLevel = passport.languageProficiency[a]?.toLowerCase() || 'none';
        const bLevel = passport.languageProficiency[b]?.toLowerCase() || 'none';
        if (aLevel === 'verified' && bLevel === 'verified') return true;
    }

    return false;
}

export function evaluateZoneConstraint(
    orderPriority: WorkOrderPriority,
    zone: ZoneClassification,
    candidate: DispatchCandidate,
    options: ZoneConstraintOptions = { zoneToggleEnabled: true, hardBlockOnPremiumDiplomatic: true }
): EligibilityResult {
    const eligible: EligibilityResult = { candidate, blocked: false };

    if (!options.zoneToggleEnabled) {
        return eligible;
    }

    if (isPremiumOrDiplomatic(orderPriority) && options.hardBlockOnPremiumDiplomatic) {
        const bilingual = hasVerifiedBilingual(candidate.passport);
        if (!bilingual) {
            eligible.blocked = true;
            eligible.reason = 'Hard block: Premium/Diplomatic orders require Verified Bilingual status.';
            return eligible;
        }
    }

    // zone-specific policy example (optional, for extension)
    if (zone === 'highSecurity' && candidate.passport) {
        const clearanceKey = candidate.passport.certificationBadges.find(b => b.badgeKey === 'SECURITY_CLEARANCE_LEVEL_2');
        if (!clearanceKey) {
            eligible.blocked = true;
            eligible.reason = 'Hard block: highSecurity zone requires SECURITY_CLEARANCE_LEVEL_2 badge.';
            return eligible;
        }
    }

    return eligible;
}

export function filterEligibleInstallers(
    orderPriority: WorkOrderPriority,
    zone: ZoneClassification,
    candidates: DispatchCandidate[],
    options: ZoneConstraintOptions = { zoneToggleEnabled: true, hardBlockOnPremiumDiplomatic: true }
): EligibilityResult[] {
    return candidates.map(candidate => evaluateZoneConstraint(orderPriority, zone, candidate, options));
}
