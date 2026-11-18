import { useState } from 'react';
import { LayoutDashboard, MessageCircle } from 'lucide-react';
import Admin from './pages/Admin';
import Chat from './pages/Chat';

export default function App(){const [screen,setScreen]=useState<'admin'|'chat'>('admin');return <><nav className="demo-switcher"><span>POC PREVIEW</span><button className={screen==='admin'?'active':''} onClick={()=>setScreen('admin')}><LayoutDashboard size={14}/> Admin portal</button><button className={screen==='chat'?'active':''} onClick={()=>setScreen('chat')}><MessageCircle size={14}/> Customer portal</button></nav>{screen==='admin'?<Admin/>:<Chat/>}</>;}
