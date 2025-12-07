import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

const AuthContext = createContext({
    user: null,
    isAdmin: false,
    loading: true
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkUser = async () => {
        try {
            const currentUser = await getCurrentUser();
            const session = await fetchAuthSession();
            const groups = session.tokens?.accessToken?.payload['cognito:groups'] || [];

            setUser(currentUser);
            setIsAdmin(groups.includes('Admins'));
        } catch (e) {
            setUser(null);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkUser();

        // Listen for auth events
        const listener = Hub.listen('auth', (data) => {
            switch (data.payload.event) {
                case 'signedIn':
                    checkUser();
                    break;
                case 'signedOut':
                    setUser(null);
                    setIsAdmin(false);
                    break;
            }
        });

        return () => listener();
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAdmin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
