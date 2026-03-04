import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Server, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import SyncQueue from '../../services/SyncQueue';
import './OracleBridge.css';

export default function OracleBridge() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state, refreshWorkOrders } = useGlobalStore();
    const [syncing, setSyncing] = useState(false);
    const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0 });

    const handleSync = async () => {
        setSyncing(true);
        await refreshWorkOrders();
        // Also check sync queue stats
        const stats = await SyncQueue.getStats();
        setQueueStats(stats);
        setSyncing(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'synced': return 'badge badge--green';
            case 'inProgress': return 'badge badge--amber';
            case 'pending': return 'badge';
            case 'completed': return 'badge badge--green';
            default: return 'badge';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, { ar: string; en: string }> = {
            synced: { ar: 'متزامن', en: 'Synced' },
            inProgress: { ar: 'قيد التنفيذ', en: 'In Progress' },
            pending: { ar: 'معلق', en: 'Pending' },
            completed: { ar: 'مكتمل', en: 'Completed' },
        };
        return isAr ? labels[status]?.ar : labels[status]?.en;
    };

    const formatSyncTime = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleString(isAr ? 'ar-SA' : 'en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
        } catch {
            return iso;
        }
    };

    return (
        <div className="oracle-bridge">
            <div className="oracle-bridge__header">
                <h1 className="oracle-bridge__title">{t('oracle.title')}</h1>
                <p className="oracle-bridge__subtitle">{t('oracle.subtitle')}</p>
            </div>

            {/* Connection Status */}
            <div className="oracle-bridge__status-bar">
                <div className="oracle-bridge__connection">
                    <div className={`oracle-bridge__connection-dot ${state.connection.oracle ? '' : 'oracle-bridge__connection-dot--offline'}`} />
                    <span className="oracle-bridge__connection-label">
                        {t('oracle.connectionStatus')}: {state.connection.oracle ? t('oracle.connected') : (isAr ? 'غير متصل — وضع المحاكاة' : 'Disconnected — Fallback Mode')}
                    </span>
                    {state.connection.online ? (
                        <Wifi size={14} style={{ color: 'var(--status-green)', marginInlineStart: '8px' }} />
                    ) : (
                        <WifiOff size={14} style={{ color: 'var(--status-red)', marginInlineStart: '8px' }} />
                    )}
                </div>
                <span className="oracle-bridge__sync-time">
                    {t('oracle.lastSync')}: {formatSyncTime(state.lastSync)}
                </span>
                <button
                    className="oracle-bridge__sync-btn"
                    onClick={handleSync}
                    disabled={syncing}
                >
                    <RefreshCw
                        size={14}
                        style={{
                            verticalAlign: 'middle',
                            marginInlineEnd: '6px',
                            animation: syncing ? 'spin 1s linear infinite' : 'none',
                        }}
                    />
                    {syncing ? t('oracle.syncing') : t('oracle.syncNow')}
                </button>
            </div>

            {/* Offline Queue Status */}
            {queueStats.pending > 0 && (
                <div className="oracle-bridge__queue-alert">
                    <AlertTriangle size={14} />
                    {isAr
                        ? `${queueStats.pending} عملية في قائمة الانتظار — ستتم المزامنة عند الاتصال`
                        : `${queueStats.pending} operations queued — will sync on reconnect`
                    }
                </div>
            )}

            {/* Pipeline Visualization */}
            <div className="oracle-bridge__pipeline">
                <div className="oracle-bridge__node">
                    <div className="oracle-bridge__node-icon oracle-bridge__node-icon--oracle">
                        <Database size={24} />
                    </div>
                    <div className="oracle-bridge__node-title">Oracle CRM</div>
                    <div className="oracle-bridge__node-sub">
                        {isAr ? 'قاعدة بيانات المؤسسة' : 'Enterprise Database'}
                    </div>
                </div>

                <div className="oracle-bridge__arrow">
                    <div className="oracle-bridge__arrow-line oracle-bridge__arrow-line--inbound">
                        {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                        {t('oracle.inbound')}
                    </div>
                    <div className="oracle-bridge__arrow-line oracle-bridge__arrow-line--outbound">
                        {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                        {t('oracle.outbound')}
                    </div>
                </div>

                <div className="oracle-bridge__node">
                    <div className="oracle-bridge__node-icon oracle-bridge__node-icon--engine">
                        <Server size={24} />
                    </div>
                    <div className="oracle-bridge__node-title">
                        {isAr ? 'محرك التنفيذ' : 'Execution Engine'}
                    </div>
                    <div className="oracle-bridge__node-sub">
                        {isAr ? 'الجهاز العصبي الرقمي' : 'Digital Nervous System'}
                    </div>
                </div>
            </div>

            {/* Work Orders Table */}
            <div className="oracle-bridge__table-card">
                <div className="oracle-bridge__table-header">
                    {t('oracle.workOrders')} ({state.workOrders.length})
                    {state.isLoading && <span className="oracle-bridge__loading-dot" />}
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="oracle-bridge__table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>{t('oracle.customer')}</th>
                                <th>{t('oracle.sku')}</th>
                                <th>{t('oracle.site')}</th>
                                <th>{t('oracle.laborHours')}</th>
                                <th>{isAr ? 'الاتجاه' : 'Direction'}</th>
                                <th>{t('oracle.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.workOrders.map((wo) => (
                                <tr key={wo.id}>
                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{wo.id}</td>
                                    <td>{isAr ? wo.customerAr : wo.customerEn}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{wo.sku}</td>
                                    <td>{isAr ? wo.siteAr : wo.siteEn}</td>
                                    <td>
                                        {wo.actualHours !== null
                                            ? `${wo.actualHours} / ${wo.estimatedHours}h`
                                            : `— / ${wo.estimatedHours}h`}
                                    </td>
                                    <td>
                                        <span
                                            className={`oracle-bridge__direction-badge oracle-bridge__direction-badge--${wo.direction}`}
                                        >
                                            {wo.direction === 'inbound' ? (
                                                <>
                                                    {isAr ? <ArrowLeft size={10} /> : <ArrowRight size={10} />}
                                                    {t('oracle.inbound')}
                                                </>
                                            ) : (
                                                <>
                                                    {isAr ? <ArrowRight size={10} /> : <ArrowLeft size={10} />}
                                                    {t('oracle.outbound')}
                                                </>
                                            )}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={getStatusBadge(wo.status)}>
                                            {wo.status === 'synced' && (
                                                <CheckCircle2 size={10} />
                                            )}
                                            {getStatusLabel(wo.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
