import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthUser {
    id: number;
    nameAr: string;
    nameEn: string;
    role: 'admin' | 'director' | 'supervisor';
    department: string;
    departmentAr: string;
    avatar?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Demo user credentials ─────────────────────────────────────
const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
    admin: {
        password: 'jeraisy2026',
        user: {
            id: 1,
            nameAr: 'فهد الجريسي',
            nameEn: 'Fahd Al-Jeraisy',
            role: 'admin',
            department: 'Executive Management',
            departmentAr: 'الإدارة التنفيذية',
        },
    },
    director: {
        password: 'director2026',
        user: {
            id: 2,
            nameAr: 'سعد الدوسري',
            nameEn: 'Saad Al-Dosari',
            role: 'director',
            department: 'Operations',
            departmentAr: 'العمليات',
        },
    },
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        // Restore session from localStorage
        const saved = localStorage.getItem('jeraisy_dns_session');
        return saved ? JSON.parse(saved) : null;
    });

    const login = useCallback(async (username: string, password: string): Promise<boolean> => {
        // Simulate API delay
        await new Promise(r => setTimeout(r, 800));

        const entry = DEMO_USERS[username.toLowerCase()];
        if (entry && entry.password === password) {
            setUser(entry.user);
            localStorage.setItem('jeraisy_dns_session', JSON.stringify(entry.user));
            return true;
        }
        return false;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('jeraisy_dns_session');
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export type { AuthUser };
