/*
  AXON Phase 6-A: Academy.tsx
  Sovereign Academy — three sub-modules on one page:
    1. Course Catalog    — SKU-specific training videos and manuals
    2. Certification Queue — Installers pending verification
    3. Skills Gap Heatmap  — Regional under-certified SKU analysis

  Data is derived from LoadBalancer.analyzeSkillsGap() and
  GeoIntelligence.buildDemandCapacityHeatmap() outputs.
  The page reads from GlobalStore for worker counts; skill gap data
  is stubbed to the real service interfaces — wire to live API when ready.
*/

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    GraduationCap, BookOpen, BadgeCheck, BarChart3,
    PlayCircle, FileText, ChevronRight, AlertTriangle,
    Users, MapPin, Zap, Star,
} from 'lucide-react';
import { useGlobalStore } from '../../store/GlobalStore';
import type { SkuCertificationGap } from '../../services/LoadBalancer';
import type { KsaRegion } from '../../services/GeoIntelligence';
import './Academy.css';

// ── Sub-module tab keys ───────────────────────────────────────────────────────
type AcademyTab = 'catalog' | 'queue' | 'gapMap';

// ── Static course catalog (maps SKU → training assets) ───────────────────────
interface CourseCatalogEntry {
    skuCode: string;
    skuNameEn: string;
    skuNameAr: string;
    category: string;
    complexity: number;
    requiredTier: 'foundation' | 'pro' | 'master';
    videoCount: number;
    pdfCount: number;
    durationMin: number;
}

const COURSE_CATALOG: CourseCatalogEntry[] = [
    { skuCode: 'LUX-KITCH-PRO-44',   skuNameEn: 'Luxury Kitchen Pro',           skuNameAr: 'مطبخ فاخر برو',         category: 'luxury',      complexity: 5, requiredTier: 'master',     videoCount: 4, pdfCount: 3, durationMin: 180 },
    { skuCode: 'LUX-SUITE-FULL-08',   skuNameEn: 'Full Luxury Suite',            skuNameAr: 'جناح فاخر كامل',        category: 'hospitality', complexity: 5, requiredTier: 'master',     videoCount: 6, pdfCount: 4, durationMin: 240 },
    { skuCode: 'MED-FURN-SPEC-16',    skuNameEn: 'Medical Specialist Furnishing',skuNameAr: 'تأثيث طبي متخصص',       category: 'medical',     complexity: 4, requiredTier: 'pro',        videoCount: 3, pdfCount: 5, durationMin: 150 },
    { skuCode: 'COM-CONF-SET-22',     skuNameEn: 'Conference Room Set',          skuNameAr: 'طقم قاعة اجتماعات',     category: 'commercial',  complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 90  },
    { skuCode: 'COM-OFFICE-SET-12',   skuNameEn: 'Commercial Office Set',        skuNameAr: 'طقم مكتبي تجاري',       category: 'commercial',  complexity: 2, requiredTier: 'foundation', videoCount: 2, pdfCount: 2, durationMin: 60  },
    { skuCode: 'LUX-CLOSET-WALK-06',  skuNameEn: 'Walk-in Closet Luxury',        skuNameAr: 'غرفة ملابس فاخرة',      category: 'luxury',      complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 75  },
    { skuCode: 'LUX-BATH-VANITY-10',  skuNameEn: 'Luxury Bath Vanity',           skuNameAr: 'وحدة حمام فاخرة',       category: 'luxury',      complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 75  },
    { skuCode: 'COM-RECEP-DESK-04',   skuNameEn: 'Commercial Reception Desk',    skuNameAr: 'مكتب استقبال تجاري',    category: 'commercial',  complexity: 1, requiredTier: 'foundation', videoCount: 1, pdfCount: 1, durationMin: 30  },
];

const TIER_LABELS: Record<string, { en: string; ar: string; color: string }> = {
    foundation: { en: 'Foundation', ar: 'أساسي',   color: '#6b7280' },
    pro:        { en: 'Pro',        ar: 'محترف',    color: '#3b82f6' },
    master:     { en: 'Master',     ar: 'خبير',     color: '#c9a84c' },
};

