import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ShieldCheck, AlertTriangle, MapPin, Clock, FileText, Download,
    CheckCircle2, XCircle, Filter, Search, Shield, Building2,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import './Compliance.css';

// ── Violation Types ───────────────────────────────────────────
type ViolationType = 'overtime_breach' | 'geofence_violation' | 'unauthorized_punch' | 'wps_discrepancy';
type AuthStatus = 'system_blocked' | 'director_approved' | 'pending_review' | 'auto_resolved';

interface ViolationRecord {
    id: string;
    timestamp: string;
    type: ViolationType;
    workerId: number;
    workerNameAr: string;
    workerNameEn: string;
    details: string;
    detailsAr: string;
    authStatus: AuthStatus;
    site: 'RUH' | 'JED';
}

interface WpsSyncRecord {
    id: string;
    month: string;
    submittedAt: string;
    totalWorkers: number;
    totalWages: number;
    status: 'submitted' | 'accepted' | 'rejected' | 'pending';
    mhrsdRef: string;
}

// ── Seed Violation Data ───────────────────────────────────────
function generateViolations(workerCount: number): ViolationRecord[] {
    const names = [
        { ar: 'حمد الجريسي', en: 'Hamad Al-Jeraisy' },
        { ar: 'سعد الدوسري', en: 'Saad Al-Dosari' },
        { ar: 'ناصر العتيبي', en: 'Nasser Al-Otaibi' },
        { ar: 'فهد القحطاني', en: 'Fahd Al-Qahtani' },
        { ar: 'عبدالله الشمري', en: 'Abdullah Al-Shammari' },
        { ar: 'يوسف الحربي', en: 'Youssef Al-Harbi' },
        { ar: 'خالد المطيري', en: 'Khalid Al-Mutairi' },
        { ar: 'إبراهيم الغامدي', en: 'Ibrahim Al-Ghamdi' },
        { ar: 'محمد السبيعي', en: 'Mohammad Al-Subai' },
        { ar: 'أحمد الزهراني', en: 'Ahmed Al-Zahrani' },
    ];

    const types: ViolationType[] = ['overtime_breach', 'geofence_violation', 'unauthorized_punch', 'wps_discrepancy'];
    const statuses: AuthStatus[] = ['system_blocked', 'director_approved', 'pending_review', 'auto_resolved'];
    const sites: ('RUH' | 'JED')[] = ['RUH', 'JED'];

    return Array.from({ length: Math.min(workerCount, 18) }, (_, i) => {
        const name = names[i % names.length];
        const type = types[i % types.length];
        const auth = statuses[i % statuses.length];
        const site = sites[i % 2];
        const id = 1000 + i * 3;
        const day = (i % 28) + 1;

        const detailsMap = {
            overtime_breach: { en: `Exceeded 38h weekly limit (${39 + (i % 5)}h logged)`, ar: `تجاوز حد 38 ساعة أسبوعياً (${39 + (i % 5)} ساعة مسجلة)` },
            geofence_violation: { en: `Punch detected ${120 + i * 30}m outside facility perimeter`, ar: `تسجيل حضور على بعد ${120 + i * 30}م من نطاق المنشأة` },
            unauthorized_punch: { en: 'Punch attempt without active work order assignment', ar: 'محاولة تسجيل حضور بدون أمر عمل مفعل' },
            wps_discrepancy: { en: `Wage record mismatch: SAR ${(1200 + i * 50).toLocaleString()} vs logged hours`, ar: `تباين في سجل الأجور: ${(1200 + i * 50).toLocaleString()} ر.س مقابل الساعات المسجلة` },
        };

        return {
            id: `VIO-2026-${(i + 1).toString().padStart(3, '0')}`,
            timestamp: `2026-03-${day.toString().padStart(2, '0')}T${(8 + (i % 10)).toString().padStart(2, '0')}:${(i * 7 % 60).toString().padStart(2, '0')}:00`,
            type,
            workerId: id,
            workerNameAr: name.ar,
            workerNameEn: name.en,
            details: detailsMap[type].en,
            detailsAr: detailsMap[type].ar,
            authStatus: auth,
            site,
        };
    });
}

