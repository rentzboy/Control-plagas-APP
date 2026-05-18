import { useState, useEffect } from "react";
import { Plus, Bug, Send, Mail, Globe, Database, Trash2 } from "lucide-react";
import { Plaga } from "../types";

export default function ConfigView() {
  const [plagas, setPlagas] = useState<Plaga[]>([]);
  const [newPlaga, setNewPlaga] = useState("");
  const [exportStatus, setExportStatus] = useState("");

  useEffect(() => {
    fetchPlagas();
  }, []);

  const fetchPlagas = async () => {
    const res = await fetch("/api/plagas");
    setPlagas(await res.json());
  };

  const handleAddPlaga = async () => {
    if (!newPlaga) return;
    const res = await fetch("/api/plagas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newPlaga }),
    });
    if (res.ok) {
      setNewPlaga("");
      fetchPlagas();
    } else {
      alert("Error al añadir plaga (puede que ya exista)");
    }
  };

  const exportData = async (type: "email" | "server") => {
    setExportStatus(`Exportando a ${type}...`);
    const endpoint = type === "email" ? "/api/export/email" : "/api/export/server";
    const body = type === "email" 
      ? { email: "usuario@ejemplo.com", data: {} } 
      : { serverUrl: "https://api.externa.com/data", data: {} };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    setExportStatus(result.message);
    setTimeout(() => setExportStatus(""), 3000);
  };

  return (
    <div className="p-6 space-y-10 pb-20">
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Bug size={20} /></div> Catálogo de Plagas
        </h2>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div className="flex gap-3">
            <input 
              className="flex-1 border rounded-xl p-3 bg-slate-50 focus:outline-none focus:ring-2 ring-emerald-500 font-medium placeholder:text-slate-300" 
              placeholder="Nombre de la plaga..."
              value={newPlaga}
              onChange={(e) => setNewPlaga(e.target.value)}
            />
            <button 
              onClick={handleAddPlaga}
              className="bg-slate-900 text-white p-3 rounded-xl shadow-md active:scale-95 transition-transform"
            >
              <Plus size={24} />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {plagas.map(p => (
              <div key={p.id} className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 uppercase tracking-tighter flex items-center gap-2">
                {p.nombre}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Send size={20} /></div> Canales de Exportación
        </h2>
        <div className="space-y-4">
          <button 
            onClick={() => exportData("email")}
            className="w-full p-5 flex items-center gap-5 bg-white border border-slate-100 rounded-2xl shadow-sm active:bg-slate-50 transition-all group"
          >
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-6">
              <Mail size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-slate-800">Enviar Informe Email</p>
              <p className="text-xs font-medium text-slate-400">PDF consolidado con mapas</p>
            </div>
            <div className="text-slate-300 group-hover:text-blue-600 transition-colors">
              <Globe size={18} />
            </div>
          </button>

          <button 
            onClick={() => exportData("server")}
            className="w-full p-5 flex items-center gap-5 bg-white border border-slate-100 rounded-2xl shadow-sm active:bg-slate-50 transition-all group"
          >
            <div className="bg-slate-100 p-4 rounded-2xl text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:-rotate-6">
              <Database size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-slate-800">Sincronización Cloud</p>
              <p className="text-xs font-medium text-slate-400">Exportación de datos brutos SQLite</p>
            </div>
          </button>

          {exportStatus && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-center text-sm font-bold animate-in zoom-in duration-300 border border-emerald-100">
              {exportStatus}
            </div>
          )}
        </div>
      </section>

      <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Database size={80} />
          </div>
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Entorno de Almacenamiento</p>
          <p className="text-lg font-bold">SQL_DATABASE_PRODUCTION</p>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-slate-400 font-bold">CONEXIÓN ESTABLE ● 12ms</span>
          </div>
      </div>
    </div>
  );
}
