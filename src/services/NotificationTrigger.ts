/* ============================================================
   JERAISY DNS — Notification Trigger Service
   Dispatches real-time mission notifications through GlobalStore.
   ============================================================ */

import type { GlobalAction, Notification, MissionAssignment, Worker } from '../store/types';

// ── Branch Coordinates (for geofence matching) ────────────────
export const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
    HQ: { lat: 24.7136, lng: 46.6753 },
    RUH: { lat: 24.7136, lng: 46.6753 },
    DMM: { lat: 26.3927, lng: 49.9777 },
    JED: { lat: 21.4858, lng: 39.1925 },
};

function makeId(): string {
    return `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Push "Mission Assigned" notification to crew + driver.
 * Called immediately after the Work Order wizard creates a mission.
 */
export function pushMissionAssigned(
    dispatch: React.Dispatch<GlobalAction>,
    assignment: MissionAssignment,
    customerNameEn: string,
    customerNameAr: string,
    skuNameEn: string,
    skuNameAr: string,
): void {
    const notification: Notification = {
        id: makeId(),
        titleAr: '📋 مهمة جديدة مسندة',
        titleEn: '📋 New Mission Assigned',
        messageAr: `تم تعيينك في مهمة ${skuNameAr} للعميل ${customerNameAr}. الفرع: ${assignment.branchCode}`,
        messageEn: `You have been assigned to ${skuNameEn} for ${customerNameEn}. Branch: ${assignment.branchCode}`,
        priority: 'high',
        timestamp: new Date().toISOString(),
        read: false,
        source: 'mission',
    };

    // Dispatch the assignment to store
    dispatch({ type: 'MISSION_ASSIGNED', payload: assignment });

    // Fire notification
    dispatch({ type: 'NOTIFICATION_ADDED', payload: notification });

    console.log(`[NotificationTrigger] 🔔 Mission push → ${assignment.crewIds.length} crew + WO ${assignment.workOrderId}`);
}

/**
 * Push "Mission Accepted" notification to the manager.
 * Called when a driver/tech accepts the mission brief.
 */
export function pushMissionAccepted(
    dispatch: React.Dispatch<GlobalAction>,
    workOrderId: string,
    acceptedByEn: string,
    acceptedByAr: string,
): void {
    dispatch({ type: 'MISSION_ACCEPTED', payload: { workOrderId } });

    const notification: Notification = {
        id: makeId(),
        titleAr: '✅ تم قبول المهمة',
        titleEn: '✅ Mission Accepted',
        messageAr: `قبل ${acceptedByAr} المهمة ${workOrderId}. الحالة: في الطريق`,
        messageEn: `${acceptedByEn} accepted mission ${workOrderId}. Status: In Transit`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        read: false,
        source: 'mission',
    };

    dispatch({ type: 'NOTIFICATION_ADDED', payload: notification });
    console.log(`[NotificationTrigger] ✅ Mission accepted → ${workOrderId} by ${acceptedByEn}`);
}

/**
 * Push "Mission Rejected" notification to the manager.
 * Critical priority — requires immediate re-assignment action.
 */
export function pushMissionRejected(
    dispatch: React.Dispatch<GlobalAction>,
    workOrderId: string,
    rejectedByEn: string,
    rejectedByAr: string,
    reason?: string,
): void {
    dispatch({ type: 'MISSION_REJECTED', payload: { workOrderId, reason } });

    const notification: Notification = {
        id: makeId(),
        titleAr: '🚨 تم رفض المهمة — إجراء مطلوب',
        titleEn: '🚨 Mission Rejected — Action Required',
        messageAr: `رفض ${rejectedByAr} المهمة ${workOrderId}. ${reason || 'يرجى إعادة التعيين فوراً'}`,
        messageEn: `${rejectedByEn} rejected mission ${workOrderId}. ${reason || 'Please re-assign immediately'}`,
        priority: 'critical',
        timestamp: new Date().toISOString(),
        read: false,
        source: 'mission',
    };

    dispatch({ type: 'NOTIFICATION_ADDED', payload: notification });
    console.log(`[NotificationTrigger] 🚨 Mission rejected → ${workOrderId} by ${rejectedByEn}`);
}

/**
 * Get alternative workers for re-assignment after rejection.
 */
export function getSuggestedReplacements(
    workers: Worker[],
    department: string,
    branchSite: string,
    excludeIds: number[],
    limit = 3,
): Worker[] {
    const excludeSet = new Set(excludeIds);
    return workers
        .filter(w =>
            w.department === department
            && w.site === branchSite
            && !excludeSet.has(w.id)
            && w.hoursWorked < 35
            && !w.assignedWorkOrder
        )
        .sort((a, b) => a.hoursWorked - b.hoursWorked)
        .slice(0, limit);
}

export default {
    pushMissionAssigned,
    pushMissionAccepted,
    pushMissionRejected,
    getSuggestedReplacements,
    BRANCH_COORDS,
};
