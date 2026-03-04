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

const monthlyData = [
    { month: 'Jan', projected: 420000, actual: 415000, monthAr: 'يناير' },
    { month: 'Feb', projected: 435000, actual: 410000, monthAr: 'فبراير' },
    { month: 'Mar', projected: 450000, actual: 398000, monthAr: 'مارس' },
    { month: 'Apr', projected: 440000, actual: 385000, monthAr: 'أبريل' },
    { month: 'May', projected: 460000, actual: 390000, monthAr: 'مايو' },
    { month: 'Jun', projected: 470000, actual: 395000, monthAr: 'يونيو' },
    { month: 'Jul', projected: 480000, actual: 400000, monthAr: 'يوليو' },
    { month: 'Aug', projected: 475000, actual: 392000, monthAr: 'أغسطس' },
    { month: 'Sep', projected: 465000, actual: 388000, monthAr: 'سبتمبر' },
    { month: 'Oct', projected: 455000, actual: 380000, monthAr: 'أكتوبر' },
    { month: 'Nov', projected: 445000, actual: 375000, monthAr: 'نوفمبر' },
    { month: 'Dec', projected: 450000, actual: 370000, monthAr: 'ديسمبر' },
];

export default function CostControlWidget() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';

    const totalSaved = monthlyData.reduce((sum, d) => sum + (d.projected - d.actual), 0);

    return (
        <div className="cost-control glass-panel">
            <div className="cost-control__header">
                <div>
                    <h3 className="cost-control__title">{t('dashboard.costControl')}</h3>
                    <p className="cost-control__subtitle">{t('dashboard.monthlyLaborCost')}</p>
                </div>
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

            <div className="cost-control__chart">
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--status-amber)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--status-amber)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--status-green)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--status-green)" stopOpacity={0} />
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
                            formatter={(value: number) =>
                                isAr ? `${value.toLocaleString()} ر.س` : `SAR ${value.toLocaleString()}`
                            }
                        />
                        <Legend
                            formatter={(value: string) =>
                                value === 'projected' ? t('dashboard.projected') : t('dashboard.actual')
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
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
