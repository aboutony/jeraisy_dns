import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthUser {
    id: number;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    nameAr: string;
    nameEn: string;
    role: 'admin' | 'director' | 'supervisor' | 'worker';
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

// Removed DEMO_USERS as real authentication is now implemented

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        // Restore session from localStorage
        const saved = localStorage.getItem('jeraisy_dns_session');
        return saved ? JSON.parse(saved) : null;
    });

    const login = useCallback(async (username: string, password: string): Promise<boolean> => {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: username, password })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();

            // Store token
            localStorage.setItem('authToken', data.token);

            // Set user
            setUser({
                id: data.user.id,
                username: data.user.email,
                email: data.user.email,
                firstName: data.user.first_name,
                lastName: data.user.last_name,
                nameAr: data.user.first_name + ' ' + data.user.last_name, // Fallback
                nameEn: data.user.first_name + ' ' + data.user.last_name,
                role: 'worker',
                department: 'Operations', // Default
                departmentAr: 'العمليات',
                avatar: '/avatars/default.jpg',
            });

            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('authToken');
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
