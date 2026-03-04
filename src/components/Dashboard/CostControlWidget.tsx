import { useTranslation } from 'react-i18next';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { BranchCode } from '../../store/types';

// ── Monthly Cost Data per Branch ──────────────────────────────
interface CostDataEntry {
    month: string;
    projected: number;
    actual: number;
    logistics: number;
    monthAr: string;
}

const branchCostData: Record<BranchCode | 'all', CostDataEntry[]> = {
    all: [
        { month: 'Jan', projected: 420000, actual: 415000, logistics: 85000, monthAr: 'يناير' },
        { month: 'Feb', projected: 435000, actual: 410000, logistics: 88000, monthAr: 'فبراير' },
        { month: 'Mar', projected: 450000, actual: 398000, logistics: 92000, monthAr: 'مارس' },
        { month: 'Apr', projected: 440000, actual: 385000, logistics: 87000, monthAr: 'أبريل' },
        { month: 'May', projected: 460000, actual: 390000, logistics: 95000, monthAr: 'مايو' },
        { month: 'Jun', projected: 470000, actual: 395000, logistics: 98000, monthAr: 'يونيو' },
        { month: 'Jul', projected: 480000, actual: 400000, logistics: 102000, monthAr: 'يوليو' },
        { month: 'Aug', projected: 475000, actual: 392000, logistics: 96000, monthAr: 'أغسطس' },
        { month: 'Sep', projected: 465000, actual: 388000, logistics: 93000, monthAr: 'سبتمبر' },
        { month: 'Oct', projected: 455000, actual: 380000, logistics: 89000, monthAr: 'أكتوبر' },
        { month: 'Nov', projected: 445000, actual: 375000, logistics: 86000, monthAr: 'نوفمبر' },
        { month: 'Dec', projected: 450000, actual: 370000, logistics: 84000, monthAr: 'ديسمبر' },
    ],
    HQ: [
        { month: 'Jan', projected: 65000, actual: 62000, logistics: 8000, monthAr: 'يناير' },
        { month: 'Feb', projected: 68000, actual: 63000, logistics: 8500, monthAr: 'فبراير' },
        { month: 'Mar', projected: 70000, actual: 61000, logistics: 9000, monthAr: 'مارس' },
        { month: 'Apr', projected: 67000, actual: 59000, logistics: 8200, monthAr: 'أبريل' },
        { month: 'May', projected: 72000, actual: 60000, logistics: 9500, monthAr: 'مايو' },
        { month: 'Jun', projected: 74000, actual: 61000, logistics: 9800, monthAr: 'يونيو' },
        { month: 'Jul', projected: 75000, actual: 62000, logistics: 10000, monthAr: 'يوليو' },
        { month: 'Aug', projected: 73000, actual: 60000, logistics: 9200, monthAr: 'أغسطس' },
        { month: 'Sep', projected: 71000, actual: 59000, logistics: 8800, monthAr: 'سبتمبر' },
        { month: 'Oct', projected: 69000, actual: 57000, logistics: 8400, monthAr: 'أكتوبر' },
        { month: 'Nov', projected: 67000, actual: 56000, logistics: 8100, monthAr: 'نوفمبر' },
        { month: 'Dec', projected: 68000, actual: 55000, logistics: 7800, monthAr: 'ديسمبر' },
    ],
    RUH: [
        { month: 'Jan', projected: 165000, actual: 160000, logistics: 35000, monthAr: 'يناير' },
        { month: 'Feb', projected: 170000, actual: 158000, logistics: 36000, monthAr: 'فبراير' },
        { month: 'Mar', projected: 180000, actual: 155000, logistics: 38000, monthAr: 'مارس' },
        { month: 'Apr', projected: 175000, actual: 150000, logistics: 36000, monthAr: 'أبريل' },
        { month: 'May', projected: 182000, actual: 152000, logistics: 39000, monthAr: 'مايو' },
        { month: 'Jun', projected: 188000, actual: 155000, logistics: 40000, monthAr: 'يونيو' },
        { month: 'Jul', projected: 190000, actual: 158000, logistics: 42000, monthAr: 'يوليو' },
        { month: 'Aug', projected: 185000, actual: 154000, logistics: 39500, monthAr: 'أغسطس' },
        { month: 'Sep', projected: 182000, actual: 152000, logistics: 38000, monthAr: 'سبتمبر' },
        { month: 'Oct', projected: 178000, actual: 148000, logistics: 36500, monthAr: 'أكتوبر' },
        { month: 'Nov', projected: 174000, actual: 145000, logistics: 35000, monthAr: 'نوفمبر' },
        { month: 'Dec', projected: 176000, actual: 143000, logistics: 34500, monthAr: 'ديسمبر' },
    ],
    DMM: [
        { month: 'Jan', projected: 105000, actual: 102000, logistics: 22000, monthAr: 'يناير' },
        { month: 'Feb', projected: 108000, actual: 100000, logistics: 23000, monthAr: 'فبراير' },
        { month: 'Mar', projected: 112000, actual: 98000, logistics: 24000, monthAr: 'مارس' },
        { month: 'Apr', projected: 110000, actual: 96000, logistics: 22500, monthAr: 'أبريل' },
        { month: 'May', projected: 115000, actual: 97000, logistics: 24500, monthAr: 'مايو' },
        { month: 'Jun', projected: 118000, actual: 98000, logistics: 25500, monthAr: 'يونيو' },
        { month: 'Jul', projected: 120000, actual: 100000, logistics: 26000, monthAr: 'يوليو' },
        { month: 'Aug', projected: 117000, actual: 98000, logistics: 25000, monthAr: 'أغسطس' },
        { month: 'Sep', projected: 114000, actual: 97000, logistics: 24000, monthAr: 'سبتمبر' },
        { month: 'Oct', projected: 112000, actual: 95000, logistics: 23000, monthAr: 'أكتوبر' },
        { month: 'Nov', projected: 110000, actual: 94000, logistics: 22500, monthAr: 'نوفمبر' },
        { month: 'Dec', projected: 112000, actual: 93000, logistics: 22000, monthAr: 'ديسمبر' },
    ],
    JED: [
        { month: 'Jan', projected: 95000, actual: 91000, logistics: 20000, monthAr: 'يناير' },
        { month: 'Feb', projected: 98000, actual: 89000, logistics: 20500, monthAr: 'فبراير' },
        { month: 'Mar', projected: 100000, actual: 84000, logistics: 21000, monthAr: 'مارس' },
        { month: 'Apr', projected: 98000, actual: 80000, logistics: 20300, monthAr: 'أبريل' },
        { month: 'May', projected: 102000, actual: 81000, logistics: 22000, monthAr: 'مايو' },
        { month: 'Jun', projected: 105000, actual: 81000, logistics: 22700, monthAr: 'يونيو' },
        { month: 'Jul', projected: 108000, actual: 80000, logistics: 24000, monthAr: 'يوليو' },
        { month: 'Aug', projected: 104000, actual: 80000, logistics: 22300, monthAr: 'أغسطس' },
        { month: 'Sep', projected: 102000, actual: 80000, logistics: 22200, monthAr: 'سبتمبر' },
        { month: 'Oct', projected: 100000, actual: 80000, logistics: 21100, monthAr: 'أكتوبر' },
        { month: 'Nov', projected: 98000, actual: 80000, logistics: 20400, monthAr: 'نوفمبر' },
        { month: 'Dec', projected: 98000, actual: 79000, logistics: 19700, monthAr: 'ديسمبر' },
    ],
};


