import { useState, useRef, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { 
  Map as MapIcon, 
  Settings, 
  Layers, 
  ClipboardCheck, 
  Home,
  LayoutDashboard
} from "lucide-react";
import { APIProvider } from "@vis.gl/react-google-maps";

const DashboardView = lazy(() => import("./views/DashboardView"));
const FincasView = lazy(() => import("./views/FincasView"));
const ParcelasView = lazy(() => import("./views/ParcelasView"));
const GruposView = lazy(() => import("./views/GruposView"));
const RevisionesView = lazy(() => import("./views/RevisionesView"));
const ConfigView = lazy(() => import("./views/ConfigView"));

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

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

const SuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-6 text-center">
        <div className="max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Google Maps API Key Required</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Para ver los mapas de catastro y calor, debe configurar su clave de API.
          </p>
          <div className="text-left space-y-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instrucciones:</p>
            <ol className="text-xs text-slate-600 space-y-3 list-decimal list-inside font-medium">
              <li>Open <strong>Settings</strong> (⚙️ gear icon)</li>
              <li>Select <strong>Secrets</strong></li>
              <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
              <li>Paste your API key and press Enter</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <APIProvider apiKey={API_KEY} version="weekly">
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
            <Suspense fallback={<SuspenseFallback />}>
              <Routes>
                <Route path="/" element={<DashboardView />} />
                <Route path="/fincas" element={<FincasView />} />
                <Route path="/parcelas" element={<ParcelasView />} />
                <Route path="/grupos" element={<GruposView />} />
                <Route path="/revisiones" element={<RevisionesView />} />
                <Route path="/config" element={<ConfigView />} />
              </Routes>
            </Suspense>
          </main>

          <Navbar />
        </div>
      </APIProvider>
    </BrowserRouter>
  );
}
