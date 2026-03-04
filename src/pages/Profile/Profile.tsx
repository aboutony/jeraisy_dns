import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    User, Clock, Building2, Shield, Mail, Calendar,
    ChevronLeft, Briefcase, Award,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalStore } from '../../store/GlobalStore';
import './Profile.css';

export default function Profile() {
    const { i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const navigate = useNavigate();
    const { user } = useAuth();
    const { state } = useGlobalStore();

    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    // Compute live stats from GlobalStore
    const totalWorkers = state.workers.length;
    const activeWorkers = state.workers.filter(w => w.punchedIn).length;
    const avgHours = totalWorkers > 0
        ? (state.workers.reduce((sum, w) => sum + w.hoursWorked, 0) / totalWorkers).toFixed(1)
        : '0.0';
    const overtimeCount = state.workers.filter(
        w => w.hoursWorked >= state.thresholds.overtimeHoursLimit
    ).length;

    const roleLabels: Record<string, { ar: string; en: string }> = {
        admin: { ar: 'مدير النظام', en: 'System Administrator' },
        director: { ar: 'المدير التنفيذي', en: 'Executive Director' },
        supervisor: { ar: 'مشرف', en: 'Supervisor' },
    };

    return (
        <div className="profile">
            <button className="profile__back" onClick={() => navigate(-1)}>
                <ChevronLeft size={18} />
                {isAr ? 'رجوع' : 'Back'}
            </button>

            {/* Profile Header Card */}
            <div className="profile__hero">
                <div className="profile__avatar">
                    <User size={40} />
                </div>
                <div className="profile__identity">
                    <h1 className="profile__name">{isAr ? user.nameAr : user.nameEn}</h1>
                    <div className="profile__role-badge">
                        <Shield size={12} />
                        {isAr ? roleLabels[user.role].ar : roleLabels[user.role].en}
                    </div>
                </div>
            </div>

            {/* Detail Grid */}
            <div className="profile__grid">
                <div className="profile__detail">
                    <Briefcase size={18} />
                    <div>
                        <span className="profile__detail-label">{isAr ? 'القسم' : 'Department'}</span>
                        <span className="profile__detail-value">
                            {isAr ? user.departmentAr : user.department}
                        </span>
                    </div>
                </div>
                <div className="profile__detail">
                    <Mail size={18} />
                    <div>
                        <span className="profile__detail-label">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                        <span className="profile__detail-value">
                            {user.nameEn.toLowerCase().replace(/\s+/g, '.')}@jeraisy.com.sa
                        </span>
                    </div>
                </div>
                <div className="profile__detail">
                    <Calendar size={18} />
                    <div>
                        <span className="profile__detail-label">{isAr ? 'تاريخ الانضمام' : 'Joined'}</span>
                        <span className="profile__detail-value">
                            {isAr ? '١ يناير ٢٠٢٥' : 'January 1, 2025'}
                        </span>
                    </div>
                </div>
                <div className="profile__detail">
                    <Award size={18} />
                    <div>
                        <span className="profile__detail-label">{isAr ? 'المعرف' : 'Employee ID'}</span>
                        <span className="profile__detail-value">JRS-{user.id.toString().padStart(4, '0')}</span>
                    </div>
                </div>
            </div>

            {/* Live Stats from GlobalStore */}
            <div className="profile__section">
                <h2 className="profile__section-title">
                    <Clock size={18} />
                    {isAr ? 'إحصائيات الأسبوع الحالي' : 'This Week\'s Live Stats'}
                </h2>
                <div className="profile__stats">
                    <div className="profile__stat">
                        <span className="profile__stat-value">{totalWorkers}</span>
                        <span className="profile__stat-label">{isAr ? 'إجمالي القوى العاملة' : 'Total Workforce'}</span>
                    </div>
                    <div className="profile__stat">
                        <span className="profile__stat-value profile__stat-value--green">{activeWorkers}</span>
                        <span className="profile__stat-label">{isAr ? 'نشط الآن' : 'Active Now'}</span>
                    </div>
                    <div className="profile__stat">
                        <span className="profile__stat-value">{avgHours}h</span>
                        <span className="profile__stat-label">{isAr ? 'متوسط الساعات' : 'Avg Hours / Week'}</span>
                    </div>
                    <div className="profile__stat">
                        <span className={`profile__stat-value ${overtimeCount > 0 ? 'profile__stat-value--red' : 'profile__stat-value--green'}`}>
                            {overtimeCount}
                        </span>
                        <span className="profile__stat-label">{isAr ? 'تجاوز العمل الإضافي' : 'Overtime Risk'}</span>
                    </div>
                </div>
            </div>

            {/* Managed Sites */}
            <div className="profile__section">
                <h2 className="profile__section-title">
                    <Building2 size={18} />
                    {isAr ? 'المواقع المُدارة' : 'Managed Sites'}
                </h2>
                <div className="profile__sites">
                    <div className="profile__site">
                        <span className="profile__site-dot profile__site-dot--active" />
                        <div>
                            <span className="profile__site-name">{isAr ? 'مصنع الرياض' : 'Riyadh Factory'}</span>
                            <span className="profile__site-code">RUH • 24.7136°N</span>
                        </div>
                    </div>
                    <div className="profile__site">
                        <span className="profile__site-dot profile__site-dot--active" />
                        <div>
                            <span className="profile__site-name">{isAr ? 'مصنع جدة' : 'Jeddah Factory'}</span>
                            <span className="profile__site-code">JED • 21.4858°N</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
