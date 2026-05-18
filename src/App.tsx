import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { 
  Plus, 
  Map as MapIcon, 
  Settings, 
  Layers, 
  ClipboardCheck, 
  Home,
  Trash2,
  Edit2,
  ChevronRight,
  Send,
  Upload,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import DashboardView from "./views/DashboardView";
import FincasView from "./views/FincasView";
import ParcelasView from "./views/ParcelasView";
import GruposView from "./views/GruposView";
import RevisionesView from "./views/RevisionesView";
import ConfigView from "./views/ConfigView";
import { APIProvider } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "DASH", path: "/" },
    { icon: Home, label: "FINCAS", path: "/fincas" },
    { icon: MapIcon, label: "PARCELAS", path: "/parcelas" },
    { icon: Layers, label: "GRUPOS", path: "/grupos" },
    { icon: ClipboardCheck, label: "REVISIONES", path: "/revisiones" },
    { icon: Settings, label: "CONFIG", path: "/config" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center h-20 px-2 z-50">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 transition-all ${
              isActive ? "text-emerald-700 scale-110" : "text-slate-400"
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-emerald-50' : ''}`}>
              <item.icon size={20} />
            </div>
            <span className="text-[9px] mt-1 font-bold tracking-tighter">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
          <header className="bg-white border-b border-slate-200 h-20 px-6 flex items-center justify-between sticky top-0 z-40">
            <div>
              <h1 className="text-xl font-bold text-slate-800">AgroPest <span className="text-emerald-600">Control</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SISTEMA DE GESTIÓN v2.4</p>
            </div>
            <div className="w-8 h-8 bg-emerald-900 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-emerald-400 rounded-sm"></div>
            </div>
          </header>

          <main className="max-w-md mx-auto">
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/fincas" element={<FincasView />} />
              <Route path="/parcelas" element={<ParcelasView />} />
              <Route path="/grupos" element={<GruposView />} />
              <Route path="/revisiones" element={<RevisionesView />} />
              <Route path="/config" element={<ConfigView />} />
            </Routes>
          </main>

          <Navbar />
        </div>
      </APIProvider>
    </BrowserRouter>
  );
}
