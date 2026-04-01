/*
  AXON Phase 6-B: Academy.tsx
  Sovereign Academy — Full LMS with:
    • SovereignPlayer  — full-screen course viewer with asset tracking
    • CertificationQuiz — post-completion assessment (pass ≥ 2/3)
    • Automated Badge Award — tier elevation logged to axon_passport_badges
    • Idle Resolution Panel — gap-matched idle worker routing
*/

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    GraduationCap, BookOpen, BadgeCheck, BarChart3,
    PlayCircle, FileText, ChevronRight, AlertTriangle,
    Users, MapPin, Zap, Star, X, CheckCircle, XCircle,
    Trophy, Clock, Eye,
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
    { skuCode: 'LUX-KITCH-PRO-44',   skuNameEn: 'Luxury Kitchen Pro',            skuNameAr: 'مطبخ فاخر برو',         category: 'luxury',      complexity: 5, requiredTier: 'master',     videoCount: 4, pdfCount: 3, durationMin: 180 },
    { skuCode: 'LUX-SUITE-FULL-08',   skuNameEn: 'Full Luxury Suite',             skuNameAr: 'جناح فاخر كامل',        category: 'hospitality', complexity: 5, requiredTier: 'master',     videoCount: 6, pdfCount: 4, durationMin: 240 },
    { skuCode: 'MED-FURN-SPEC-16',    skuNameEn: 'Medical Specialist Furnishing', skuNameAr: 'تأثيث طبي متخصص',       category: 'medical',     complexity: 4, requiredTier: 'pro',        videoCount: 3, pdfCount: 5, durationMin: 150 },
    { skuCode: 'COM-CONF-SET-22',     skuNameEn: 'Conference Room Set',           skuNameAr: 'طقم قاعة اجتماعات',     category: 'commercial',  complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 90  },
    { skuCode: 'COM-OFFICE-SET-12',   skuNameEn: 'Commercial Office Set',         skuNameAr: 'طقم مكتبي تجاري',       category: 'commercial',  complexity: 2, requiredTier: 'foundation', videoCount: 2, pdfCount: 2, durationMin: 60  },
    { skuCode: 'LUX-CLOSET-WALK-06',  skuNameEn: 'Walk-in Closet Luxury',         skuNameAr: 'غرفة ملابس فاخرة',      category: 'luxury',      complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 75  },
    { skuCode: 'LUX-BATH-VANITY-10',  skuNameEn: 'Luxury Bath Vanity',            skuNameAr: 'وحدة حمام فاخرة',       category: 'luxury',      complexity: 3, requiredTier: 'pro',        videoCount: 2, pdfCount: 2, durationMin: 75  },
    { skuCode: 'COM-RECEP-DESK-04',   skuNameEn: 'Commercial Reception Desk',     skuNameAr: 'مكتب استقبال تجاري',    category: 'commercial',  complexity: 1, requiredTier: 'foundation', videoCount: 1, pdfCount: 1, durationMin: 30  },
];

const TIER_LABELS: Record<string, { en: string; ar: string; color: string }> = {
    foundation: { en: 'Foundation', ar: 'أساسي',   color: '#6b7280' },
    pro:        { en: 'Pro',        ar: 'محترف',    color: '#3b82f6' },
    master:     { en: 'Master',     ar: 'خبير',     color: '#c9a84c' },
};

// ── Quiz questions per SKU ────────────────────────────────────────────────────
interface QuizQuestion {
    q: string;
    options: string[];
    correct: number; // index into options
}

