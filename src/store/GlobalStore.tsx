/* ============================================================
   JERAISY DNS — Global State Engine ("The Brain")
   React Context + useReducer for centralized reactive state.
   Real-time sync: PunchClock → Heatmap without page refresh.
   ============================================================ */

import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import type {
    GlobalState,
    GlobalAction,
    Worker,
    WorkerStatus,
    PunchEvent,
    Notification,
    ThresholdConfig,
} from './types';
import OracleConnector from '../services/OracleConnector';

// ── Worker Generation (migrated from data/mockWorkers.ts) ─────
// In production, workers are fetched from Oracle HR module.
// This generates the 500-worker roster with realistic Saudi data.
const firstNamesAr = ['محمد', 'أحمد', 'عبدالله', 'فهد', 'خالد', 'ناصر', 'سعود', 'عمر', 'يوسف', 'إبراهيم', 'عبدالرحمن', 'سلطان', 'تركي', 'بندر', 'ماجد', 'سالم', 'نايف', 'مشاري', 'عبدالعزيز', 'حمد'];
const lastNamesAr = ['الجريسي', 'العتيبي', 'القحطاني', 'الشمري', 'الدوسري', 'الحربي', 'المطيري', 'الغامدي', 'الزهراني', 'المالكي', 'السبيعي', 'البلوي', 'الرشيدي', 'العنزي', 'الشهراني', 'اليامي', 'الفيفي', 'النعيمي', 'الهاجري', 'المري'];
const firstNamesEn = ['Mohammed', 'Ahmad', 'Abdullah', 'Fahad', 'Khalid', 'Nasser', 'Saud', 'Omar', 'Youssef', 'Ibrahim', 'Abdulrahman', 'Sultan', 'Turki', 'Bandar', 'Majed', 'Salem', 'Naif', 'Mishari', 'Abdulaziz', 'Hamad'];
const lastNamesEn = ['Al-Jeraisy', 'Al-Otaibi', 'Al-Qahtani', 'Al-Shammari', 'Al-Dosari', 'Al-Harbi', 'Al-Mutairi', 'Al-Ghamdi', 'Al-Zahrani', 'Al-Malki', 'Al-Subaie', 'Al-Balawi', 'Al-Rashidi', 'Al-Anazi', 'Al-Shahrani', 'Al-Yami', 'Al-Fifi', 'Al-Nuaimi', 'Al-Hajri', 'Al-Marri'];

const departments = [
    { en: 'Luxury Assembly', ar: 'تجميع فاخر' },
    { en: 'Commercial Installation', ar: 'تركيب تجاري' },
    { en: 'Factory Operations', ar: 'عمليات المصنع' },
    { en: 'Field Technician', ar: 'فني ميداني' },
    { en: 'Quality Control', ar: 'مراقبة الجودة' },
    { en: 'Logistics', ar: 'النقل والإمداد' },
];

const roles = [
    { en: 'Technician', ar: 'فني' },
    { en: 'Senior Technician', ar: 'فني أول' },
    { en: 'Team Lead', ar: 'قائد فريق' },
    { en: 'Supervisor', ar: 'مشرف' },
    { en: 'Installer', ar: 'مُركِّب' },
    { en: 'Specialist', ar: 'أخصائي' },
];

function deriveStatus(hours: number): WorkerStatus {
    if (hours >= 38) return 'overtime';
    if (hours >= 35) return 'overtimeRisk';
    const statuses: WorkerStatus[] = ['active', 'active', 'active', 'idle', 'onBreak', 'offDuty'];
    return statuses[Math.floor(Math.random() * statuses.length)];
}

function generateWorkers(count: number = 500): Worker[] {
    const workers: Worker[] = [];
    for (let i = 0; i < count; i++) {
        const fnIdx = i % firstNamesAr.length;
        const lnIdx = Math.floor(i / firstNamesAr.length) % lastNamesAr.length;
        const dept = departments[i % departments.length];
        const role = roles[i % roles.length];
        const hoursWorked = Math.round((Math.random() * 42 + 2) * 10) / 10;
        const capped = Math.min(hoursWorked, 44);
        workers.push({
            id: 1000 + i,
            nameAr: `${firstNamesAr[fnIdx]} ${lastNamesAr[lnIdx]}`,
            nameEn: `${firstNamesEn[fnIdx]} ${lastNamesEn[lnIdx]}`,
            department: dept.en,
            departmentAr: dept.ar,
            role: role.en,
            roleAr: role.ar,
            hoursWorked: capped,
            weeklyLimit: 38,
            status: deriveStatus(capped),
            site: i % 3 === 0 ? 'jeddah' : 'riyadh',
            isSaudi: true,
            punchedIn: false,
            punchInTime: null,
            assignedWorkOrder: null,
        });
    }
    return workers;
}

