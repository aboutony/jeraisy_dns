/* ============================================================
   JERAISY DNS — Shared Type Definitions
   Production-Grade Interfaces for the Zero-Mock Architecture
   ============================================================ */

// ── Worker ────────────────────────────────────────────────────
export type WorkerStatus = 'active' | 'idle' | 'onBreak' | 'overtimeRisk' | 'overtime' | 'offDuty';

export interface Worker {
    id: number;
    nameAr: string;
    nameEn: string;
    department: string;
    departmentAr: string;
    role: string;
    roleAr: string;
    hoursWorked: number;
    weeklyLimit: number;
    status: WorkerStatus;
    site: 'riyadh' | 'jeddah' | 'dammam';
    isSaudi: boolean;
    punchedIn: boolean;
    punchInTime: string | null; // ISO timestamp
    assignedWorkOrder: string | null;
}

// ── Work Order ────────────────────────────────────────────────
export type WorkOrderStatus = 'pending' | 'inProgress' | 'completed' | 'synced';
export type WorkOrderType = 'standard' | 'transit';
export type SyncDirection = 'inbound' | 'outbound';

export interface WorkOrder {
    id: string;
    oracleRef: string;
    customerAr: string;
    customerEn: string;
    siteAr: string;
    siteEn: string;
    sku: string;
    descriptionAr: string;
    descriptionEn: string;
    estimatedHours: number;
    actualHours: number | null;
    status: WorkOrderStatus;
    assignedWorkers: number;
    lastSync: string;
    direction: SyncDirection;
    // ── IBT Transit Fields ────────────────────────────────────
    orderType: WorkOrderType;
    originBranch?: BranchCode;
    destinationBranch?: BranchCode;
    vehicleId?: string;
    driverId?: number;
    loadEfficiency?: number; // 0-100%
}

// ── Four-Branch Architecture ──────────────────────────────────
export type BranchCode = 'HQ' | 'RUH' | 'DMM' | 'JED';

export interface Branch {
    code: BranchCode;
    nameAr: string;
    nameEn: string;
    cityAr: string;
    cityEn: string;
    coords: { lat: number; lng: number };
    vehicleCount: number;
    workerCount: number;
    isHQ: boolean;
}

// ── Fleet VLC ─────────────────────────────────────────────────
export type VehicleStatus = 'available' | 'inTransit' | 'maintenance' | 'maintenanceDue' | 'outOfService';

export interface Vehicle {
    id: string;
    plateAr: string;
    plateEn: string;
    typeAr: string;
    typeEn: string;
    homeBranch: BranchCode;
    currentBranch: BranchCode;
    status: VehicleStatus;
    totalMileageKm: number;
    transitMileageKm: number;
    localMileageKm: number;
    lastServiceKm: number;
    nextServiceKm: number;
    serviceIntervalKm: number;
    year: number;
}

// ── Transit Mission ───────────────────────────────────────────
export type TransitMissionStatus = 'planned' | 'loading' | 'inTransit' | 'delivered' | 'returning' | 'completed';

export interface TransitMission {
    id: string;
    workOrderId: string;
    vehicleId: string;
    driverId: number;
    driverNameAr: string;
    driverNameEn: string;
    originBranch: BranchCode;
    destinationBranch: BranchCode;
    driverHomeBranch: BranchCode;
    loadEfficiency: number; // 0-100%
    status: TransitMissionStatus;
    distanceKm: number;
    departedAt: string | null;
    estimatedArrival: string | null;
    returnToBase: boolean;
    cargoDescriptionAr: string;
    cargoDescriptionEn: string;
}

// ── SKU-to-Labor Mapping ──────────────────────────────────────
export interface SkuMapping {
    sku: string;
    nameAr: string;
    nameEn: string;
    category: 'luxury' | 'commercial' | 'medical' | 'hospitality';
    estimatedHours: number;
    laborRate: number; // SAR per hour
}