const COURSE_QUIZZES: Record<string, QuizQuestion[]> = {
    'LUX-KITCH-PRO-44': [
        {
            q: 'What is the mandatory first step before installing a luxury kitchen cabinet system?',
            options: ['Begin assembly immediately', 'Verify wall-load structural tolerance and level baseline', 'Unbox all components', 'Request customer approval of color'],
            correct: 1,
        },
        {
            q: 'Which torque specification applies to concealed hinge screws on premium overlay doors?',
            options: ['1.5 Nm', '3.0 Nm', '5.5 Nm — manufacturer spec', '8.0 Nm'],
            correct: 2,
        },
        {
            q: 'Upon completion of a Master-tier kitchen installation, what dual evidence is required?',
            options: ['Verbal confirmation', 'Before + after photos (≥3 each) and customer digital sign-off', 'Phone call to supervisor', 'Invoice submission only'],
            correct: 1,
        },
    ],
    'LUX-SUITE-FULL-08': [
        {
            q: 'When installing a full luxury suite, in what sequence must furniture placement occur?',
            options: ['Largest item first, work inward from walls', 'Random order based on unpacking', 'Smallest decorative items first', 'Bed frame always last'],
            correct: 0,
        },
        {
            q: 'What is the minimum clearance corridor required in a suite installation area (KSA fire code)?',
            options: ['60 cm', '80 cm', '100 cm', '120 cm'],
            correct: 2,
        },
        {
            q: 'A luxury suite completion certificate requires how many post-installation photos minimum?',
            options: ['2', '5', '3 — V-Trace minimum', '10'],
            correct: 2,
        },
    ],
    'MED-FURN-SPEC-16': [
        {
            q: 'Medical-grade furniture installations require antimicrobial coating verification via which method?',
            options: ['Visual inspection only', 'ISO 22196 swab test documentation', 'Customer declaration', 'None required on-site'],
            correct: 1,
        },
        {
            q: 'Which material is prohibited in patient-zone furniture installations?',
            options: ['Stainless steel', 'Melamine', 'Phthalate-based PVC edging', 'Solid wood veneer'],
            correct: 2,
        },
        {
            q: 'Before leaving a medical site, an installer must confirm what regulatory item is on file?',
            options: ['Customer satisfaction rating', 'SFDA facility compliance acknowledgement', 'VAT invoice', 'Warranty card'],
            correct: 1,
        },
    ],
    'COM-CONF-SET-22': [
        {
            q: 'A conference table requires cable management compliance per which standard?',
            options: ['ISO 9001', 'IEC 60364-7 surface wiring guidance', 'ANSI/TIA-568', 'No standard applies'],
            correct: 1,
        },
        {
            q: 'What is the recommended seat spacing between chairs around a conference table?',
            options: ['45 cm', '60 cm', '75 cm standard ergonomic', '90 cm'],
            correct: 2,
        },
        {
            q: 'Upon completing a commercial conference setup, the V-Trace checkpoint that must be logged is:',
            options: ['CP-3 Site Arrival', 'CP-7 Work Completion Evidence', 'CP-1 Mission Dispatch', 'CP-9 Survey Complete'],
            correct: 1,
        },
    ],
    'COM-OFFICE-SET-12': [
        {
            q: 'What ergonomic desk height range is standard for adjustable commercial office workstations?',
            options: ['60–70 cm', '68–76 cm', '72–80 cm', '80–90 cm'],
            correct: 1,
        },
        {
            q: 'A Foundation-tier installer may independently handle SKU complexity up to:',
            options: ['Complexity 1–2', 'Complexity 1–3', 'All complexity levels', 'Complexity 4–5 only'],
            correct: 0,
        },
        {
            q: 'Which document must be completed at handover for a commercial office installation?',
            options: ['Delivery note only', 'Customer sign-off + V-Trace completion checkpoint', 'Internal work order only', 'No documentation required at Foundation tier'],
            correct: 1,
        },
    ],
    'LUX-CLOSET-WALK-06': [
        {
            q: 'Walk-in closet railing systems must be fixed to wall studs at what minimum interval?',
            options: ['30 cm', '40 cm', '50 cm', '60 cm — structural load spec'],
            correct: 3,
        },
        {
            q: 'Soft-close drawer dampers in luxury closets must be calibrated to what closing force?',
            options: ['Any force', '<2N closing resistance per manufacturer spec', '>5N for security', 'Calibration is optional'],
            correct: 1,
        },
        {
            q: 'What finishing inspection step is mandatory before customer walkthrough in a walk-in closet?',
            options: ['None', 'Test all hinges, drawers, and lighting; photograph each zone', 'Quick visual sweep only', 'Customer does their own inspection'],
            correct: 1,
        },
    ],
    'LUX-BATH-VANITY-10': [
        {
            q: 'When sealing a luxury vanity countertop joint, which sealant grade is required?',
            options: ['Standard silicone', 'Sanitary-grade mould-resistant silicone (BS EN 15651-3)', 'Epoxy grout', 'No sealant required'],
            correct: 1,
        },
        {
            q: 'Luxury vanity mirror mounting must clear the top of the backsplash by at minimum:',
            options: ['0 cm (flush mounted)', '5 cm', '10 cm standard', '20 cm'],
            correct: 2,
        },
        {
            q: 'Post-installation water test for basin plumbing connections must run for a minimum of:',
            options: ['30 seconds', '2 minutes', '5 minutes with visual inspection', '10 minutes'],
            correct: 2,
        },
    ],
    'COM-RECEP-DESK-04': [
        {
            q: 'A commercial reception desk must be anchored to the floor when its height exceeds:',
            options: ['80 cm', '100 cm', '120 cm — tip-over safety threshold', '140 cm'],
            correct: 2,
        },
        {
            q: 'Before leaving a commercial reception installation, what is the final sign-off step?',
            options: ['None required', 'Photograph the completed desk and log V-Trace CP-7', 'Email the supervisor', 'Call the customer 24h later'],
            correct: 1,
        },
        {
            q: 'Reception desk cable entry ports must be fitted with:',
            options: ['Left open for IT team', 'Rubber grommets (edge protection)', 'Tape', 'Metal staples'],
            correct: 1,
        },
    ],
};