const WPS_HISTORY: WpsSyncRecord[] = [
    { id: 'WPS-2026-03', month: '2026-03', submittedAt: '2026-03-01T08:00:00', totalWorkers: 500, totalWages: 2850000, status: 'pending', mhrsdRef: 'MHRSD-RUH-2026-03-001' },
    { id: 'WPS-2026-02', month: '2026-02', submittedAt: '2026-02-28T08:00:00', totalWorkers: 498, totalWages: 2790000, status: 'accepted', mhrsdRef: 'MHRSD-RUH-2026-02-001' },
    { id: 'WPS-2026-01', month: '2026-01', submittedAt: '2026-01-31T08:00:00', totalWorkers: 492, totalWages: 2715000, status: 'accepted', mhrsdRef: 'MHRSD-RUH-2026-01-001' },
    { id: 'WPS-2025-12', month: '2025-12', submittedAt: '2025-12-31T08:00:00', totalWorkers: 488, totalWages: 2680000, status: 'accepted', mhrsdRef: 'MHRSD-RUH-2025-12-001' },
    { id: 'WPS-2025-11', month: '2025-11', submittedAt: '2025-11-30T08:00:00', totalWorkers: 485, totalWages: 2640000, status: 'rejected', mhrsdRef: 'MHRSD-RUH-2025-11-001' },
];

type ViolationFilter = 'all' | ViolationType;

