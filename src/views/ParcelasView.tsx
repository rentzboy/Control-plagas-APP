import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Upload, MapPin, Map as MapIcon } from "lucide-react";
import { Finca, GrupoParcelas, Parcela } from "../types";
import { parseGML, generateTreePoints, Point } from "../utils/gmlParser";

export default function ParcelasView() {
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [grupos, setGrupos] = useState<GrupoParcelas[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Config, 3: Success

  // Form State
  const [selectedFinca, setSelectedFinca] = useState<string>("");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("");
  const [manualNombre, setManualNombre] = useState<string>("");
  const [parsedParcelas, setParsedParcelas] = useState<any[]>([]);
  const [errors, setErrors] = useState<{finca?: boolean, nombre?: boolean}>({});
  const [treeConfig, setTreeConfig] = useState({
    totalArboles: 100,
    separacionArboles: 5,
    separacionFilas: 6
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rf, rg, rp] = await Promise.all([
      fetch("/api/fincas"),
      fetch("/api/grupos"),
      fetch("/api/parcelas")
    ]);
    setFincas(await rf.json());
    setGrupos(await rg.json());
    setParcelas(await rp.json());
  };

  const [isParsing, setIsParsing] = useState(false);

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const gmlText = event.target?.result as string;
        const results = await parseGML(gmlText);
        setParsedParcelas(results);
        if (results.length > 0) {
          if (results.length === 1) {
            setManualNombre(results[0].nombre);
          }
          setCurrentStep(2);
        } else {
          alert("No se encontraron parcelas válidas en el archivo GML. Por favor, asegúrese de que es un archivo de Catastro válido.");
        }
      } catch (err) {
        console.error("Error al procesar archivo:", err);
        alert("Error al procesar el archivo. Verifique el formato.");
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      alert("Error al leer el archivo.");
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  const handleSaveParcelas = async () => {
    const newErrors = {
      finca: !selectedFinca,
      nombre: !manualNombre
    };
    
    setErrors(newErrors);

    if (newErrors.finca || newErrors.nombre) {
      return;
    }

    if (treeConfig.separacionArboles <= 0 || treeConfig.separacionFilas <= 0) {
      alert("El marco de plantación debe tener valores positivos");
      return;
    }

    try {
      setIsSaving(true);
      
      for (let i = 0; i < parsedParcelas.length; i++) {
        const p = parsedParcelas[i];
        const treePoints = generateTreePoints(
          p.exterior,
          treeConfig.totalArboles,
          treeConfig.separacionArboles,
          treeConfig.separacionFilas
        );

        // If multiple, append index if name is shared
        const finalNombre = parsedParcelas.length === 1 
          ? manualNombre 
          : `${manualNombre} (${i + 1})`;

        const response = await fetch("/api/parcelas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fincaId: parseInt(selectedFinca),
            grupoId: selectedGrupo ? parseInt(selectedGrupo) : null,
            nombre: finalNombre,
            gmlData: JSON.stringify(p.exterior),
            puntosJson: treePoints,
            totalArboles: treeConfig.totalArboles,
            separacionArboles: treeConfig.separacionArboles,
            separacionFilas: treeConfig.separacionFilas
          })
        });

        if (!response.ok) {
          throw new Error(`Error al guardar la parcela ${p.nombre}`);
        }
      }

      setIsAdding(false);
      setCurrentStep(1);
      setParsedParcelas([]);
      setSelectedFinca("");
      setSelectedGrupo("");
      setManualNombre("");
      setErrors({});
      await fetchData();
    } catch (error: any) {
      console.error("Error saving parcelas:", error);
      alert(error.message || "Error al guardar las parcelas. Por favor, inténtelo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Seguro que quieres eliminar esta parcela?")) {
      await fetch(`/api/parcelas/${id}`, { method: "DELETE" });
      fetchData();
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Catastro GIS</h2>
          <p className="text-xs text-slate-400 font-medium">Importación y calibración de parcelas</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
        >
          <Plus size={20} />
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500 border border-white/20">
             <div className="w-16 h-1 bg-slate-100 rounded-full mx-auto mb-6"></div>
             <h3 className="text-2xl font-bold text-slate-800 mb-2">Nueva Parcela</h3>
             <p className="text-xs text-slate-400 mb-8 font-medium">Paso {currentStep} de 2 — Configuración SIG</p>
             
             {currentStep === 1 && (
               <div className="space-y-6">
                 <div className={`p-10 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden group hover:border-emerald-400 transition-colors cursor-pointer ${isParsing ? 'opacity-50 pointer-events-none' : ''}`}>
                   {isParsing ? (
                     <div className="flex flex-col items-center">
                       <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                       <span className="text-sm font-bold text-slate-400">Procesando SIG...</span>
                     </div>
                   ) : (
                     <>
                       <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="text-emerald-600" size={32} />
                       </div>
                       <span className="text-sm font-bold text-slate-400 tracking-tight">Arrastre archivo GML/TXT</span>
                       <span className="text-[10px] uppercase font-bold text-slate-300 mt-1">O pulse para seleccionar</span>
                       <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".gml,.txt" />
                     </>
                   )}
                 </div>
                 <button onClick={() => setIsAdding(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Descartar</button>
               </div>
             )}

             {currentStep === 2 && (
               <div className="space-y-6">
                 <div className="space-y-4">
                   <div className="space-y-1">
                     <label className={`label-caps px-1 ${errors.finca ? 'text-red-500 font-bold' : ''}`}>
                        Finca Destino {errors.finca && <span className="lowercase font-medium">— Requerido</span>}
                      </label>
                     <select 
                       className="w-full border-b-2 border-slate-100 py-3 bg-white focus:border-emerald-600 outline-none font-bold text-slate-700" 
                       value={selectedFinca} 
                       onChange={(e) => {
                          setSelectedFinca(e.target.value);
                          if (errors.finca) setErrors({...errors, finca: false});
                        }}
                     >
                       <option value="">Selección...</option>
                       {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                     </select>
                   </div>

                    <div className="space-y-1">
                      <label className={`label-caps px-1 ${errors.nombre ? 'text-red-500 font-bold' : ''}`}>
                        Nombre de Parcela {errors.nombre && <span className="lowercase font-medium">— Requerido</span>}
                      </label>
                      <input 
                        type="text"
                        placeholder="Ej. Sector Norte B-12"
                        className={`w-full border-b-2 py-3 bg-white focus:border-emerald-600 outline-none font-bold text-slate-700 transition-colors ${errors.nombre ? 'border-red-500' : 'border-slate-100'}`}
                        value={manualNombre}
                        onChange={(e) => {
                          setManualNombre(e.target.value);
                          if (errors.nombre) setErrors({...errors, nombre: false});
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="label-caps px-1">Grupo de Gestión</label>
                     <select 
                       className="w-full border-b-2 border-slate-100 py-3 bg-white focus:border-emerald-600 outline-none font-bold text-slate-700" 
                       value={selectedGrupo} 
                       onChange={(e) => setSelectedGrupo(e.target.value)}
                     >
                       <option value="">Independiente</option>
                       {grupos.filter(g => g.finca_id === parseInt(selectedFinca)).map(g => (
                         <option key={g.id} value={g.id}>{g.nombre}</option>
                       ))}
                     </select>
                   </div>
                 </div>

                 <div className="bg-slate-900 text-white p-6 rounded-[28px] space-y-5 shadow-inner">
                   <h4 className="label-caps text-emerald-400 flex items-center gap-2"><MapPin size={14}/> Marco Teórico</h4>
                   <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                     <div className="col-span-2">
                       <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">Densidad de Copa (Arbolado)</label>
                       <input 
                         type="number" className="w-full bg-slate-800 border-none p-3 rounded-xl text-emerald-400 font-mono font-bold focus:ring-1 ring-emerald-500 transition-all outline-none" 
                         value={treeConfig.totalArboles}
                         onChange={e => setTreeConfig({...treeConfig, totalArboles: parseInt(e.target.value)})} 
                       />
                     </div>
                     <div>
                       <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">Eje X (m)</label>
                       <input 
                         type="number" className="w-full bg-slate-800 border-none p-3 rounded-xl text-emerald-400 font-mono font-bold outline-none" 
                         value={treeConfig.separacionArboles}
                         onChange={e => setTreeConfig({...treeConfig, separacionArboles: parseFloat(e.target.value)})}
                       />
                     </div>
                     <div>
                       <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">Eje Y (m)</label>
                       <input 
                         type="number" className="w-full bg-slate-800 border-none p-3 rounded-xl text-emerald-400 font-mono font-bold outline-none" 
                         value={treeConfig.separacionFilas}
                         onChange={e => setTreeConfig({...treeConfig, separacionFilas: parseFloat(e.target.value)})}
                       />
                     </div>
                   </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                   <button 
                      onClick={() => setCurrentStep(1)} 
                      disabled={isSaving}
                      className="flex-1 py-4 text-slate-400 font-bold text-xs uppercase disabled:opacity-50"
                    >
                      Atrás
                    </button>
                   <button 
                      onClick={handleSaveParcelas} 
                      disabled={isSaving}
                      className="flex-1 button-emerald uppercase text-xs tracking-widest shadow-emerald-200 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Guardando...
                        </>
                      ) : (
                        "Finalizar"
                      )}
                    </button>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {parcelas.map((parcela) => (
          <div key={parcela.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group active:bg-slate-50 transition-colors">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-all shadow-inner border border-slate-100">
                <MapIcon size={24} />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800 block leading-none">{parcela.nombre}</span>
                <div className="flex gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{parcela.total_arboles} ÁRBOL.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{parcela.separacion_arboles}x{parcela.separacion_filas}m</span>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => handleDelete(parcela.id)}
              className="p-3 text-slate-200 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-2xl transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
