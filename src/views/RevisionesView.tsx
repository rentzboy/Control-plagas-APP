import { useState, useEffect, useCallback } from "react";
import { 
  Play, 
  Map as MapIcon, 
  ChevronDown, 
  Calendar, 
  Bug, 
  CheckCircle2, 
  Navigation,
  X,
  Check,
  Home,
  ClipboardCheck
} from "lucide-react";
import MapPlot from "../components/MapPlot";
import { Finca, Plaga, Parcela, TreeRating } from "../types";
import { Point } from "../utils/gmlParser";

export default function RevisionesView() {
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [plagas, setPlagas] = useState<Plaga[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  
  // Selection state
  const [selectedFinca, setSelectedFinca] = useState<string>("");
  const [selectedPlaga, setSelectedPlaga] = useState<string>("");
  const [selectedFecha, setSelectedFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showMap, setShowMap] = useState(false);
  
  // Active Inspection state
  const [activeParcela, setActiveParcela] = useState<Parcela | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [treeRatings, setTreeRatings] = useState<TreeRating>({});
  const [selectedTreeIndex, setSelectedTreeIndex] = useState<number | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  const fetchData = async () => {
    const [rf, rpl] = await Promise.all([
      fetch("/api/fincas"),
      fetch("/api/plagas")
    ]);
    setFincas(await rf.json());
    setPlagas(await rpl.json());
  };

  const fetchHistory = async () => {
    const res = await fetch("/api/revisiones");
    setRevisionHistory(await res.json());
  };

  const loadParcelas = async () => {
    if (!selectedFinca) return;
    const rp = await fetch(`/api/parcelas?fincaId=${selectedFinca}`);
    setParcelas(await rp.json());
    setShowMap(true);
  };

  const startRevision = (parcela: any) => {
    if (!selectedPlaga) {
      alert("Selecciona primero una plaga para la revisión");
      return;
    }
    setActiveParcela(parcela);
    setTreeRatings({});
    startGPS();
  };

  const startGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => console.error(err), { enableHighAccuracy: true });
    }
  };

  const handleRateTree = (rating: number) => {
    if (selectedTreeIndex === null) return;
    setTreeRatings(prev => ({ 
      ...prev, 
      [selectedTreeIndex]: { rating, note: currentNote } 
    }));
    setSelectedTreeIndex(null);
    setCurrentNote("");
  };

  const finishRevision = async (voirResults: boolean) => {
    if (voirResults) {
      setShowHeatmap(true);
    }
    
    await fetch("/api/revisiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fincaId: parseInt(selectedFinca),
        parcelaId: activeParcela?.id,
        plagaId: parseInt(selectedPlaga),
        fecha: selectedFecha,
        datosPuntosJson: JSON.stringify(treeRatings)
      })
    });

    fetchHistory();

    if (!voirResults) {
      setActiveParcela(null);
      setShowHeatmap(false);
    }
  };

  const viewHistoricalHeatmap = (rev: any) => {
    // Para simplificar, cargamos la parcela y los datos guardados
    fetch(`/api/parcelas?fincaId=${rev.finca_id}`).then(res => res.json()).then(pars => {
      const p = pars.find((pa: any) => pa.id === rev.parcela_id);
      if (p) {
        setActiveParcela(p);
        setTreeRatings(JSON.parse(rev.datos_puntos_json));
        setShowHeatmap(true);
        setSelectedPlaga(rev.plaga_id.toString());
      }
    });
  };

  if (activeParcela) {
    const treePoints: Point[] = JSON.parse(activeParcela.puntos_json);
    
    return (
      <div className="fixed inset-0 bg-slate-50 z-[60] flex flex-col">
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveParcela(null)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{activeParcela.nombre}</h3>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-wider">
                  {plagas.find(p => p.id === parseInt(selectedPlaga))?.nombre}
                </span>
                <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span className="text-[9px] font-bold text-emerald-700 uppercase">GPS LIVE</span>
                </div>
              </div>
            </div>
          </div>
          <button 
            onContextMenu={(e) => { e.preventDefault(); finishRevision(true); }}
            onClick={() => { if(confirm("¿Terminar revisión?")) finishRevision(confirm("¿Ver mapa de calor?")); }}
            className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <Check size={20} />
          </button>
        </div>

        <div className="flex-1 relative">
          <MapPlot 
            parcelas={[activeParcela]} 
            treePoints={treePoints}
            userLocation={userLocation}
            onSelectTree={setSelectedTreeIndex}
            ratings={showHeatmap ? treeRatings : {}}
          />
          
          {userLocation && (
             <div className="absolute top-4 right-4 bg-white p-3 rounded-2xl shadow-xl border border-slate-100">
               <Navigation size={20} className="text-blue-600" />
             </div>
          )}

          {selectedTreeIndex !== null && !showHeatmap && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] z-10 transition-all duration-300">
              <div className="bg-white p-10 rounded-[32px] shadow-2xl scale-110 animate-in zoom-in duration-300 w-72 border border-white/20">
                <h4 className="label-caps text-center mb-8">Gravedad Detectada</h4>
                
                <div className="mb-6">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Nota de Campo (Opcional)</label>
                  <textarea 
                    value={currentNote}
                    onChange={(e) => setCurrentNote(e.target.value)}
                    placeholder="Describe síntomas..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs outline-none focus:border-emerald-500 h-20 resize-none font-medium"
                  />
                </div>

                <div className="flex justify-between items-center px-2">
                  <button onClick={() => handleRateTree(0)} className="w-12 h-12 bg-emerald-500 rounded-full ring-8 ring-emerald-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center"><Check size={20}/></button>
                  <button onClick={() => handleRateTree(1)} className="w-12 h-12 bg-amber-400 rounded-full ring-8 ring-amber-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center font-bold">!</button>
                  <button onClick={() => handleRateTree(2)} className="w-12 h-12 bg-red-600 rounded-full ring-8 ring-red-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center font-bold">X</button>
                </div>
                <button onClick={() => setSelectedTreeIndex(null)} className="w-full mt-10 text-slate-400 font-bold text-[10px] tracking-widest uppercase">Cancelar Acción</button>
              </div>
            </div>
          )}

          {showHeatmap && (
            <div className="absolute bottom-10 left-6 right-6 bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-2xl z-20 border border-slate-200">
               <div className="flex items-center gap-3 mb-3">
                 <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><MapIcon size={20}/></div>
                 <div>
                   <p className="label-caps">Capas Geofísicas</p>
                   <p className="text-sm font-bold text-slate-800">Mapa de Calor Generado</p>
                 </div>
               </div>
               <p className="text-[10px] text-slate-400 italic mb-6 leading-relaxed">Los datos para árboles no revisados han sido calculados mediante inferencia espacial k-Nearest Neighbors.</p>
               <button 
                 onClick={() => { setActiveParcela(null); setShowHeatmap(false); }}
                 className="button-primary w-full text-xs uppercase tracking-widest"
               >
                 Guardar e Inspeccionar Siguiente
               </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Nueva Inspección</h2>
        <p className="text-xs text-slate-400 font-medium font-medium">Inicie una revisión de campo geolocalizada</p>
      </div>

      <div className="space-y-6 bg-white p-7 rounded-3xl shadow-sm border border-slate-100">
        <div className="space-y-2">
          <label className="label-caps flex items-center gap-2"><Home size={12}/> Finca de Origen</label>
          <select 
            className="w-full border-b-2 border-slate-100 py-3 bg-white focus:border-emerald-600 transition-colors outline-none font-bold text-slate-700" 
            value={selectedFinca} 
            onChange={(e) => setSelectedFinca(e.target.value)}
          >
            <option value="">Selección...</option>
            {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label-caps flex items-center gap-2"><Bug size={12}/> Vector de Plaga</label>
          <select 
            className="w-full border-b-2 border-slate-100 py-3 bg-white focus:border-emerald-600 transition-colors outline-none font-bold text-slate-700" 
            value={selectedPlaga} 
            onChange={(e) => setSelectedPlaga(e.target.value)}
          >
            <option value="">Selección...</option>
            {plagas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="label-caps flex items-center gap-2"><Calendar size={12}/> Fecha de Registro</label>
          <input 
            type="date"
            className="w-full border-b-2 border-slate-100 py-3 bg-white font-bold text-slate-700 outline-none" 
            value={selectedFecha} 
            onChange={(e) => setSelectedFecha(e.target.value)}
          />
        </div>

        <button 
          onClick={loadParcelas}
          disabled={!selectedFinca}
          className="w-full button-emerald py-5 flex items-center justify-center gap-3 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
        >
          <MapIcon size={20} />
          CARGAR PARCELARIO
        </button>
      </div>

      {showMap && (
        <div className="space-y-4 pb-10">
          <h3 className="label-caps">Unidades de Cultivo Disponibles</h3>
          <div className="grid grid-cols-1 gap-3">
            {parcelas.map(p => (
              <button 
                key={p.id}
                onClick={() => startRevision(p)}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all hover:bg-emerald-50/50 text-left"
              >
                <div>
                  <p className="font-bold text-slate-800">{p.nombre}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest leading-none">{p.total_arboles} INDIVIDUOS • {p.separacion_arboles}x{p.separacion_filas}m</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl text-slate-300">
                  <ChevronDown size={14} className="-rotate-90" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!showMap && (
        <div className="space-y-6 pt-4 border-t border-slate-100">
           <h3 className="text-base font-bold text-slate-800">Historial de Revisiones</h3>
           <div className="space-y-3 pb-10">
              {revisionHistory.length === 0 ? (
                <div className="text-center py-12 bg-white/50 rounded-3xl border-2 border-dashed border-slate-100">
                   <ClipboardCheck size={48} className="mx-auto mb-3 text-slate-200" />
                   <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin registros previos</p>
                </div>
              ) : (
                revisionHistory.map(rev => (
                  <button 
                    key={rev.id} 
                    onClick={() => viewHistoricalHeatmap(rev)}
                    className="w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="text-left">
                      <p className="font-bold text-slate-800">{rev.parcela_nombre}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded uppercase">{rev.plaga_nombre}</span>
                        <span className="text-[9px] font-bold text-slate-300">{rev.fecha}</span>
                      </div>
                    </div>
                    <div className="text-emerald-500 bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <MapIcon size={16} />
                    </div>
                  </button>
                ))
              )}
           </div>
        </div>
      )}
    </div>
  );
}
