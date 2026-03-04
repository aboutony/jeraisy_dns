import type { Branch, Vehicle, TransitMission } from '../store/types';

// ── Four Branches ─────────────────────────────────────────────
export const branches: Branch[] = [
    {
        code: 'HQ', nameAr: 'المقر الرئيسي', nameEn: 'Headquarters',
        cityAr: 'الرياض', cityEn: 'Riyadh',
        coords: { lat: 24.7136, lng: 46.6753 },
        vehicleCount: 25, workerCount: 80, isHQ: true,
    },
    {
        code: 'RUH', nameAr: 'فرع الرياض', nameEn: 'Riyadh Branch',
        cityAr: 'الرياض', cityEn: 'Riyadh',
        coords: { lat: 24.7741, lng: 46.7386 },
        vehicleCount: 60, workerCount: 180, isHQ: false,
    },
    {
        code: 'DMM', nameAr: 'فرع الدمام', nameEn: 'Dammam Branch',
        cityAr: 'الدمام', cityEn: 'Dammam',
        coords: { lat: 26.4207, lng: 50.0888 },
        vehicleCount: 45, workerCount: 120, isHQ: false,
    },
    {
        code: 'JED', nameAr: 'فرع جدة', nameEn: 'Jeddah Branch',
        cityAr: 'جدة', cityEn: 'Jeddah',
        coords: { lat: 21.4858, lng: 39.1925 },
        vehicleCount: 40, workerCount: 120, isHQ: false,
    },
];

// ── Vehicle Types ─────────────────────────────────────────────
const vehicleTypes = [
    { typeAr: 'شاحنة ثقيلة', typeEn: 'Heavy Truck' },
    { typeAr: 'شاحنة متوسطة', typeEn: 'Medium Truck' },
    { typeAr: 'فان توصيل', typeEn: 'Delivery Van' },
    { typeAr: 'بيك أب', typeEn: 'Pickup' },
    { typeAr: 'مقطورة مسطحة', typeEn: 'Flatbed Trailer' },
];

const plateLetters = ['أ', 'ب', 'ح', 'د', 'ر', 'س', 'ص', 'ط', 'ع', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و'];

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ── Generate 170 Vehicles ─────────────────────────────────────
export function generateFleet(): Vehicle[] {
    const rand = seededRandom(42);
    const fleet: Vehicle[] = [];
    const branchAlloc = [
        { branch: 'HQ' as const, count: 25 },
        { branch: 'RUH' as const, count: 60 },
        { branch: 'DMM' as const, count: 45 },
        { branch: 'JED' as const, count: 40 },
    ];

    let idx = 1;
    for (const { branch, count } of branchAlloc) {
        for (let i = 0; i < count; i++) {
            const vType = vehicleTypes[Math.floor(rand() * vehicleTypes.length)];
            const totalKm = Math.floor(rand() * 180000) + 20000;
            const transitRatio = rand() * 0.4;
            const transitKm = Math.floor(totalKm * transitRatio);
            const serviceInterval = 10000;
            const lastService = Math.floor(totalKm / serviceInterval) * serviceInterval;
            const nextService = lastService + serviceInterval;
            const kmToService = nextService - totalKm;

            const l1 = plateLetters[Math.floor(rand() * plateLetters.length)];
            const l2 = plateLetters[Math.floor(rand() * plateLetters.length)];
            const l3 = plateLetters[Math.floor(rand() * plateLetters.length)];
            const num = Math.floor(rand() * 9000) + 1000;

            let status: Vehicle['status'] = 'available';
            if (kmToService <= 500) status = 'maintenanceDue';
            if (rand() < 0.05) status = 'maintenance';
            if (rand() < 0.12) status = 'inTransit';

            fleet.push({
                id: `VLC-${String(idx).padStart(3, '0')}`,
                plateAr: `${l1} ${l2} ${l3} ${num}`,
                plateEn: `${num} ${l3} ${l2} ${l1}`,
                typeAr: vType.typeAr,
                typeEn: vType.typeEn,
                homeBranch: branch,
                currentBranch: status === 'inTransit' ? (['RUH', 'DMM', 'JED', 'HQ'] as const)[Math.floor(rand() * 4)] : branch,
                status,
                totalMileageKm: totalKm,
                transitMileageKm: transitKm,
                localMileageKm: totalKm - transitKm,
                lastServiceKm: lastService,
                nextServiceKm: nextService,
                serviceIntervalKm: serviceInterval,
                year: 2020 + Math.floor(rand() * 6),
            });
            idx++;
        }
    }
    return fleet;
}

// ── Sample Transit Missions ───────────────────────────────────
export const sampleTransitMissions: TransitMission[] = [
    {
        id: 'TM-001', workOrderId: 'WO-2026-T01', vehicleId: 'VLC-062',
        driverId: 1010, driverNameAr: 'خالد الشمري', driverNameEn: 'Khalid Al-Shammari',
        originBranch: 'RUH', destinationBranch: 'JED', driverHomeBranch: 'RUH',
        loadEfficiency: 92, status: 'inTransit', distanceKm: 950,
        departedAt: '2026-03-04T06:00:00', estimatedArrival: '2026-03-04T18:00:00',
        returnToBase: true,
        cargoDescriptionAr: 'أثاث فندقي فاخر — 12 طقم غرفة',
        cargoDescriptionEn: 'Luxury hotel furniture — 12 room sets',
    },
    {
        id: 'TM-002', workOrderId: 'WO-2026-T02', vehicleId: 'VLC-088',
        driverId: 1015, driverNameAr: 'فهد الدوسري', driverNameEn: 'Fahd Al-Dosari',
        originBranch: 'RUH', destinationBranch: 'DMM', driverHomeBranch: 'RUH',
        loadEfficiency: 78, status: 'loading', distanceKm: 410,
        departedAt: null, estimatedArrival: null,
        returnToBase: true,
        cargoDescriptionAr: 'مكاتب تجارية — 8 محطات عمل',
        cargoDescriptionEn: 'Commercial desks — 8 workstations',
    },
    {
        id: 'TM-003', workOrderId: 'WO-2026-T03', vehicleId: 'VLC-130',
        driverId: 1022, driverNameAr: 'سعد القحطاني', driverNameEn: 'Saad Al-Qahtani',
        originBranch: 'JED', destinationBranch: 'RUH', driverHomeBranch: 'JED',
        loadEfficiency: 45, status: 'returning', distanceKm: 950,
        departedAt: '2026-03-03T14:00:00', estimatedArrival: '2026-03-04T02:00:00',
        returnToBase: true,
        cargoDescriptionAr: 'إرجاع بضاعة — أثاث مرتجع',
        cargoDescriptionEn: 'Return cargo — returned furniture',
    },
    {
        id: 'TM-004', workOrderId: 'WO-2026-T04', vehicleId: 'VLC-045',
        driverId: 1030, driverNameAr: 'عبدالله المطيري', driverNameEn: 'Abdullah Al-Mutairi',
        originBranch: 'DMM', destinationBranch: 'JED', driverHomeBranch: 'DMM',
        loadEfficiency: 100, status: 'delivered', distanceKm: 1340,
        departedAt: '2026-03-02T05:00:00', estimatedArrival: '2026-03-03T07:00:00',
        returnToBase: true,
        cargoDescriptionAr: 'تجهيزات طبية — مستشفى جامعي',
        cargoDescriptionEn: 'Medical furnishing — University Hospital',
    },
];