export default function Compliance() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();

    const [filter, setFilter] = useState<ViolationFilter>('all');
    const [search, setSearch] = useState('');

    const violations = useMemo(() => generateViolations(state.workers.length), [state.workers.length]);

    const saudizationRate = useMemo(() => {
        const saudiWorkers = state.workers.filter(w => w.isSaudi !== false).length;
        return state.workers.length > 0 ? Math.round((saudiWorkers / state.workers.length) * 100) : 0;
    }, [state.workers]);

    const filtered = useMemo(() => {
        let list = violations;
        if (filter !== 'all') list = list.filter(v => v.type === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(v =>
                v.workerNameEn.toLowerCase().includes(q) ||
                v.workerNameAr.includes(q) ||
                v.id.toLowerCase().includes(q) ||
                v.workerId.toString().includes(q)
            );
        }
        return list;
    }, [violations, filter, search]);

    const typeConfig: Record<ViolationType, { icon: React.ReactNode; labelAr: string; labelEn: string; colorClass: string }> = {
        overtime_breach: { icon: <Clock size={14} />, labelAr: 'تجاوز عمل إضافي', labelEn: '38h OT Breach', colorClass: 'compliance__type--ot' },
        geofence_violation: { icon: <MapPin size={14} />, labelAr: 'مخالفة نطاق جغرافي', labelEn: 'Geofence Violation', colorClass: 'compliance__type--geo' },
        unauthorized_punch: { icon: <XCircle size={14} />, labelAr: 'تسجيل غير مصرح', labelEn: 'Unauthorized Punch', colorClass: 'compliance__type--unauth' },
        wps_discrepancy: { icon: <AlertTriangle size={14} />, labelAr: 'تباين نظام حماية الأجور', labelEn: 'WPS Discrepancy', colorClass: 'compliance__type--wps' },
    };

    const authConfig: Record<AuthStatus, { labelAr: string; labelEn: string; colorClass: string }> = {
        system_blocked: { labelAr: 'تم الحظر تلقائياً', labelEn: 'System Blocked', colorClass: 'compliance__auth--blocked' },
        director_approved: { labelAr: 'موافقة المدير', labelEn: 'Director Approved', colorClass: 'compliance__auth--approved' },
        pending_review: { labelAr: 'قيد المراجعة', labelEn: 'Pending Review', colorClass: 'compliance__auth--pending' },
        auto_resolved: { labelAr: 'تمت المعالجة تلقائياً', labelEn: 'Auto-Resolved', colorClass: 'compliance__auth--resolved' },
    };

    const wpsStatusConfig: Record<string, { labelAr: string; labelEn: string; colorClass: string }> = {
        submitted: { labelAr: 'تم التقديم', labelEn: 'Submitted', colorClass: 'compliance__wps-status--submitted' },
        accepted: { labelAr: 'مقبول', labelEn: 'Accepted', colorClass: 'compliance__wps-status--accepted' },
        rejected: { labelAr: 'مرفوض', labelEn: 'Rejected', colorClass: 'compliance__wps-status--rejected' },
        pending: { labelAr: 'قيد المعالجة', labelEn: 'Pending', colorClass: 'compliance__wps-status--pending' },
    };

    const filterTabs: { key: ViolationFilter; labelAr: string; labelEn: string }[] = [
        { key: 'all', labelAr: 'الكل', labelEn: 'All' },
        { key: 'overtime_breach', labelAr: 'عمل إضافي', labelEn: 'Overtime' },
        { key: 'geofence_violation', labelAr: 'نطاق جغرافي', labelEn: 'Geofence' },
        { key: 'unauthorized_punch', labelAr: 'غير مصرح', labelEn: 'Unauthorized' },
        { key: 'wps_discrepancy', labelAr: 'حماية أجور', labelEn: 'WPS' },
    ];

    const handleExportSaudization = () => {
        const content = [
            `# Saudization Certificate — AXON`,
            `Date: ${new Date().toISOString().split('T')[0]}`,
            `Total Workforce: ${state.workers.length}`,
            `Saudi Nationals: ${state.workers.filter(w => w.isSaudi !== false).length}`,
            `Saudization Rate: ${saudizationRate}%`,
            `Status: COMPLIANT (Nitaqat Platinum)`,
            `\nCertified by: AXON — Orchestrating Field Excellence v1.0.0`,
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saudization-certificate-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportAuditLog = () => {
        const rows = violations.map(v => [
            v.id, v.timestamp, v.type, v.workerId, v.workerNameEn, v.details, v.authStatus, v.site,
        ].join('\t'));
        const header = 'ID\tTimestamp\tType\tWorker ID\tWorker Name\tDetails\tAuth Status\tSite';
        const content = [header, ...rows].join('\n');
        const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mhrsd-audit-log-${new Date().toISOString().split('T')[0]}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="compliance">
            {/* Header */}
            <div className="compliance__header">
                <ShieldCheck size={28} />
                <div>
                    <h1 className="compliance__title">
                        {isAr ? 'الامتثال والحوكمة' : 'Compliance & Governance'}
                    </h1>
                    <p className="compliance__subtitle">
                        {isAr ? 'سجل المخالفات — نظام حماية الأجور — شهادة السعودة' : 'Violation Ledger — WPS Governance — Saudization Certificate'}
                    </p>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="compliance__kpi-strip">
                <div className="compliance__kpi">
                    <span className="compliance__kpi-value compliance__kpi-value--red">{violations.length}</span>
                    <span className="compliance__kpi-label">{isAr ? 'إجمالي المخالفات' : 'Total Violations'}</span>
                </div>
                <div className="compliance__kpi">
                    <span className="compliance__kpi-value compliance__kpi-value--amber">
                        {violations.filter(v => v.authStatus === 'system_blocked').length}
                    </span>
                    <span className="compliance__kpi-label">{isAr ? 'تم الحظر تلقائياً' : 'System Blocked'}</span>
                </div>
                <div className="compliance__kpi">
                    <span className="compliance__kpi-value compliance__kpi-value--green">
                        {violations.filter(v => v.authStatus === 'director_approved').length}
                    </span>
                    <span className="compliance__kpi-label">{isAr ? 'موافقة المدير' : 'Director Approved'}</span>
                </div>
                <div className="compliance__kpi">
                    <span className="compliance__kpi-value compliance__kpi-value--blue">{saudizationRate}%</span>
                    <span className="compliance__kpi-label">{isAr ? 'نسبة السعودة' : 'Saudization Rate'}</span>
                </div>
            </div>

            {/* ═══════ SECTION 1: VIOLATION LEDGER ═══════ */}
            <div className="compliance__section">
                <div className="compliance__section-header">
                    <AlertTriangle size={20} />
                    <h2>{isAr ? 'سجل المخالفات' : 'Violation Ledger'}</h2>
                </div>

                {/* Filters + Search */}
                <div className="compliance__toolbar">
                    <div className="compliance__filter-tabs">
                        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                        {filterTabs.map(tab => (
                            <button
                                key={tab.key}
                                className={`compliance__filter-tab ${filter === tab.key ? 'compliance__filter-tab--active' : ''}`}
                                onClick={() => setFilter(tab.key)}
                            >
                                {isAr ? tab.labelAr : tab.labelEn}
                            </button>
                        ))}
                    </div>
                    <div className="compliance__search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder={isAr ? 'بحث بالاسم أو المعرف...' : 'Search by name or ID...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Violation Table */}
                <div className="compliance__table-wrap">
                    <table className="compliance__table">
                        <thead>
                            <tr>
                                <th>{isAr ? 'المعرف' : 'ID'}</th>
                                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                                <th>{isAr ? 'نوع المخالفة' : 'Event Type'}</th>
                                <th>{isAr ? 'الموظف' : 'Employee'}</th>
                                <th>{isAr ? 'الموقع' : 'Site'}</th>
                                <th>{isAr ? 'التفاصيل' : 'Details'}</th>
                                <th>{isAr ? 'حالة التفويض' : 'Authorization'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(v => {
                                const tc = typeConfig[v.type];
                                const ac = authConfig[v.authStatus];
                                return (
                                    <tr key={v.id}>
                                        <td className="compliance__cell-id">{v.id}</td>
                                        <td className="compliance__cell-date">
                                            {new Date(v.timestamp).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td>
                                            <span className={`compliance__type-badge ${tc.colorClass}`}>
                                                {tc.icon} {isAr ? tc.labelAr : tc.labelEn}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="compliance__worker-cell">
                                                <span className="compliance__worker-name">{isAr ? v.workerNameAr : v.workerNameEn}</span>
                                                <span className="compliance__worker-id">ID: {v.workerId}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="compliance__site-badge">
                                                <Building2 size={11} /> {v.site}
                                            </span>
                                        </td>
                                        <td className="compliance__cell-details">
                                            {isAr ? v.detailsAr : v.details}
                                        </td>
                                        <td>
                                            <span className={`compliance__auth-badge ${ac.colorClass}`}>
                                                {isAr ? ac.labelAr : ac.labelEn}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="compliance__table-footer">
                    {isAr ? `عرض ${filtered.length} من ${violations.length} سجل` : `Showing ${filtered.length} of ${violations.length} records`}
                </div>
            </div>

            {/* ═══════ SECTION 2: WPS GOVERNANCE ═══════ */}
            <div className="compliance__section">
                <div className="compliance__section-header">
                    <Shield size={20} />
                    <h2>{isAr ? 'حوكمة نظام حماية الأجور (WPS)' : 'Wage Protection System (WPS) Governance'}</h2>
                </div>

                <div className="compliance__wps-table-wrap">
                    <table className="compliance__table compliance__table--wps">
                        <thead>
                            <tr>
                                <th>{isAr ? 'الشهر' : 'Month'}</th>
                                <th>{isAr ? 'تاريخ التقديم' : 'Submitted'}</th>
                                <th>{isAr ? 'عدد العمال' : 'Workers'}</th>
                                <th>{isAr ? 'إجمالي الأجور' : 'Total Wages'}</th>
                                <th>{isAr ? 'مرجع MHRSD' : 'MHRSD Ref'}</th>
                                <th>{isAr ? 'الحالة' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {WPS_HISTORY.map(record => {
                                const sc = wpsStatusConfig[record.status];
                                return (
                                    <tr key={record.id}>
                                        <td className="compliance__cell-month">
                                            {new Date(record.month + '-01').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                                        </td>
                                        <td className="compliance__cell-date">
                                            {new Date(record.submittedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                                        </td>
                                        <td>{record.totalWorkers}</td>
                                        <td className="compliance__cell-wages">
                                            {isAr ? `${record.totalWages.toLocaleString('ar-SA')} ر.س` : `SAR ${record.totalWages.toLocaleString()}`}
                                        </td>
                                        <td className="compliance__cell-ref">{record.mhrsdRef}</td>
                                        <td>
                                            <span className={`compliance__wps-badge ${sc.colorClass}`}>
                                                {record.status === 'accepted' && <CheckCircle2 size={12} />}
                                                {record.status === 'rejected' && <XCircle size={12} />}
                                                {isAr ? sc.labelAr : sc.labelEn}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════ SECTION 3: REPORT EXPORTS ═══════ */}
            <div className="compliance__export-bar">
                <button className="compliance__export-btn compliance__export-btn--saudization" onClick={handleExportSaudization}>
                    <FileText size={16} />
                    {isAr ? 'تصدير شهادة السعودة' : 'Export Saudization Certificate'}
                </button>
                <button className="compliance__export-btn compliance__export-btn--audit" onClick={handleExportAuditLog}>
                    <Download size={16} />
                    {isAr ? 'تحميل سجل تدقيق MHRSD' : 'Download MHRSD Audit Log'}
                </button>
            </div>
        </div>
    );
}