// ── Stub skill gap data (wired to LoadBalancer.analyzeSkillsGap() shape) ─────
const STUB_GAPS: SkuCertificationGap[] = [
    {
        skuCode: 'LUX-KITCH-PRO-44', skuName: 'Luxury Kitchen Pro',
        requiredTier: 'master', certifiedCount: 18, demandCount: 26, surplus: -8,
        trainingCandidates: [
            { workerId: 42, name: 'Mohammed Al-Qahtani', currentTier: 'pro', idleDays: 3 },
            { workerId: 87, name: 'Khalid Al-Harbi',     currentTier: 'pro', idleDays: 7 },
            { workerId: 103,name: 'Faisal Al-Dosari',    currentTier: 'pro', idleDays: 12 },
        ],
    },
    {
        skuCode: 'MED-FURN-SPEC-16', skuName: 'Medical Specialist Furnishing',
        requiredTier: 'pro', certifiedCount: 34, demandCount: 41, surplus: -7,
        trainingCandidates: [
            { workerId: 55, name: 'Omar Al-Shehri',     currentTier: 'foundation', idleDays: 2 },
            { workerId: 78, name: 'Abdullah Al-Ghamdi', currentTier: 'foundation', idleDays: 9 },
        ],
    },
    {
        skuCode: 'LUX-SUITE-FULL-08', skuName: 'Full Luxury Suite',
        requiredTier: 'master', certifiedCount: 11, demandCount: 14, surplus: -3,
        trainingCandidates: [
            { workerId: 61, name: 'Saad Al-Mutairi', currentTier: 'pro', idleDays: 5 },
        ],
    },
];

// ── Stub certification queue ───────────────────────────────────────────────────
interface CertQueueEntry {
    workerId: number;
    name: string;
    site: KsaRegion;
    currentTier: string;
    pendingTier: string;
    submittedAt: string;
    status: 'pending' | 'underReview' | 'approved' | 'rejected';
}

const STUB_QUEUE: CertQueueEntry[] = [
    { workerId: 42,  name: 'Mohammed Al-Qahtani', site: 'riyadh', currentTier: 'pro',        pendingTier: 'master',     submittedAt: '2026-03-22', status: 'underReview' },
    { workerId: 55,  name: 'Omar Al-Shehri',      site: 'jeddah', currentTier: 'foundation', pendingTier: 'pro',        submittedAt: '2026-03-28', status: 'pending'     },
    { workerId: 78,  name: 'Abdullah Al-Ghamdi',  site: 'riyadh', currentTier: 'foundation', pendingTier: 'pro',        submittedAt: '2026-03-29', status: 'pending'     },
    { workerId: 87,  name: 'Khalid Al-Harbi',     site: 'dammam', currentTier: 'pro',        pendingTier: 'master',     submittedAt: '2026-03-18', status: 'approved'    },
    { workerId: 103, name: 'Faisal Al-Dosari',    site: 'riyadh', currentTier: 'pro',        pendingTier: 'master',     submittedAt: '2026-03-15', status: 'rejected'    },
];

// ── Helper components ─────────────────────────────────────────────────────────

function ComplexityDots({ n }: { n: number }) {
    return (
        <span className="academy-complexity">
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`academy-complexity__dot${i < n ? ' academy-complexity__dot--filled' : ''}`} />
            ))}
        </span>
    );
}

function TierBadge({ tier, isAr }: { tier: string; isAr: boolean }) {
    const meta = TIER_LABELS[tier] ?? { en: tier, ar: tier, color: '#6b7280' };
    return (
        <span className="academy-tier-badge" style={{ borderColor: meta.color, color: meta.color }}>
            {isAr ? meta.ar : meta.en}
        </span>
    );
}

