import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {authApi,session} from './api.js';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true);
 useEffect(()=>{let active=true;authApi.refresh().then(x=>{if(active){session.set(x.accessToken);setUser(x.user);}}).catch(()=>{}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
 async function login(email,password){const data=await authApi.login(email,password);session.set(data.accessToken);setUser(data.user);}
 async function logout(){try{await authApi.logout();}finally{session.clear();setUser(null);}}
 const value=useMemo(()=>({user,checking,login,logout}),[user,checking]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
