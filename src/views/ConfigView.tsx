import { useState, useEffect } from "react";
import { Plus, Bug, Send, Mail, Globe, Database, Trash2, Smartphone } from "lucide-react";
import { Plaga } from "../types";

export default function ConfigView() {
  const [plagas, setPlagas] = useState<Plaga[]>([]);
  const [newPlaga, setNewPlaga] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [emailTo, setEmailTo] = useState("usuario@ejemplo.com");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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
    if (type === "server") {
      // Sincronización cloud (Descarga de DB)
      window.location.href = "/api/download-db";
      return;
    }

    if (type === "email" && !showEmailInput) {
      setShowEmailInput(true);
      return;
    }

    setExportStatus(`Exportando a ${type}...`);
    const endpoint = type === "email" ? "/api/export/email" : "/api/export/server";
    const body = type === "email" 
      ? { email: emailTo, data: {} } 
      : { serverUrl: "https://api.externa.com/data", data: {} };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    setExportStatus(result.message);
    if (type === "email") setShowEmailInput(false);
    setTimeout(() => setExportStatus(""), 4000);
  };

  const handleRestoreDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("¡ATENCIÓN! Esto reemplazará COMPLETAMENTE tus datos actuales por los de la copia de seguridad. ¿Estás seguro de que quieres continuar?")) {
      e.target.value = "";
      return;
    }

    setIsRestoring(true);
    setExportStatus("⏳ Restaurando base de datos...");
    const formData = new FormData();
    formData.append("database", file);

    try {
      const res = await fetch("/api/admin/restore-db", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        const count = result.stats?.parcelas ?? 0;
        setExportStatus(`✅ ¡Éxito! Base de datos restaurada (${count} parcelas). Reiniciando...`);
        setTimeout(() => window.location.replace("/"), 3000);
      } else {
        setExportStatus("❌ Error: " + (result.error || "Fallo desconocido"));
      }
    } catch (error) {
      setExportStatus("❌ Error de conexión al servidor");
    } finally {
      setIsRestoring(false);
      e.target.value = "";
    }
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
          {showEmailInput ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in duration-300">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Destinatario</label>
              <input 
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 transition-colors font-medium mb-3"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowEmailInput(false)} className="flex-1 p-3 text-slate-500 font-bold text-xs uppercase tracking-widest bg-slate-100 rounded-xl">Cancelar</button>
                <button onClick={() => exportData("email")} className="flex-1 p-3 text-white font-bold text-xs uppercase tracking-widest bg-blue-600 rounded-xl shadow-md">Enviar</button>
              </div>
            </div>
          ) : (
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
          )}

          <button 
            onClick={() => exportData("server")}
            className="w-full p-5 flex items-center gap-5 bg-white border border-slate-100 rounded-2xl shadow-sm active:bg-slate-50 transition-all group"
          >
            <div className="bg-slate-100 p-4 rounded-2xl text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:-rotate-6">
              <Database size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-slate-800">Descargar Base de Datos</p>
              <p className="text-xs font-medium text-slate-400">Exportar SQLite (.db)</p>
            </div>
          </button>

          <label className="w-full p-5 flex items-center gap-5 bg-white border border-slate-100 rounded-2xl shadow-sm active:bg-slate-50 transition-all group cursor-pointer">
            <input 
              type="file" 
              accept=".db,.sqlite" 
              className="hidden" 
              onChange={handleRestoreDb}
              disabled={isRestoring}
            />
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all transform group-hover:rotate-12">
              <Database size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-slate-800">Importar Base de Datos</p>
              <p className="text-xs font-medium text-slate-400">Restaurar desde archivo .db</p>
            </div>
          </label>

          <section className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <Smartphone size={20} />
              </div>
              <p className="font-bold text-sm uppercase tracking-wider">Instalación en Móvil</p>
            </div>

            {deferredPrompt ? (
              <button 
                onClick={handleInstallClick}
                className="w-full p-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
              >
                <Plus size={20} />
                Instalar AgroControl SIG
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/60 p-4 rounded-2xl border border-white space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Si no ves el botón de instalar, puedes hacerlo manualmente:
                  </p>
                  <ul className="text-xs text-slate-500 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-100 text-emerald-700 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>En <b>Chrome</b>: Pulsa los 3 puntos (⋮) y selecciona <b>"Instalar aplicación"</b> o "Añadir a pantalla de inicio".</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-100 text-emerald-700 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>En <b>Safari (iPhone)</b>: Pulsa el botón de compartir (↑) y selecciona <b>"Añadir a la pantalla de inicio"</b>.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </section>

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