// ── Punch Event ───────────────────────────────────────────────
export interface PunchEvent {
    id: string;
    workerId: number;
    workerNameAr: string;
    workerNameEn: string;
    type: 'in' | 'out';
    timestamp: string; // ISO
    site: 'riyadh' | 'jeddah' | 'dammam';
    coords: { lat: number; lng: number };
    workOrderId: string | null;
    synced: boolean;
}

// ── Sync Queue Entry ──────────────────────────────────────────
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueEntry {
    id: string;
    timestamp: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    payload: unknown;
    retryCount: number;
    maxRetries: number;
    status: QueueStatus;
    errorMessage?: string;
}

// ── Connection Status ─────────────────────────────────────────
export interface ConnectionStatus {
    oracle: boolean;
    gps: boolean;
    online: boolean;
}

// ── Executive Notification ────────────────────────────────────
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
    id: string;
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
    priority: NotificationPriority;
    timestamp: string;
    read: boolean;
    source: 'overtime' | 'oracle' | 'geofence' | 'system';
}

// ── Threshold Config ──────────────────────────────────────────
export interface ThresholdConfig {
    geofenceRadiusKm: number;  // default 0.05 (50m)
    overtimeHoursLimit: number; // default 38
}

// ── WPS (Wage Protection System) Payload ──────────────────────
export interface WpsPayload {
    workOrderId: string;
    oracleRef: string;
    workerIds: number[];
    totalHours: number;
    completionTimestamp: string;
    siteCode: 'RUH' | 'JED' | 'DMM';
    laborCostSar: number;
}

// ── Global State ──────────────────────────────────────────────
export interface GlobalState {
    workers: Worker[];
    workOrders: WorkOrder[];
    skuMapping: SkuMapping[];
    punchEvents: PunchEvent[];
    syncQueueEntries: QueueEntry[];
    notifications: Notification[];
    thresholds: ThresholdConfig;
    connection: ConnectionStatus;
    lastSync: string;
    isLoading: boolean;
    error: string | null;
    // ── Fleet & Branch ────────────────────────────────────────
    vehicles: Vehicle[];
    transitMissions: TransitMission[];
    branches: Branch[];
}

// ── Actions ───────────────────────────────────────────────────
export type GlobalAction =
    | { type: 'WORKERS_LOADED'; payload: Worker[] }
    | { type: 'WORKER_STATUS_UPDATED'; payload: { id: number; status: WorkerStatus; hoursWorked: number } }
    | { type: 'WORKER_PUNCH_IN'; payload: { workerId: number; timestamp: string; workOrderId: string | null } }
    | { type: 'WORKER_PUNCH_OUT'; payload: { workerId: number; timestamp: string; hoursLogged: number } }
    | { type: 'WORK_ORDERS_LOADED'; payload: WorkOrder[] }
    | { type: 'WORK_ORDER_SYNCED'; payload: { id: string; status: WorkOrderStatus; lastSync: string } }
    | { type: 'SKU_MAPPING_LOADED'; payload: SkuMapping[] }
    | { type: 'PUNCH_EVENT_ADDED'; payload: PunchEvent }
    | { type: 'QUEUE_OPERATION'; payload: QueueEntry }
    | { type: 'QUEUE_ENTRY_UPDATED'; payload: { id: string; status: QueueStatus; errorMessage?: string } }
    | { type: 'FLUSH_QUEUE_COMPLETED'; payload: string[] }
    | { type: 'CONNECTION_CHANGED'; payload: Partial<ConnectionStatus> }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SYNC_TIMESTAMP_UPDATED'; payload: string }
    | { type: 'NOTIFICATION_ADDED'; payload: Notification }
    | { type: 'NOTIFICATIONS_CLEARED'; payload?: undefined }
    | { type: 'OVERTIME_BREACH_SIMULATED'; payload: number[] }
    | { type: 'THRESHOLD_UPDATED'; payload: Partial<ThresholdConfig> };