interface Props {
    branchFilter: BranchCode | 'all';
    onBranchChange: (b: BranchCode | 'all') => void;
}

export default function CostControlWidget({ branchFilter, onBranchChange }: Props) {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';

    const data = branchCostData[branchFilter] || branchCostData.all;
    const totalSaved = data.reduce((sum: number, d: CostDataEntry) => sum + (d.projected - d.actual), 0);

    const branchLabels: Record<BranchCode | 'all', { ar: string; en: string }> = {
        all: { ar: 'جميع الفروع', en: 'All Branches' },
        HQ: { ar: 'المقر', en: 'HQ' },
        RUH: { ar: 'الرياض', en: 'Riyadh' },
        DMM: { ar: 'الدمام', en: 'Dammam' },
        JED: { ar: 'جدة', en: 'Jeddah' },
    };

    return (
        <div className="cost-control glass-panel">
            <div className="cost-control__header">
                <div>
                    <h3 className="cost-control__title">{t('dashboard.costControl')}</h3>
                    <p className="cost-control__subtitle">{t('dashboard.monthlyLaborCost')}</p>
                </div>
                <div className="cost-control__actions">
                    <select
                        className="cost-control__branch-select"
                        value={branchFilter}
                        onChange={e => onBranchChange(e.target.value as BranchCode | 'all')}
                    >
                        {(Object.keys(branchLabels) as Array<BranchCode | 'all'>).map(k => (
                            <option key={k} value={k}>
                                {isAr ? branchLabels[k].ar : branchLabels[k].en}
                            </option>
                        ))}
                    </select>
                    <div className="cost-control__saved">
                        <span className="cost-control__saved-label">
                            {t('dashboard.kpi.costSaved')}
                        </span>
                        <span className="cost-control__saved-value text-gold">
                            {isAr
                                ? `${(totalSaved / 1000).toFixed(0)}K ر.س`
                                : `SAR ${(totalSaved / 1000).toFixed(0)}K`}
                        </span>
                    </div>
                </div>
            </div>

            <div className="cost-control__chart">
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--status-amber)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--status-amber)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--status-green)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--status-green)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--jeraisy-blue)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--jeraisy-blue)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis
                            dataKey={isAr ? 'monthAr' : 'month'}
                            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                            axisLine={{ stroke: 'var(--border-color)' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-family)',
                            }}
                            formatter={(value: number | undefined) =>
                                value != null
                                    ? (isAr ? `${value.toLocaleString()} ر.س` : `SAR ${value.toLocaleString()}`)
                                    : ''
                            }
                        />
                        <Legend
                            formatter={(value: string) =>
                                value === 'projected' ? t('dashboard.projected')
                                    : value === 'actual' ? t('dashboard.actual')
                                        : (isAr ? 'تكاليف النقل' : 'Logistics Costs')
                            }
                        />
                        <Area
                            type="monotone"
                            dataKey="projected"
                            stroke="var(--status-amber)"
                            fillOpacity={1}
                            fill="url(#projGrad)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            stroke="var(--status-green)"
                            fillOpacity={1}
                            fill="url(#actGrad)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="logistics"
                            stroke="var(--jeraisy-blue)"
                            fillOpacity={1}
                            fill="url(#logGrad)"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