// ── Initial State ─────────────────────────────────────────────
const initialState: GlobalState = {
    workers: generateWorkers(500),
    workOrders: [],
    skuMapping: [],
    punchEvents: [],
    syncQueueEntries: [],
    notifications: [],
    thresholds: {
        geofenceRadiusKm: 0.05,
        overtimeHoursLimit: 38,
    },
    connection: {
        oracle: false,
        gps: false,
        online: navigator.onLine,
    },
    lastSync: new Date().toISOString(),
    isLoading: true,
    error: null,
};

// ── Reducer ───────────────────────────────────────────────────
function globalReducer(state: GlobalState, action: GlobalAction): GlobalState {
    switch (action.type) {
        case 'WORKERS_LOADED':
            return { ...state, workers: action.payload, isLoading: false };

        case 'WORKER_STATUS_UPDATED': {
            const { id, status, hoursWorked } = action.payload;
            return {
                ...state,
                workers: state.workers.map((w) =>
                    w.id === id ? { ...w, status, hoursWorked } : w
                ),
            };
        }

        case 'WORKER_PUNCH_IN': {
            const { workerId, timestamp, workOrderId } = action.payload;
            return {
                ...state,
                workers: state.workers.map((w) =>
                    w.id === workerId
                        ? {
                            ...w,
                            punchedIn: true,
                            punchInTime: timestamp,
                            status: 'active' as WorkerStatus,
                            assignedWorkOrder: workOrderId,
                        }
                        : w
                ),
            };
        }

        case 'WORKER_PUNCH_OUT': {
            const { workerId, hoursLogged } = action.payload;
            return {
                ...state,
                workers: state.workers.map((w) => {
                    if (w.id !== workerId) return w;
                    const newHours = w.hoursWorked + hoursLogged;
                    return {
                        ...w,
                        punchedIn: false,
                        punchInTime: null,
                        hoursWorked: Math.round(newHours * 10) / 10,
                        status: deriveStatus(newHours),
                        assignedWorkOrder: null,
                    };
                }),
            };
        }

        case 'WORK_ORDERS_LOADED':
            return { ...state, workOrders: action.payload, isLoading: false };

        case 'WORK_ORDER_SYNCED': {
            const { id, status, lastSync } = action.payload;
            return {
                ...state,
                workOrders: state.workOrders.map((wo) =>
                    wo.id === id ? { ...wo, status, lastSync } : wo
                ),
                lastSync,
            };
        }

        case 'SKU_MAPPING_LOADED':
            return { ...state, skuMapping: action.payload };

        case 'PUNCH_EVENT_ADDED':
            return {
                ...state,
                punchEvents: [action.payload, ...state.punchEvents].slice(0, 200),
            };

        case 'QUEUE_OPERATION':
            return {
                ...state,
                syncQueueEntries: [...state.syncQueueEntries, action.payload],
            };

        case 'QUEUE_ENTRY_UPDATED':
            return {
                ...state,
                syncQueueEntries: state.syncQueueEntries.map((e) =>
                    e.id === action.payload.id
                        ? { ...e, status: action.payload.status, errorMessage: action.payload.errorMessage }
                        : e
                ),
            };

        case 'FLUSH_QUEUE_COMPLETED':
            return {
                ...state,
                syncQueueEntries: state.syncQueueEntries.filter(
                    (e) => !action.payload.includes(e.id)
                ),
            };

        case 'CONNECTION_CHANGED':
            return {
                ...state,
                connection: { ...state.connection, ...action.payload },
            };

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload };

        case 'SYNC_TIMESTAMP_UPDATED':
            return { ...state, lastSync: action.payload };

        case 'NOTIFICATION_ADDED':
            return {
                ...state,
                notifications: [action.payload, ...state.notifications].slice(0, 50),
            };

        case 'NOTIFICATIONS_CLEARED':
            return { ...state, notifications: [] };

        case 'OVERTIME_BREACH_SIMULATED': {
            // Push specified worker IDs past 38h immediately
            const breachedIds = new Set(action.payload);
            return {
                ...state,
                workers: state.workers.map((w) =>
                    breachedIds.has(w.id)
                        ? { ...w, hoursWorked: 40 + Math.round(Math.random() * 30) / 10, status: 'overtime' as WorkerStatus }
                        : w
                ),
            };
        }

        case 'THRESHOLD_UPDATED':
            return {
                ...state,
                thresholds: { ...state.thresholds, ...action.payload },
            };

        default:
            return state;
    }
}

