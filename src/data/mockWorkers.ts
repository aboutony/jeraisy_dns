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
    site: 'riyadh' | 'jeddah';
    isSaudi: boolean;
}

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

function generateStatus(hours: number): WorkerStatus {
    if (hours >= 38) return 'overtime';
    if (hours >= 35) return 'overtimeRisk';
    const statuses: WorkerStatus[] = ['active', 'active', 'active', 'idle', 'onBreak', 'offDuty'];
    return statuses[Math.floor(Math.random() * statuses.length)];
}

export function generateMockWorkers(count: number = 500): Worker[] {
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
            status: generateStatus(capped),
            site: i % 3 === 0 ? 'jeddah' : 'riyadh',
            isSaudi: true,
        });
    }
    return workers;
}

export const mockWorkers = generateMockWorkers(500);

// Summary stats
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
