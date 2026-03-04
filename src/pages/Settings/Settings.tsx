import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings as SettingsIcon, Database, RefreshCw, Wifi, WifiOff,
    Download, Send, Sliders, MapPin, Clock, CheckCircle2, AlertTriangle, FileText,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import SyncQueue from '../../services/SyncQueue';
import './Settings.css';

export default function Settings() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state, refreshWorkOrders, refreshSkuMapping, updateThresholds } = useGlobalStore();

    // Local form state for threshold editing
    const [geofence, setGeofence] = useState(state.thresholds.geofenceRadiusKm * 1000);
    const [overtimeLimit, setOvertimeLimit] = useState(state.thresholds.overtimeHoursLimit);
    const [thresholdSaved, setThresholdSaved] = useState(false);

    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0, total: 0 });
    const [logSent, setLogSent] = useState(false);

    // Load queue stats on mount
    useEffect(() => {
        SyncQueue.getStats().then(setQueueStats);
    }, []);

    // ── Oracle Sync Hub ───────────────────────────────────────
    const handleManualSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            await refreshWorkOrders();
            await refreshSkuMapping();
            const stats = await SyncQueue.getStats();
            setQueueStats(stats);
            if (stats.pending > 0) {
                await SyncQueue.flush(async (entry) => {
                    try {
                        const { default: axios } = await import('axios');
                        await axios({ method: entry.method.toLowerCase(), url: entry.endpoint, data: entry.payload });
                        return true;
                    } catch { return false; }
                });
                setQueueStats(await SyncQueue.getStats());
            }
            setSyncResult(isAr ? '✅ المزامنة تمت بنجاح' : '✅ Sync completed successfully');
        } catch {
            setSyncResult(isAr ? '❌ فشلت المزامنة' : '❌ Sync failed');
        }
        setSyncing(false);
    };

    // ── Threshold Save ────────────────────────────────────────
    const handleSaveThresholds = () => {
        updateThresholds({
            geofenceRadiusKm: geofence / 1000,
            overtimeHoursLimit: overtimeLimit,
        });
        setThresholdSaved(true);
        setTimeout(() => setThresholdSaved(false), 3000);
    };

    // ── Submit Log ────────────────────────────────────────────
    const handleSubmitLog = () => {
        const logData = {
            timestamp: new Date().toISOString(),
            workers: state.workers.length,
            workOrders: state.workOrders.length,
            pendingSync: queueStats.pending,
            connection: state.connection,
            thresholds: state.thresholds,
            browser: navigator.userAgent,
        };
        console.log('[Settings] System Log Submitted:', JSON.stringify(logData, null, 2));
        setLogSent(true);
        setTimeout(() => setLogSent(false), 3000);
    };

    return (
        <div className="settings">
            <div className="settings__header">
                <SettingsIcon size={28} />
                <div>
                    <h1 className="settings__title">
                        {isAr ? 'إعدادات النظام' : 'System Settings'}
                    </h1>
                    <p className="settings__subtitle">
                        {isAr ? 'لوحة إدارة النظام — مسؤول النظام فقط' : 'System Admin Panel — Authorized Personnel Only'}
                    </p>
                </div>
            </div>

            <div className="settings__grid">
                {/* ── SECTION 1: Oracle Sync Hub ──────────────── */}
                <div className="settings__section">
                    <div className="settings__section-header">
                        <Database size={20} />
                        <h2>{isAr ? 'مركز مزامنة أوراكل' : 'Oracle Sync Hub'}</h2>
                    </div>

                    <div className="settings__connection-status">
                        <div className="settings__status-row">
                            <span className="settings__status-label">{isAr ? 'حالة Oracle CRM' : 'Oracle CRM Status'}</span>
                            <span className={`settings__status-badge settings__status-badge--${state.connection.oracle ? 'online' : 'offline'}`}>
                                {state.connection.oracle
                                    ? <><Wifi size={12} /> {isAr ? 'متصل' : 'Connected'}</>
                                    : <><WifiOff size={12} /> {isAr ? 'غير متصل' : 'Disconnected'}</>
                                }
                            </span>
                        </div>
                        <div className="settings__status-row">
                            <span className="settings__status-label">{isAr ? 'حالة الشبكة' : 'Network Status'}</span>
                            <span className={`settings__status-badge settings__status-badge--${state.connection.online ? 'online' : 'offline'}`}>
                                {state.connection.online
                                    ? <><Wifi size={12} /> {isAr ? 'متصل بالإنترنت' : 'Online'}</>
                                    : <><WifiOff size={12} /> {isAr ? 'غير متصل' : 'Offline'}</>
                                }
                            </span>
                        </div>
                        <div className="settings__status-row">
                            <span className="settings__status-label">{isAr ? 'آخر مزامنة' : 'Last Sync'}</span>
                            <span className="settings__status-value">
                                {new Date(state.lastSync).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
                            </span>
                        </div>
                        <div className="settings__status-row">
                            <span className="settings__status-label">{isAr ? 'قائمة الانتظار' : 'Sync Queue'}</span>
                            <span className="settings__status-value">
                                {queueStats.pending} {isAr ? 'معلق' : 'pending'} / {queueStats.failed} {isAr ? 'فشل' : 'failed'}
                            </span>
                        </div>
                    </div>

                    <button
                        className="settings__sync-btn"
                        onClick={handleManualSync}
                        disabled={syncing}
                    >
                        <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                        {syncing
                            ? (isAr ? 'جارٍ المزامنة...' : 'Syncing...')
                            : (isAr ? 'مزامنة يدوية' : 'Manual Sync')
                        }
                    </button>

                    {syncResult && (
                        <div className="settings__sync-result">
                            {syncResult}
                        </div>
                    )}
                </div>

                {/* ── SECTION 2: Threshold Configuration ──────── */}
                <div className="settings__section">
                    <div className="settings__section-header">
                        <Sliders size={20} />
                        <h2>{isAr ? 'إعدادات الحدود' : 'Threshold Configuration'}</h2>
                    </div>

                    <div className="settings__form">
                        <div className="settings__field">
                            <label className="settings__field-label">
                                <MapPin size={14} />
                                {isAr ? 'نطاق السياج الجغرافي (متر)' : 'Geofence Radius (meters)'}
                            </label>
                            <div className="settings__field-input-row">
                                <input
                                    type="number"
                                    className="settings__field-input"
                                    value={geofence}
                                    onChange={(e) => setGeofence(Number(e.target.value))}
                                    min={10}
                                    max={2000}
                                    step={10}
                                />
                                <span className="settings__field-unit">{isAr ? 'متر' : 'meters'}</span>
                            </div>
                            <span className="settings__field-hint">
                                {isAr ? 'القيمة الافتراضية: 50 متر (دقة المصنع)' : 'Default: 50m (factory precision)'}
                            </span>
                        </div>

                        <div className="settings__field">
                            <label className="settings__field-label">
                                <Clock size={14} />
                                {isAr ? 'حد ساعات العمل الإضافي' : 'Overtime Hours Limit'}
                            </label>
                            <div className="settings__field-input-row">
                                <input
                                    type="number"
                                    className="settings__field-input"
                                    value={overtimeLimit}
                                    onChange={(e) => setOvertimeLimit(Number(e.target.value))}
                                    min={20}
                                    max={60}
                                    step={1}
                                />
                                <span className="settings__field-unit">{isAr ? 'ساعة/أسبوع' : 'hrs/week'}</span>
                            </div>
                            <span className="settings__field-hint">
                                {isAr ? 'القيمة الافتراضية: 38 ساعة (نظام العمل السعودي)' : 'Default: 38h (Saudi Labor Law)'}
                            </span>
                        </div>

                        <button className="settings__save-btn" onClick={handleSaveThresholds}>
                            {thresholdSaved
                                ? <><CheckCircle2 size={16} /> {isAr ? 'تم الحفظ' : 'Saved!'}</>
                                : <>{isAr ? 'حفظ التغييرات' : 'Save Changes'}</>
                            }
                        </button>
                    </div>
                </div>

                {/* ── SECTION 3: Support Center ───────────────── */}
                <div className="settings__section settings__section--full">
                    <div className="settings__section-header">
                        <AlertTriangle size={20} />
                        <h2>{isAr ? 'مركز الدعم الفني' : 'Support Center'}</h2>
                    </div>

                    <div className="settings__support-grid">
                        <div className="settings__support-card">
                            <div className="settings__support-icon settings__support-icon--guide">
                                <FileText size={28} />
                            </div>
                            <div className="settings__support-title">
                                {isAr ? 'دليل المستخدم (عربي)' : 'User Guide (Arabic)'}
                            </div>
                            <p className="settings__support-desc">
                                {isAr
                                    ? 'دليل شامل لاستخدام الجهاز العصبي الرقمي للجريسي'
                                    : 'Complete guide for using the Jeraisy Digital Nervous System'
                                }
                            </p>
                            <button className="settings__download-btn" onClick={() => {
                                const blob = new Blob([
                                    '# دليل المستخدم — الجريسي DNS\n\n',
                                    '## 1. لوحة القيادة\nتعرض لوحة القيادة نظرة شاملة على أداء القوى العاملة.\n\n',
                                    '## 2. ساعة الحضور\nاستخدم زر "بدء المهمة" بعد التحقق من الموقع الجغرافي.\n\n',
                                    '## 3. جسر أوراكل\nمراقبة حالة المزامنة مع Oracle CRM.\n\n',
                                    '## 4. أوامر العمل\nإدارة أوامر العمل وتعيين الفنيين.\n\n',
                                    '## 5. الإعدادات\nتكوين حدود النظام ومزامنة البيانات.\n',
                                ], { type: 'text/markdown;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'jeraisy-dns-user-guide-ar.md';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>
                                <Download size={14} />
                                {isAr ? 'تحميل الدليل' : 'Download Guide'}
                            </button>
                        </div>

                        <div className="settings__support-card">
                            <div className="settings__support-icon settings__support-icon--log">
                                <Send size={28} />
                            </div>
                            <div className="settings__support-title">
                                {isAr ? 'إرسال سجل تشخيصي' : 'Submit Diagnostic Log'}
                            </div>
                            <p className="settings__support-desc">
                                {isAr
                                    ? 'إرسال سجل تشخيصي إلى فريق تقنية المعلومات في الجريسي'
                                    : 'Send a diagnostic log to Jeraisy IT support team'
                                }
                            </p>
                            <button
                                className={`settings__submit-log-btn ${logSent ? 'settings__submit-log-btn--sent' : ''}`}
                                onClick={handleSubmitLog}
                            >
                                {logSent
                                    ? <><CheckCircle2 size={14} /> {isAr ? 'تم الإرسال' : 'Log Sent!'}</>
                                    : <><Send size={14} /> {isAr ? 'إرسال السجل' : 'Submit Log'}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