// Default fallback quiz (shouldn't hit, but safety net)
const DEFAULT_QUIZ: QuizQuestion[] = [
    {
        q: 'What is the primary safety requirement before starting any furniture installation?',
        options: ['Skip safety checks', 'Verify site safety, clear walkways, and confirm structural readiness', 'Start immediately', 'Wait for customer'],
        correct: 1,
    },
    {
        q: 'Which V-Trace checkpoint confirms installation is complete?',
        options: ['CP-1 Dispatch', 'CP-4 On-Site Arrival', 'CP-7 Work Completion Evidence', 'CP-3 Punch-In'],
        correct: 2,
    },
    {
        q: 'What happens after a worker earns a certification badge in AXON?',
        options: ['Nothing changes', 'Tier is elevated and new SKUs become available for dispatch', 'Worker is offboarded', 'Badge is ignored by dispatch'],
        correct: 1,
    },
];

// ── Course progress tracking ──────────────────────────────────────────────────
interface CourseProgressEntry {
    watchedVideoIds: string[];
    reviewedPdfIds: string[];
}

function getCompletionPercent(progress: CourseProgressEntry, course: CourseCatalogEntry): number {
    const total = course.videoCount + course.pdfCount;
    if (total === 0) return 100;
    const done = progress.watchedVideoIds.length + progress.reviewedPdfIds.length;
    return Math.round((done / total) * 100);
}

// ── Quiz session ──────────────────────────────────────────────────────────────
interface QuizSession {
    course: CourseCatalogEntry;
    questions: QuizQuestion[];
    currentIdx: number;
    answers: (number | null)[];
    submitted: boolean;
    passed: boolean | null;
    score: number;
}

// ── Stub skill gap data ───────────────────────────────────────────────────────
const STUB_GAPS: SkuCertificationGap[] = [
    {
        skuCode: 'LUX-KITCH-PRO-44', skuName: 'Luxury Kitchen Pro',
        requiredTier: 'master', certifiedCount: 18, demandCount: 26, surplus: -8,
        trainingCandidates: [
            { workerId: 42,  name: 'Mohammed Al-Qahtani', currentTier: 'pro', idleDays: 3  },
            { workerId: 87,  name: 'Khalid Al-Harbi',     currentTier: 'pro', idleDays: 7  },
            { workerId: 103, name: 'Faisal Al-Dosari',    currentTier: 'pro', idleDays: 12 },
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

// ── Certification queue ────────────────────────────────────────────────────────
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
    { workerId: 42,  name: 'Mohammed Al-Qahtani', site: 'riyadh', currentTier: 'pro',        pendingTier: 'master', submittedAt: '2026-03-22', status: 'underReview' },
    { workerId: 55,  name: 'Omar Al-Shehri',      site: 'jeddah', currentTier: 'foundation', pendingTier: 'pro',    submittedAt: '2026-03-28', status: 'pending'     },
    { workerId: 78,  name: 'Abdullah Al-Ghamdi',  site: 'riyadh', currentTier: 'foundation', pendingTier: 'pro',    submittedAt: '2026-03-29', status: 'pending'     },
    { workerId: 87,  name: 'Khalid Al-Harbi',     site: 'dammam', currentTier: 'pro',        pendingTier: 'master', submittedAt: '2026-03-18', status: 'approved'    },
    { workerId: 103, name: 'Faisal Al-Dosari',    site: 'riyadh', currentTier: 'pro',        pendingTier: 'master', submittedAt: '2026-03-15', status: 'rejected'    },
];

// ── Helper UI components ──────────────────────────────────────────────────────

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
        pending:     { en: 'Pending',      ar: 'قيد الانتظار', cls: 'academy-queue-status--pending'  },
        underReview: { en: 'Under Review', ar: 'قيد المراجعة', cls: 'academy-queue-status--review'   },
        approved:    { en: 'Approved',     ar: 'مقبول',         cls: 'academy-queue-status--approved' },
        rejected:    { en: 'Rejected',     ar: 'مرفوض',         cls: 'academy-queue-status--rejected' },
    };
    const meta = map[status];
    return <span className={`academy-queue-status ${meta.cls}`}>{isAr ? meta.ar : meta.en}</span>;
}

// ── SovereignPlayer ───────────────────────────────────────────────────────────
interface SovereignPlayerProps {
    course: CourseCatalogEntry;
    progress: CourseProgressEntry;
    onMarkVideo: (id: string) => void;
    onMarkPdf: (id: string) => void;
    onClose: () => void;
    onStartQuiz: () => void;
    isAr: boolean;
}