function QueueStatusBadge({ status, isAr }: { status: CertQueueEntry['status']; isAr: boolean }) {
    const map: Record<string, { en: string; ar: string; cls: string }> = {
        pending:     { en: 'Pending',      ar: 'قيد الانتظار',   cls: 'academy-queue-status--pending'  },
        underReview: { en: 'Under Review', ar: 'قيد المراجعة',   cls: 'academy-queue-status--review'   },
        approved:    { en: 'Approved',     ar: 'مقبول',           cls: 'academy-queue-status--approved' },
        rejected:    { en: 'Rejected',     ar: 'مرفوض',           cls: 'academy-queue-status--rejected' },
    };
    const meta = map[status];
    return <span className={`academy-queue-status ${meta.cls}`}>{isAr ? meta.ar : meta.en}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Academy() {
    const { tab: tabParam } = useParams<{ tab?: string }>();
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const isAr = i18n.language === 'ar';
    const { state } = useGlobalStore();
    const [activeTab, setActiveTab] = useState<AcademyTab>(
        (tabParam as AcademyTab) ?? 'catalog'
    );
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = useMemo(
        () => ['all', ...Array.from(new Set(COURSE_CATALOG.map(c => c.category)))],
        []
    );

    const filteredCatalog = useMemo(
        () => selectedCategory === 'all'
            ? COURSE_CATALOG
            : COURSE_CATALOG.filter(c => c.category === selectedCategory),
        [selectedCategory]
    );

    const idleCount = state.workers.filter(
        w => (w.status === 'idle' || w.status === 'offDuty') && !w.assignedWorkOrder
    ).length;

    const tabs: Array<{ key: AcademyTab; labelEn: string; labelAr: string; icon: React.ElementType; count?: number }> = [
        { key: 'catalog', labelEn: 'Course Catalog',       labelAr: 'كتالوج الدورات',         icon: BookOpen,    count: COURSE_CATALOG.length },
        { key: 'queue',   labelEn: 'Certification Queue',  labelAr: 'قائمة التصديق',           icon: BadgeCheck,  count: STUB_QUEUE.filter(q => q.status === 'pending' || q.status === 'underReview').length },
        { key: 'gapMap',  labelEn: 'Skills Gap Heatmap',   labelAr: 'خريطة الفجوات المهارية',  icon: BarChart3,   count: STUB_GAPS.length },
    ];

    return (
        <div className="academy">
            {/* ── Page header ─────────────────────────────────────── */}
            <div className="academy__header">
                <div className="academy__header-title">
                    <GraduationCap size={28} className="academy__header-icon" />
                    <div>
                        <h1 className="academy__title">
                            {isAr ? 'أكاديمية AXON السيادية' : 'AXON Sovereign Academy'}
                        </h1>
                        <p className="academy__subtitle">
                            {isAr
                                ? 'تدريب مستمر، شهادات موثقة، نشر مدروس'
                                : 'Continuous Training · Verified Certification · Intelligent Deployment'}
                        </p>
                    </div>
                </div>

                {idleCount > 0 && (
                    <button
                        className="academy__idle-cta"
                        onClick={() => navigate('/workforce')}
                        title={isAr ? 'فتح القوى العاملة لتعيين التدريب' : 'Open Workforce to assign re-training'}
                    >
                        <AlertTriangle size={16} />
                        <span>
                            {idleCount} {isAr ? 'خامل — قرار مطلوب' : 'Idle — Action Required'}
                        </span>
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>

            {/* ── Tabs ────────────────────────────────────────────── */}
            <div className="academy__tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`academy__tab${activeTab === tab.key ? ' academy__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <tab.icon size={17} />
                        <span>{isAr ? tab.labelAr : tab.labelEn}</span>
                        {tab.count !== undefined && (
                            <span className="academy__tab-badge">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab: Course Catalog ──────────────────────────────── */}
            {activeTab === 'catalog' && (
                <div className="academy__panel">
                    {/* Category filter */}
                    <div className="academy__filter-row">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`academy__filter-chip${selectedCategory === cat ? ' academy__filter-chip--active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat === 'all' ? (isAr ? 'الكل' : 'All') : cat}
                            </button>
                        ))}
                    </div>

                    <div className="academy__catalog-grid">
                        {filteredCatalog.map(course => {
                            const tier = TIER_LABELS[course.requiredTier];
                            return (
                                <div key={course.skuCode} className="academy__course-card">
                                    <div className="academy__course-card__top">
                                        <span className="academy__course-sku">{course.skuCode}</span>
                                        <TierBadge tier={course.requiredTier} isAr={isAr} />
                                    </div>
                                    <h3 className="academy__course-name">
                                        {isAr ? course.skuNameAr : course.skuNameEn}
                                    </h3>
                                    <div className="academy__course-meta">
                                        <span className="academy__course-meta-item">
                                            <ComplexityDots n={course.complexity} />
                                            {isAr ? 'تعقيد' : 'Complexity'}
                                        </span>
                                        <span className="academy__course-meta-item">
                                            <PlayCircle size={13} />
                                            {course.videoCount} {isAr ? 'فيديو' : 'Videos'}
                                        </span>
                                        <span className="academy__course-meta-item">
                                            <FileText size={13} />
                                            {course.pdfCount} PDF
                                        </span>
                                    </div>
                                    <div className="academy__course-footer">
                                        <span className="academy__course-duration">
                                            {course.durationMin} {isAr ? 'دقيقة' : 'min'}
                                        </span>
                                        <button
                                            className="academy__course-launch"
                                            style={{ borderColor: tier.color, color: tier.color }}
                                        >
                                            {isAr ? 'ابدأ الدورة' : 'Launch Course'}
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tab: Certification Queue ─────────────────────────── */}
            {activeTab === 'queue' && (
                <div className="academy__panel">
                    <div className="academy__queue-list">
                        {STUB_QUEUE.map(entry => (
                            <div
                                key={entry.workerId}
                                className="academy__queue-row"
                                onClick={() => navigate(`/workforce/${entry.workerId}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && navigate(`/workforce/${entry.workerId}`)}
                            >
                                <div className="academy__queue-avatar">
                                    <Users size={18} />
                                </div>
                                <div className="academy__queue-info">
                                    <span className="academy__queue-name">{entry.name}</span>
                                    <span className="academy__queue-meta">
                                        <MapPin size={11} /> {entry.site}
                                        {' · '}
                                        <TierBadge tier={entry.currentTier} isAr={isAr} />
                                        {' → '}
                                        <TierBadge tier={entry.pendingTier} isAr={isAr} />
                                    </span>
                                    <span className="academy__queue-date">
                                        {isAr ? 'تقديم: ' : 'Submitted: '}{entry.submittedAt}
                                    </span>
                                </div>
                                <QueueStatusBadge status={entry.status} isAr={isAr} />
                                <ChevronRight size={16} className="academy__queue-arrow" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tab: Skills Gap Heatmap ──────────────────────────── */}
            {activeTab === 'gapMap' && (
                <div className="academy__panel">
                    <p className="academy__gap-intro">
                        {isAr
                            ? 'SKUs حيث الطلب يتجاوز المركبين المعتمدين. الرقم الأحمر = عجز في المنطقة.'
                            : 'SKUs where demand exceeds certified installers. Red figure = regional shortfall.'}
                    </p>
                    <div className="academy__gap-list">
                        {STUB_GAPS.map(gap => (
                            <div key={gap.skuCode} className="academy__gap-card">
                                <div className="academy__gap-card__header">
                                    <div>
                                        <span className="academy__gap-sku">{gap.skuCode}</span>
                                        <h3 className="academy__gap-name">{gap.skuName}</h3>
                                    </div>
                                    <div className="academy__gap-stats">
                                        <div className="academy__gap-stat">
                                            <span className="academy__gap-stat-value academy__gap-stat-value--red">
                                                {gap.surplus}
                                            </span>
                                            <span className="academy__gap-stat-label">
                                                {isAr ? 'فائض' : 'Surplus'}
                                            </span>
                                        </div>
                                        <div className="academy__gap-stat">
                                            <span className="academy__gap-stat-value">{gap.certifiedCount}</span>
                                            <span className="academy__gap-stat-label">
                                                {isAr ? 'معتمد' : 'Certified'}
                                            </span>
                                        </div>
                                        <div className="academy__gap-stat">
                                            <span className="academy__gap-stat-value">{gap.demandCount}</span>
                                            <span className="academy__gap-stat-label">
                                                {isAr ? 'الطلب' : 'Demand'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Demand bar */}
                                <div className="academy__gap-bar-wrap">
                                    <div
                                        className="academy__gap-bar academy__gap-bar--certified"
                                        style={{ width: `${(gap.certifiedCount / gap.demandCount) * 100}%` }}
                                    />
                                </div>

                                {/* Training candidates */}
                                {gap.trainingCandidates.length > 0 && (
                                    <div className="academy__gap-candidates">
                                        <span className="academy__gap-candidates-label">
                                            <Zap size={13} />
                                            {isAr ? 'مرشحو التدريب' : 'Training Candidates'}
                                        </span>
                                        <div className="academy__gap-candidates-list">
                                            {gap.trainingCandidates.map(c => (
                                                <button
                                                    key={c.workerId}
                                                    className="academy__candidate-chip"
                                                    onClick={() => navigate(`/workforce/${c.workerId}`)}
                                                >
                                                    <Star size={11} />
                                                    {c.name}
                                                    <span className="academy__candidate-idle">
                                                        {c.idleDays}d {isAr ? 'خامل' : 'idle'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    className="academy__gap-invite-btn"
                                    onClick={() => {/* wire to training invitation API */}}
                                >
                                    {isAr ? 'إرسال دعوات التدريب' : 'Send Training Invitations'}
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