// ── Helper: compute summary stats from workers ────────────────
export function getWorkforceSummary(workers: Worker[]) {
    const active = workers.filter((w) => w.status === 'active').length;
    const idle = workers.filter((w) => w.status === 'idle').length;
    const onBreak = workers.filter((w) => w.status === 'onBreak').length;
    const overtimeRisk = workers.filter((w) => w.status === 'overtimeRisk').length;
    const overtime = workers.filter((w) => w.status === 'overtime').length;
    const offDuty = workers.filter((w) => w.status === 'offDuty').length;
    const avgHours = workers.reduce((sum, w) => sum + w.hoursWorked, 0) / workers.length;
    const saudiCount = workers.filter((w) => w.isSaudi).length;

    return {
        total: workers.length,
        active,
        idle,
        onBreak,
        overtimeRisk,
        overtime,
        offDuty,
        avgHours: Math.round(avgHours * 10) / 10,
        saudizationRate: Math.round((saudiCount / workers.length) * 100),
    };
}

/**
 * Overtime Guardrail: checks if a worker can accept a new WO
 * Returns false if the worker is at or above 38h (Saudi Labor Law limit)
 */
export function canAcceptWorkOrder(worker: Worker, estimatedHours: number): boolean {
    return (worker.hoursWorked + estimatedHours) < 38 && worker.status !== 'overtime';
}

// ── Context ───────────────────────────────────────────────────
interface GlobalStoreContextType {
    state: GlobalState;
    dispatch: React.Dispatch<GlobalAction>;
    /** Convenience: punch in a worker and update state */
    punchIn: (workerId: number, site: 'riyadh' | 'jeddah', coords: { lat: number; lng: number }, workOrderId?: string) => void;
    /** Convenience: punch out a worker and compute hours logged */
    punchOut: (workerId: number, site: 'riyadh' | 'jeddah', coords: { lat: number; lng: number }) => void;
    /** Convenience: refresh work orders from Oracle */
    refreshWorkOrders: () => Promise<void>;
    /** Convenience: refresh SKU mapping from Oracle */
    refreshSkuMapping: () => Promise<void>;
    /** Simulate 5 workers breaching 38h — fires critical notification */
    simulateOvertimeBreach: () => void;
    /** Clear all notifications */
    clearNotifications: () => void;
    /** Update system thresholds */
    updateThresholds: (config: Partial<ThresholdConfig>) => void;
}