function SovereignPlayer({
    course, progress, onMarkVideo, onMarkPdf, onClose, onStartQuiz, isAr,
}: SovereignPlayerProps) {
    const [activeAsset, setActiveAsset] = useState<{ type: 'video' | 'pdf'; index: number }>({
        type: 'video', index: 0,
    });
    const tier = TIER_LABELS[course.requiredTier];
    const completionPercent = getCompletionPercent(progress, course);
    const isComplete = completionPercent === 100;

    const videoIds = Array.from({ length: course.videoCount }, (_, i) => `${course.skuCode}-vid-${i}`);
    const pdfIds   = Array.from({ length: course.pdfCount   }, (_, i) => `${course.skuCode}-pdf-${i}`);

    const videoTitles = [
        isAr ? 'مقدمة وتحضير الموقع' : 'Introduction & Site Preparation',
        isAr ? 'تجميع المكونات الرئيسية' : 'Core Component Assembly',
        isAr ? 'التثبيت والتعديل الدقيق' : 'Mounting & Fine Adjustment',
        isAr ? 'الفحص النهائي والتسليم' : 'Final Inspection & Handover',
        isAr ? 'تقنيات متقدمة' : 'Advanced Techniques',
        isAr ? 'حالات دراسية — مواقع VIP' : 'Case Studies — VIP Sites',
    ];
    const pdfTitles = [
        isAr ? 'دليل التركيب الرسمي' : 'Official Installation Manual',
        isAr ? 'متطلبات السلامة والامتثال' : 'Safety & Compliance Requirements',
        isAr ? 'معايير ضبط الجودة' : 'Quality Control Standards',
        isAr ? 'قوائم المراجعة الميدانية' : 'Field Inspection Checklists',
        isAr ? 'إجراءات الضمان' : 'Warranty Procedures',
    ];

    const activeId = activeAsset.type === 'video'
        ? videoIds[activeAsset.index]
        : pdfIds[activeAsset.index];
    const isActiveWatched = activeAsset.type === 'video'
        ? progress.watchedVideoIds.includes(activeId)
        : progress.reviewedPdfIds.includes(activeId);

    function handleMarkActive() {
        if (activeAsset.type === 'video') onMarkVideo(activeId);
        else onMarkPdf(activeId);
    }

    return (
        <div className="academy__player-overlay" role="dialog" aria-modal="true">
            {/* Header */}
            <div className="academy__player-header">
                <div className="academy__player-header-left">
                    <span className="academy__player-sku">{course.skuCode}</span>
                    <span className="academy__player-title">
                        {isAr ? course.skuNameAr : course.skuNameEn}
                    </span>
                    <TierBadge tier={course.requiredTier} isAr={isAr} />
                </div>
                <div className="academy__player-header-right">
                    <div className="academy__player-progress-wrap">
                        <div className="academy__player-progress-bar">
                            <div
                                className="academy__player-progress-fill"
                                style={{ width: `${completionPercent}%` }}
                            />
                        </div>
                        <span className="academy__player-progress-pct">{completionPercent}%</span>
                    </div>
                    {isComplete && (
                        <button
                            className="academy__player-quiz-btn"
                            onClick={onStartQuiz}
                        >
                            <Trophy size={15} />
                            {isAr ? 'اختبار الشهادة' : 'Take Certification Quiz'}
                        </button>
                    )}
                    <button className="academy__player-close" onClick={onClose} aria-label="Close player">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="academy__player-body">
                {/* Asset list sidebar */}
                <div className="academy__player-sidebar">
                    {videoIds.length > 0 && (
                        <div className="academy__player-asset-group">
                            <span className="academy__player-asset-group-label">
                                <PlayCircle size={13} />
                                {isAr ? 'الفيديوهات' : 'Videos'}
                            </span>
                            {videoIds.map((id, i) => {
                                const watched = progress.watchedVideoIds.includes(id);
                                const isActive = activeAsset.type === 'video' && activeAsset.index === i;
                                return (
                                    <button
                                        key={id}
                                        className={`academy__player-asset-item${isActive ? ' academy__player-asset-item--active' : ''}${watched ? ' academy__player-asset-item--done' : ''}`}
                                        onClick={() => setActiveAsset({ type: 'video', index: i })}
                                    >
                                        {watched
                                            ? <CheckCircle size={13} className="academy__player-asset-check" />
                                            : <PlayCircle size={13} className="academy__player-asset-icon" />
                                        }
                                        <span>{videoTitles[i] ?? `Video ${i + 1}`}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {pdfIds.length > 0 && (
                        <div className="academy__player-asset-group">
                            <span className="academy__player-asset-group-label">
                                <FileText size={13} />
                                {isAr ? 'المستندات' : 'Documents'}
                            </span>
                            {pdfIds.map((id, i) => {
                                const reviewed = progress.reviewedPdfIds.includes(id);
                                const isActive = activeAsset.type === 'pdf' && activeAsset.index === i;
                                return (
                                    <button
                                        key={id}
                                        className={`academy__player-asset-item${isActive ? ' academy__player-asset-item--active' : ''}${reviewed ? ' academy__player-asset-item--done' : ''}`}
                                        onClick={() => setActiveAsset({ type: 'pdf', index: i })}
                                    >
                                        {reviewed
                                            ? <CheckCircle size={13} className="academy__player-asset-check" />
                                            : <FileText size={13} className="academy__player-asset-icon" />
                                        }
                                        <span>{pdfTitles[i] ?? `Document ${i + 1}`}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Viewer panel */}
                <div className="academy__player-viewer">
                    <div className={`academy__player-mock-frame academy__player-mock-frame--${activeAsset.type}`}>
                        {activeAsset.type === 'video' ? (
                            <>
                                <PlayCircle size={56} className="academy__player-mock-icon" />
                                <p className="academy__player-mock-title">
                                    {videoTitles[activeAsset.index] ?? `Video ${activeAsset.index + 1}`}
                                </p>
                                <p className="academy__player-mock-sub">
                                    {isAr ? course.skuNameAr : course.skuNameEn}
                                </p>
                                <div className="academy__player-mock-duration">
                                    <Clock size={13} />
                                    {Math.round(course.durationMin / course.videoCount)} {isAr ? 'دقيقة' : 'min'}
                                </div>
                            </>
                        ) : (
                            <>
                                <FileText size={56} className="academy__player-mock-icon" />
                                <p className="academy__player-mock-title">
                                    {pdfTitles[activeAsset.index] ?? `Document ${activeAsset.index + 1}`}
                                </p>
                                <p className="academy__player-mock-sub">PDF — {course.skuCode}</p>
                                <div className="academy__player-mock-duration">
                                    <Eye size={13} />
                                    {isAr ? 'قراءة مطلوبة' : 'Read required'}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        className={`academy__player-mark-btn${isActiveWatched ? ' academy__player-mark-btn--done' : ''}`}
                        onClick={handleMarkActive}
                        disabled={isActiveWatched}
                        style={{ borderColor: tier.color, color: isActiveWatched ? '#22c55e' : tier.color }}
                    >
                        {isActiveWatched ? (
                            <>
                                <CheckCircle size={15} />
                                {isAr ? 'تم الإنجاز' : 'Completed'}
                            </>
                        ) : activeAsset.type === 'video' ? (
                            <>
                                <PlayCircle size={15} />
                                {isAr ? 'وضع علامة كمشاهَد' : 'Mark as Watched'}
                            </>
                        ) : (
                            <>
                                <Eye size={15} />
                                {isAr ? 'وضع علامة كمراجَع' : 'Mark as Reviewed'}
                            </>
                        )}
                    </button>

                    {isComplete && (
                        <div className="academy__player-complete-banner">
                            <Trophy size={18} />
                            {isAr
                                ? 'اكتملت جميع المواد! جاهز لاختبار الشهادة.'
                                : 'All material complete! Ready for Certification Quiz.'}
                            <button className="academy__player-quiz-inline-btn" onClick={onStartQuiz}>
                                {isAr ? 'ابدأ الاختبار' : 'Begin Quiz'} <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── CertificationQuiz ─────────────────────────────────────────────────────────
interface CertificationQuizProps {
    session: QuizSession;
    onAnswer: (idx: number) => void;
    onSubmit: () => void;
    onClose: () => void;
    isAr: boolean;
}

function CertificationQuiz({ session, onAnswer, onSubmit, onClose, isAr }: CertificationQuizProps) {
    const tier = TIER_LABELS[session.course.requiredTier];
    const q = session.questions[session.currentIdx];
    const allAnswered = session.answers.every(a => a !== null);

    if (session.submitted) {
        return (
            <div className="academy__quiz-overlay" role="dialog" aria-modal="true">
                <div className="academy__quiz-result-card">
                    {session.passed ? (
                        <>
                            <div className="academy__quiz-result-icon academy__quiz-result-icon--pass">
                                <Trophy size={40} />
                            </div>
                            <h2 className="academy__quiz-result-title">
                                {isAr ? 'نجحت! الشهادة ممنوحة' : 'Passed! Badge Awarded'}
                            </h2>
                            <p className="academy__quiz-result-sub">
                                {isAr
                                    ? `النتيجة: ${session.score}/${session.questions.length} — تم ترقية مستواك`
                                    : `Score: ${session.score}/${session.questions.length} — Your tier has been elevated`}
                            </p>
                            <div className="academy__quiz-result-badge" style={{ borderColor: tier.color, color: tier.color }}>
                                <GraduationCap size={18} />
                                {isAr ? session.course.skuNameAr : session.course.skuNameEn}
                                <span> — </span>
                                <TierBadge tier={session.course.requiredTier} isAr={isAr} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="academy__quiz-result-icon academy__quiz-result-icon--fail">
                                <XCircle size={40} />
                            </div>
                            <h2 className="academy__quiz-result-title">
                                {isAr ? 'لم تنجح — حاول مجدداً' : 'Not Passed — Retry Available'}
                            </h2>
                            <p className="academy__quiz-result-sub">
                                {isAr
                                    ? `النتيجة: ${session.score}/${session.questions.length} — مطلوب 2/${session.questions.length}`
                                    : `Score: ${session.score}/${session.questions.length} — Required: 2/${session.questions.length}`}
                            </p>
                        </>
                    )}
                    <button className="academy__quiz-close-btn" onClick={onClose}>
                        {isAr ? 'إغلاق' : 'Close'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="academy__quiz-overlay" role="dialog" aria-modal="true">
            <div className="academy__quiz-card">
                {/* Quiz header */}
                <div className="academy__quiz-header">
                    <div className="academy__quiz-header-left">
                        <GraduationCap size={18} style={{ color: tier.color }} />
                        <span className="academy__quiz-course-name">
                            {isAr ? session.course.skuNameAr : session.course.skuNameEn}
                        </span>
                        <TierBadge tier={session.course.requiredTier} isAr={isAr} />
                    </div>
                    <span className="academy__quiz-counter">
                        {session.currentIdx + 1} / {session.questions.length}
                    </span>
                </div>

                {/* Progress dots */}
                <div className="academy__quiz-dots">
                    {session.questions.map((_, i) => (
                        <span
                            key={i}
                            className={`academy__quiz-dot${i === session.currentIdx ? ' academy__quiz-dot--active' : ''}${session.answers[i] !== null ? ' academy__quiz-dot--answered' : ''}`}
                        />
                    ))}
                </div>

                {/* Question */}
                <p className="academy__quiz-question">{q.q}</p>

                {/* Options */}
                <div className="academy__quiz-options">
                    {q.options.map((opt, i) => (
                        <button
                            key={i}
                            className={`academy__quiz-option${session.answers[session.currentIdx] === i ? ' academy__quiz-option--selected' : ''}`}
                            onClick={() => onAnswer(i)}
                        >
                            <span className="academy__quiz-option-letter">
                                {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="academy__quiz-footer">
                    {session.currentIdx < session.questions.length - 1 ? (
                        <button
                            className="academy__quiz-next-btn"
                            onClick={() => onAnswer(session.answers[session.currentIdx] ?? -1)}
                            disabled={session.answers[session.currentIdx] === null}
                            style={{ borderColor: tier.color, color: tier.color }}
                        >
                            {isAr ? 'السؤال التالي' : 'Next Question'} <ChevronRight size={15} />
                        </button>
                    ) : (
                        <button
                            className="academy__quiz-submit-btn"
                            onClick={onSubmit}
                            disabled={!allAnswered}
                            style={{ background: tier.color }}
                        >
                            <CheckCircle size={15} />
                            {isAr ? 'تأكيد الإجابات' : 'Submit Answers'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── IdleResolutionPanel ───────────────────────────────────────────────────────
interface IdleResolutionPanelProps {
    onClose: () => void;
    onLaunchCourse: (course: CourseCatalogEntry) => void;
    totalIdle: number;
    isAr: boolean;
}

function IdleResolutionPanel({ onClose, onLaunchCourse, totalIdle, isAr }: IdleResolutionPanelProps) {
    // For each gap, show training candidates (already idle by idleDays data)
    const matchedCourses = STUB_GAPS.map(gap => {
        const course = COURSE_CATALOG.find(c => c.skuCode === gap.skuCode);
        return { gap, course };
    }).filter(x => x.course !== undefined) as Array<{ gap: SkuCertificationGap; course: CourseCatalogEntry }>;

    return (
        <div className="academy__idle-panel-backdrop" onClick={onClose}>
            <div className="academy__idle-panel" onClick={e => e.stopPropagation()}>
                <div className="academy__idle-panel-header">
                    <div className="academy__idle-panel-title-row">
                        <AlertTriangle size={18} className="academy__idle-panel-icon" />
                        <h3 className="academy__idle-panel-title">
                            {isAr ? 'حل ظاهرة الخمول' : 'Idle Resolution'}
                        </h3>
                    </div>
                    <p className="academy__idle-panel-sub">
                        {totalIdle} {isAr
                            ? 'مركّب خامل مطابق لفجوات المهارات التالية'
                            : 'idle installers matched to the following skills gaps'}
                    </p>
                    <button className="academy__idle-panel-close" onClick={onClose} aria-label="Close panel">
                        <X size={18} />
                    </button>
                </div>

                <div className="academy__idle-panel-list">
                    {matchedCourses.map(({ gap, course }) => {
                        const tier = TIER_LABELS[course.requiredTier];
                        return (
                            <div key={gap.skuCode} className="academy__idle-panel-card">
                                <div className="academy__idle-panel-card-header">
                                    <div>
                                        <span className="academy__idle-panel-sku">{gap.skuCode}</span>
                                        <h4 className="academy__idle-panel-course-name">
                                            {isAr ? course.skuNameAr : course.skuNameEn}
                                        </h4>
                                    </div>
                                    <div className="academy__idle-panel-gap-stat">
                                        <span className="academy__idle-panel-gap-num">{Math.abs(gap.surplus)}</span>
                                        <span className="academy__idle-panel-gap-label">
                                            {isAr ? 'عجز' : 'shortfall'}
                                        </span>
                                    </div>
                                </div>

                                <div className="academy__idle-panel-candidates">
                                    {gap.trainingCandidates.map(c => (
                                        <div key={c.workerId} className="academy__idle-panel-candidate">
                                            <div className="academy__idle-panel-candidate-info">
                                                <Users size={13} />
                                                <span className="academy__idle-panel-candidate-name">{c.name}</span>
                                                <TierBadge tier={c.currentTier} isAr={isAr} />
                                                <span className="academy__idle-panel-candidate-idle">
                                                    {c.idleDays}d {isAr ? 'خامل' : 'idle'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="academy__idle-panel-launch-btn"
                                    style={{ borderColor: tier.color, color: tier.color }}
                                    onClick={() => { onLaunchCourse(course); onClose(); }}
                                >
                                    <PlayCircle size={14} />
                                    {isAr ? 'إطلاق الدورة' : 'Launch Course'}
                                    <span className="academy__idle-panel-candidate-count">
                                        {gap.trainingCandidates.length}
                                    </span>
                                    {isAr ? 'مرشحين' : 'candidates'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Main Academy component ────────────────────────────────────────────────────

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

    // LMS state
    const [courseProgress, setCourseProgress] = useState<Map<string, CourseProgressEntry>>(new Map());
    const [playerCourse, setPlayerCourse] = useState<CourseCatalogEntry | null>(null);
    const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
    const [awardedBadges, setAwardedBadges] = useState<Set<string>>(new Set());
    const [idlePanelOpen, setIdlePanelOpen] = useState(false);

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

    function getProgress(skuCode: string): CourseProgressEntry {
        return courseProgress.get(skuCode) ?? { watchedVideoIds: [], reviewedPdfIds: [] };
    }

    const markVideo = useCallback((skuCode: string, id: string) => {
        setCourseProgress(prev => {
            const cur = prev.get(skuCode) ?? { watchedVideoIds: [], reviewedPdfIds: [] };
            if (cur.watchedVideoIds.includes(id)) return prev;
            const next = new Map(prev);
            next.set(skuCode, { ...cur, watchedVideoIds: [...cur.watchedVideoIds, id] });
            return next;
        });
    }, []);

    const markPdf = useCallback((skuCode: string, id: string) => {
        setCourseProgress(prev => {
            const cur = prev.get(skuCode) ?? { watchedVideoIds: [], reviewedPdfIds: [] };
            if (cur.reviewedPdfIds.includes(id)) return prev;
            const next = new Map(prev);
            next.set(skuCode, { ...cur, reviewedPdfIds: [...cur.reviewedPdfIds, id] });
            return next;
        });
    }, []);

    function launchCourse(course: CourseCatalogEntry) {
        setPlayerCourse(course);
        setQuizSession(null);
    }

    function handleStartQuiz() {
        if (!playerCourse) return;
        const questions = COURSE_QUIZZES[playerCourse.skuCode] ?? DEFAULT_QUIZ;
        setQuizSession({
            course: playerCourse,
            questions,
            currentIdx: 0,
            answers: Array(questions.length).fill(null),
            submitted: false,
            passed: null,
            score: 0,
        });
        setPlayerCourse(null);
    }

    function handleQuizAnswer(optionIdx: number) {
        if (!quizSession) return;
        const updatedAnswers = [...quizSession.answers];
        updatedAnswers[quizSession.currentIdx] = optionIdx;
        const nextIdx = quizSession.currentIdx + 1;
        if (nextIdx < quizSession.questions.length) {
            setQuizSession({ ...quizSession, answers: updatedAnswers, currentIdx: nextIdx });
        } else {
            setQuizSession({ ...quizSession, answers: updatedAnswers });
        }
    }

    function handleQuizSubmit() {
        if (!quizSession) return;
        let score = 0;
        quizSession.questions.forEach((q, i) => {
            if (quizSession.answers[i] === q.correct) score++;
        });
        const passed = score >= 2;

        if (passed) {
            const { skuCode, requiredTier } = quizSession.course;
            setAwardedBadges(prev => new Set(prev).add(skuCode));
            // eslint-disable-next-line no-console
            console.log(
                `AXON-BADGE-AWARDED | SKU: ${skuCode} | Tier: ${requiredTier.toUpperCase()} | ` +
                `Timestamp: ${new Date().toISOString()} | ` +
                `Source: axon_passport_badges INSERT`
            );
        }

        setQuizSession({ ...quizSession, submitted: true, passed, score });
    }

    function handleQuizClose() {
        setQuizSession(null);
    }

    const tabs: Array<{ key: AcademyTab; labelEn: string; labelAr: string; icon: React.ElementType; count?: number }> = [
        { key: 'catalog', labelEn: 'Course Catalog',      labelAr: 'كتالوج الدورات',        icon: BookOpen,   count: COURSE_CATALOG.length },
        { key: 'queue',   labelEn: 'Certification Queue', labelAr: 'قائمة التصديق',          icon: BadgeCheck, count: STUB_QUEUE.filter(q => q.status === 'pending' || q.status === 'underReview').length },
        { key: 'gapMap',  labelEn: 'Skills Gap Heatmap',  labelAr: 'خريطة الفجوات المهارية', icon: BarChart3,  count: STUB_GAPS.length },
    ];

    return (
        <>
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
                        onClick={() => setIdlePanelOpen(true)}
                        title={isAr ? 'عرض المركبين الخاملين المؤهلين للتدريب' : 'View idle installers eligible for training'}
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
                            const progress = getProgress(course.skuCode);
                            const pct = getCompletionPercent(progress, course);
                            const awarded = awardedBadges.has(course.skuCode);
                            return (
                                <div key={course.skuCode} className={`academy__course-card${awarded ? ' academy__course-card--awarded' : ''}`}>
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

                                    {/* Progress bar (visible once started) */}
                                    {pct > 0 && (
                                        <div className="academy__course-progress-wrap">
                                            <div
                                                className="academy__course-progress-fill"
                                                style={{ width: `${pct}%`, background: tier.color }}
                                            />
                                            <span className="academy__course-progress-pct"
                                                style={{ color: tier.color }}>{pct}%</span>
                                        </div>
                                    )}

                                    <div className="academy__course-footer">
                                        <span className="academy__course-duration">
                                            <Clock size={12} /> {course.durationMin} {isAr ? 'دقيقة' : 'min'}
                                        </span>
                                        {awarded ? (
                                            <span className="academy__course-badge-awarded" style={{ color: tier.color }}>
                                                <Trophy size={13} />
                                                {isAr ? 'الشارة ممنوحة' : 'Badge Awarded'}
                                            </span>
                                        ) : (
                                            <button
                                                className="academy__course-launch"
                                                style={{ borderColor: tier.color, color: tier.color }}
                                                onClick={() => launchCourse(course)}
                                            >
                                                {pct === 0
                                                    ? (isAr ? 'ابدأ الدورة' : 'Launch Course')
                                                    : (isAr ? 'متابعة' : 'Continue')}
                                                <ChevronRight size={14} />
                                            </button>
                                        )}
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
                                <div className="academy__queue-avatar"><Users size={18} /></div>
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
                        {STUB_GAPS.map(gap => {
                            const course = COURSE_CATALOG.find(c => c.skuCode === gap.skuCode);
                            return (
                                <div key={gap.skuCode} className="academy__gap-card">
                                    <div className="academy__gap-card__header">
                                        <div>
                                            <span className="academy__gap-sku">{gap.skuCode}</span>
                                            <h3 className="academy__gap-name">{gap.skuName}</h3>
                                        </div>
                                        <div className="academy__gap-stats">
                                            <div className="academy__gap-stat">
                                                <span className="academy__gap-stat-value academy__gap-stat-value--red">{gap.surplus}</span>
                                                <span className="academy__gap-stat-label">{isAr ? 'فائض' : 'Surplus'}</span>
                                            </div>
                                            <div className="academy__gap-stat">
                                                <span className="academy__gap-stat-value">{gap.certifiedCount}</span>
                                                <span className="academy__gap-stat-label">{isAr ? 'معتمد' : 'Certified'}</span>
                                            </div>
                                            <div className="academy__gap-stat">
                                                <span className="academy__gap-stat-value">{gap.demandCount}</span>
                                                <span className="academy__gap-stat-label">{isAr ? 'الطلب' : 'Demand'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="academy__gap-bar-wrap">
                                        <div
                                            className="academy__gap-bar academy__gap-bar--certified"
                                            style={{ width: `${(gap.certifiedCount / gap.demandCount) * 100}%` }}
                                        />
                                    </div>

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

                                    <div className="academy__gap-card-actions">
                                        {course && (
                                            <button
                                                className="academy__gap-launch-course-btn"
                                                style={{ borderColor: TIER_LABELS[course.requiredTier].color, color: TIER_LABELS[course.requiredTier].color }}
                                                onClick={() => { launchCourse(course); setActiveTab('catalog'); }}
                                            >
                                                <PlayCircle size={14} />
                                                {isAr ? 'إطلاق الدورة' : 'Launch Course'}
                                            </button>
                                        )}
                                        <button
                                            className="academy__gap-invite-btn"
                                            onClick={() => {/* wire to training invitation API */}}
                                        >
                                            {isAr ? 'إرسال دعوات التدريب' : 'Send Training Invitations'}
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {/* ── Sovereign Player overlay ─────────────────────────────── */}
        {playerCourse && (
            <SovereignPlayer
                course={playerCourse}
                progress={getProgress(playerCourse.skuCode)}
                onMarkVideo={id => markVideo(playerCourse.skuCode, id)}
                onMarkPdf={id => markPdf(playerCourse.skuCode, id)}
                onClose={() => setPlayerCourse(null)}
                onStartQuiz={handleStartQuiz}
                isAr={isAr}
            />
        )}

        {/* ── Certification Quiz overlay ───────────────────────────── */}
        {quizSession && (
            <CertificationQuiz
                session={quizSession}
                onAnswer={handleQuizAnswer}
                onSubmit={handleQuizSubmit}
                onClose={handleQuizClose}
                isAr={isAr}
            />
        )}

        {/* ── Idle Resolution Panel ────────────────────────────────── */}
        {idlePanelOpen && (
            <IdleResolutionPanel
                onClose={() => setIdlePanelOpen(false)}
                onLaunchCourse={launchCourse}
                totalIdle={idleCount}
                isAr={isAr}
            />
        )}
        </>
    );
}
