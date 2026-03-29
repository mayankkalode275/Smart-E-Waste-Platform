import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState('Admin'); 
  
  // Derive user info based on current role for demo purposes
  const user = {
    Admin: { name: 'System Admin', type: 'System Admin' },
    User: { name: 'Ritesh Jadhav', type: 'Citizen' },
    Business: { name: 'Greenville Tech Park', type: 'Business / Society' },
    Vendor: { name: 'Eco Movers Logistics', type: 'Collection Vendor' }
  }[role] || { name: 'Guest', type: 'Visitor' };
  
  const logout = () => { console.log('Logged out'); };

  return (
    <AuthContext.Provider value={{ role, setRole, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