const GlobalStoreContext = createContext<GlobalStoreContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────
export function GlobalStoreProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(globalReducer, initialState);
    const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Bootstrap: fetch initial data ─────────────────────────
    useEffect(() => {
        async function init() {
            dispatch({ type: 'SET_LOADING', payload: true });

            // Fetch Work Orders (falls back to seed data)
            const workOrders = await OracleConnector.fetchWorkOrders();
            dispatch({ type: 'WORK_ORDERS_LOADED', payload: workOrders });

            // Fetch SKU mapping (falls back to hardcoded map)
            const skuMapping = await OracleConnector.fetchSkuMapping();
            dispatch({ type: 'SKU_MAPPING_LOADED', payload: skuMapping });

            // Check Oracle health
            const oracleAlive = await OracleConnector.healthCheck();
            dispatch({ type: 'CONNECTION_CHANGED', payload: { oracle: oracleAlive } });

            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SYNC_TIMESTAMP_UPDATED', payload: new Date().toISOString() });
        }
        init();
    }, []);

    // ── Real-time tick: increment hours for punched-in workers ─
    useEffect(() => {
        tickInterval.current = setInterval(() => {
            const now = Date.now();
            state.workers.forEach((w) => {
                if (w.punchedIn && w.punchInTime) {
                    const elapsed = (now - new Date(w.punchInTime).getTime()) / 3600000; // hours
                    const newHours = w.hoursWorked + elapsed;
                    const newStatus = deriveStatus(newHours);
                    if (newStatus !== w.status) {
                        dispatch({
                            type: 'WORKER_STATUS_UPDATED',
                            payload: { id: w.id, status: newStatus, hoursWorked: Math.round(newHours * 10) / 10 },
                        });
                    }
                }
            });
        }, 10000); // Check every 10 seconds

        return () => {
            if (tickInterval.current) clearInterval(tickInterval.current);
        };
    }, [state.workers]);

    // ── Network status listener ───────────────────────────────
    useEffect(() => {
        const handleOnline = () => dispatch({ type: 'CONNECTION_CHANGED', payload: { online: true } });
        const handleOffline = () => dispatch({ type: 'CONNECTION_CHANGED', payload: { online: false } });
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ── Convenience Methods ───────────────────────────────────
    const punchIn = useCallback((
        workerId: number,
        site: 'riyadh' | 'jeddah',
        coords: { lat: number; lng: number },
        workOrderId?: string,
    ) => {
        const timestamp = new Date().toISOString();
        const worker = state.workers.find((w) => w.id === workerId);
        if (!worker) return;

        // Dispatch state update
        dispatch({
            type: 'WORKER_PUNCH_IN',
            payload: { workerId, timestamp, workOrderId: workOrderId || null },
        });

        // Record punch event
        const event: PunchEvent = {
            id: `PE-${Date.now()}`,
            workerId,
            workerNameAr: worker.nameAr,
            workerNameEn: worker.nameEn,
            type: 'in',
            timestamp,
            site,
            coords,
            workOrderId: workOrderId || null,
            synced: navigator.onLine,
        };
        dispatch({ type: 'PUNCH_EVENT_ADDED', payload: event });
    }, [state.workers]);

    const punchOut = useCallback((
        workerId: number,
        site: 'riyadh' | 'jeddah',
        coords: { lat: number; lng: number },
    ) => {
        const timestamp = new Date().toISOString();
        const worker = state.workers.find((w) => w.id === workerId);
        if (!worker || !worker.punchInTime) return;

        // Calculate hours logged this session
        const hoursLogged = (Date.now() - new Date(worker.punchInTime).getTime()) / 3600000;

        dispatch({
            type: 'WORKER_PUNCH_OUT',
            payload: { workerId, timestamp, hoursLogged: Math.round(hoursLogged * 100) / 100 },
        });

        // Record punch event
        const event: PunchEvent = {
            id: `PE-${Date.now()}`,
            workerId,
            workerNameAr: worker.nameAr,
            workerNameEn: worker.nameEn,
            type: 'out',
            timestamp,
            site,
            coords,
            workOrderId: worker.assignedWorkOrder,
            synced: navigator.onLine,
        };
        dispatch({ type: 'PUNCH_EVENT_ADDED', payload: event });
    }, [state.workers]);

    const refreshWorkOrders = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        const workOrders = await OracleConnector.fetchWorkOrders();
        dispatch({ type: 'WORK_ORDERS_LOADED', payload: workOrders });
        dispatch({ type: 'SYNC_TIMESTAMP_UPDATED', payload: new Date().toISOString() });
    }, []);

    const refreshSkuMapping = useCallback(async () => {
        const skuMapping = await OracleConnector.fetchSkuMapping();
        dispatch({ type: 'SKU_MAPPING_LOADED', payload: skuMapping });
    }, []);

    const simulateOvertimeBreach = useCallback(() => {
        // Pick the first 5 workers that are currently < 38h and push them over
        const eligibleWorkers = state.workers.filter(w => w.hoursWorked < 38).slice(0, 5);
        const breachedIds = eligibleWorkers.map(w => w.id);

        // 1. Breach the workers in state
        dispatch({ type: 'OVERTIME_BREACH_SIMULATED', payload: breachedIds });

        // 2. Fire critical notification to executive tray
        const names = eligibleWorkers.map(w => w.nameAr).join('، ');
        const namesEn = eligibleWorkers.map(w => w.nameEn).join(', ');
        const notification: Notification = {
            id: `NOTIF-OT-${Date.now()}`,
            titleAr: '🚨 تنبيه عمل إضافي حرج',
            titleEn: '🚨 CRITICAL Overtime Alert',
            messageAr: `تجاوز 5 عمال حد الـ 38 ساعة: ${names}. تم إرسال تنبيه عالي الأولوية إلى Oracle CRM.`,
            messageEn: `5 workers breached the 38h limit: ${namesEn}. High-priority alert sent to Oracle CRM.`,
            priority: 'critical',
            timestamp: new Date().toISOString(),
            read: false,
            source: 'overtime',
        };
        dispatch({ type: 'NOTIFICATION_ADDED', payload: notification });

        // 3. Send high-priority Oracle alert (async, non-blocking)
        OracleConnector.syncWorkOrder('WO-2026-002', {
            status: 'inProgress',
            actualHours: 85,
        }).then(() => {
            console.log('[OracleConnector] Overtime risk alert sent to Oracle CRM');
        });

        console.log(`[GlobalStore] OVERTIME BREACH SIMULATED: Workers ${breachedIds.join(', ')} now at 40+ hours`);
    }, [state.workers]);

    const clearNotifications = useCallback(() => {
        dispatch({ type: 'NOTIFICATIONS_CLEARED' });
    }, []);

    const updateThresholds = useCallback((config: Partial<ThresholdConfig>) => {
        dispatch({ type: 'THRESHOLD_UPDATED', payload: config });
    }, []);

    return (
        <GlobalStoreContext.Provider value={{
            state,
            dispatch,
            punchIn,
            punchOut,
            refreshWorkOrders,
            refreshSkuMapping,
            simulateOvertimeBreach,
            clearNotifications,
            updateThresholds,
        }}>
            {children}
        </GlobalStoreContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────
export function useGlobalStore(): GlobalStoreContextType {
    const context = useContext(GlobalStoreContext);
    if (!context) {
        throw new Error('useGlobalStore must be used within a <GlobalStoreProvider>');
    }
    return context;
}

export default GlobalStoreProvider;
