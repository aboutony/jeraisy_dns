export interface WorkOrder {
    id: string;
    oracleRef: string;
    customerAr: string;
    customerEn: string;
    siteAr: string;
    siteEn: string;
    sku: string;
    descriptionAr: string;
    descriptionEn: string;
    estimatedHours: number;
    actualHours: number | null;
    status: 'pending' | 'inProgress' | 'completed' | 'synced';
    assignedWorkers: number;
    lastSync: string;
    direction: 'inbound' | 'outbound';
}

export const mockWorkOrders: WorkOrder[] = [
    {
        id: 'WO-2026-001',
        oracleRef: 'ORA-CRM-88401',
        customerAr: 'مجموعة الراجحي العقارية',
        customerEn: 'Al-Rajhi Real Estate Group',
        siteAr: 'فيلا الملقا - الرياض',
        siteEn: 'Al-Malqa Villa - Riyadh',
        sku: 'LUX-KITCH-PRO-44',
        descriptionAr: 'تركيب مطبخ فاخر - كامل',
        descriptionEn: 'Luxury Kitchen Installation - Full',
        estimatedHours: 48,
        actualHours: 42.5,
        status: 'synced',
        assignedWorkers: 6,
        lastSync: '2026-03-04T14:22:00',
        direction: 'outbound',
    },
    {
        id: 'WO-2026-002',
        oracleRef: 'ORA-CRM-88402',
        customerAr: 'شركة دار الأركان',
        customerEn: 'Dar Al-Arkan Company',
        siteAr: 'مشروع النرجس - الرياض',
        siteEn: 'Al-Narjis Project - Riyadh',
        sku: 'COM-OFFICE-SET-12',
        descriptionAr: 'تأثيث مكاتب تجارية',
        descriptionEn: 'Commercial Office Furnishing',
        estimatedHours: 120,
        actualHours: 85,
        status: 'inProgress',
        assignedWorkers: 12,
        lastSync: '2026-03-04T14:18:00',
        direction: 'inbound',
    },
    {
        id: 'WO-2026-003',
        oracleRef: 'ORA-CRM-88403',
        customerAr: 'فندق حياة ريجنسي',
        customerEn: 'Hyatt Regency Hotel',
        siteAr: 'كورنيش جدة',
        siteEn: 'Jeddah Corniche',
        sku: 'LUX-SUITE-FULL-08',
        descriptionAr: 'تأثيث أجنحة فندقية فاخرة',
        descriptionEn: 'Luxury Hotel Suite Furnishing',
        estimatedHours: 200,
        actualHours: null,
        status: 'pending',
        assignedWorkers: 18,
        lastSync: '2026-03-04T13:55:00',
        direction: 'inbound',
    },
    {
        id: 'WO-2026-004',
        oracleRef: 'ORA-CRM-88404',
        customerAr: 'وزارة التعليم',
        customerEn: 'Ministry of Education',
        siteAr: 'المبنى الإداري - الرياض',
        siteEn: 'Admin Building - Riyadh',
        sku: 'COM-CONF-SET-22',
        descriptionAr: 'تركيب قاعات اجتماعات',
        descriptionEn: 'Conference Room Installation',
        estimatedHours: 80,
        actualHours: 78,
        status: 'completed',
        assignedWorkers: 8,
        lastSync: '2026-03-04T14:30:00',
        direction: 'outbound',
    },
    {
        id: 'WO-2026-005',
        oracleRef: 'ORA-CRM-88405',
        customerAr: 'مستشفى الملك فيصل التخصصي',
        customerEn: 'King Faisal Specialist Hospital',
        siteAr: 'الجناح الجديد - الرياض',
        siteEn: 'New Wing - Riyadh',
        sku: 'MED-FURN-SPEC-16',
        descriptionAr: 'تأثيث طبي متخصص',
        descriptionEn: 'Specialized Medical Furnishing',
        estimatedHours: 160,
        actualHours: 45,
        status: 'inProgress',
        assignedWorkers: 14,
        lastSync: '2026-03-04T14:25:00',
        direction: 'inbound',
    },
];
