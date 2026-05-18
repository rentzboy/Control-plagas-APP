import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { 
  Plus,
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
  const [focusLocation, setFocusLocation] = useState<Point | null>(null);
  const [treeRatings, setTreeRatings] = useState<TreeRating>({});
  const [selectedTreeIndex, setSelectedTreeIndex] = useState<number | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [interpolatedRatings, setInterpolatedRatings] = useState<TreeRating>({});
  const [currentNote, setCurrentNote] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [activeRevisionId, setActiveRevisionId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [selectedFinca, selectedPlaga]);

  // KNN Spatial Interpolation for Heatmap
  useEffect(() => {
    if (activeParcela && Object.keys(treeRatings).length > 0) {
      const allPoints: Point[] = JSON.parse(activeParcela.puntos_json);
      const result: TreeRating = { ...treeRatings };
      const ratedIndices = Object.keys(treeRatings).map(Number);
      
      const k = 5; // number of neighbors
      
      allPoints.forEach((p, i) => {
        if (treeRatings[i] !== undefined) return;
        
        // Simple distance-weighted KNN
        const distances = ratedIndices.map(idx => {
          const p2 = allPoints[idx];
          const d = Math.sqrt(Math.pow(p.lat - p2.lat, 2) + Math.pow(p.lng - p2.lng, 2));
          return { index: idx, dist: d };
        });
        
        distances.sort((a, b) => a.dist - b.dist);
        const neighbors = distances.slice(0, k);
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        neighbors.forEach(n => {
          const weight = 1 / (Math.max(n.dist, 0.000001));
          weightedSum += treeRatings[n.index].rating * weight;
          totalWeight += weight;
        });
        
        if (totalWeight > 0) {
          result[i] = { rating: weightedSum / totalWeight, isEstimated: true };
        }
      });
      
      setInterpolatedRatings(result);
    } else {
      setInterpolatedRatings({});
    }
  }, [treeRatings, activeParcela]);

  const fetchData = async () => {
    const [rf, rpl] = await Promise.all([
      fetch("/api/fincas"),
      fetch("/api/plagas")
    ]);
    setFincas(await rf.json());
    setPlagas(await rpl.json());
  };

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFinca) params.append("fincaId", selectedFinca);
      if (selectedPlaga) params.append("plagaId", selectedPlaga);
      
      const res = await fetch(`/api/revisiones?${params.toString()}`);
      setRevisionHistory(await res.json());
    } catch (e) {
      console.error("Error fetching history");
    }
  };

  const reCenterMap = () => {
    if (activeParcela) {
      // Small state toggle to force MapPlot to re-run its centering effect
      // or we could pass center/zoom as props. MapPlot already does this in useEffect.
      // We'll just trigger it by forcing a minor update if needed, but usually 
      // just clicking should work if we had the state here.
      // Let's implement it inside MapPlot actually, or pass it.
    }
  };

  const loadParcelas = async () => {
    if (!selectedFinca) return;
    const rp = await fetch(`/api/parcelas?fincaId=${selectedFinca}`);
    setParcelas(await rp.json());
    setShowMap(true);
  };

  useEffect(() => {
    let watchId: number;
    const startGPS = () => {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition((pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, (err) => console.error(err), { enableHighAccuracy: true });
      }
    };
    if (activeParcela) {
      startGPS();
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeParcela]);

  const startRevision = (parcela: any) => {
    if (!selectedPlaga) {
      alert("Selecciona primero una plaga para la revisión");
      return;
    }
    setActiveRevisionId(null);
    setActiveParcela(parcela);
    setTreeRatings({});
    setShowHeatmap(false);
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRateTree = (rating: number) => {
    if (selectedTreeIndex === null) return;
    setTreeRatings(prev => ({ 
      ...prev, 
      [selectedTreeIndex]: { 
        rating, 
        note: currentNote,
        photoUrl: currentPhoto || undefined
      } 
    }));
    setSelectedTreeIndex(null);
    setCurrentNote("");
    setCurrentPhoto(null);
  };

  const finishRevision = async () => {
    try {
      let method = "POST";
      let url = "/api/revisiones";
      
      if (activeRevisionId) {
        method = "PUT";
        url = `/api/revisiones/${activeRevisionId}`;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fincaId: parseInt(selectedFinca),
          parcelaId: activeParcela?.id,
          plagaId: parseInt(selectedPlaga),
          fecha: selectedFecha,
          datosPuntosJson: treeRatings
        })
      });

      if (response.ok) {
        // Refresh history and cleanup states to return to main menu
        await fetchHistory();
        setActiveParcela(null);
        setActiveRevisionId(null);
        setShowHeatmap(false);
        setShowMap(false);
        setIsCreating(false);
        setTreeRatings({});
      } else {
        alert("Error al guardar los datos. Inténtelo de nuevo.");
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("Error de conexión al guardar.");
    }
  };

  const viewHistoricalHeatmap = (rev: any) => {
    fetch(`/api/parcelas?fincaId=${rev.finca_id}`).then(res => res.json()).then(pars => {
      const p = pars.find((pa: any) => pa.id === rev.parcela_id);
      if (p) {
        setActiveRevisionId(rev.id);
        setActiveParcela(p);
        setTreeRatings(JSON.parse(rev.datos_puntos_json || '{}'));
        setShowHeatmap(false);
        setSelectedPlaga(rev.plaga_id.toString());
        setSelectedFinca(rev.finca_id.toString());
      } else {
        alert("Error: No se ha encontrado la parcela asociada a esta revisión en la base de datos.");
      }
    }).catch(err => {
      console.error("Error al cargar datos históricos:", err);
      alert("Error al cargar los datos históricos de la revisión.");
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
            onClick={finishRevision}
            className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Check size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">Guardar</span>
          </button>
        </div>

        <div className="flex-1 relative">
            <MapPlot 
              parcelas={[activeParcela]} 
              treePoints={treePoints}
              userLocation={userLocation}
              onSelectTree={setSelectedTreeIndex}
              ratings={showHeatmap ? interpolatedRatings : treeRatings}
              showHeatmap={showHeatmap}
              focusLocation={focusLocation}
            />
          
          <div className="absolute top-4 right-4 flex flex-col gap-3">
            {userLocation && (
              <button 
                onClick={() => {
                   // Center on user
                   setFocusLocation({...userLocation}); 
                }}
                className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center active:scale-95"
              >
                <Navigation size={20} className="text-blue-600" />
              </button>
            )}
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-3 rounded-2xl shadow-xl border transition-all active:scale-95 ${showHeatmap ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
              title="Mapa de Calor"
            >
              <Bug size={20} />
            </button>
            <button 
              onClick={() => {
                // Focus on parcel
                const first = treePoints[0];
                if (first) {
                   setFocusLocation({...first});
                }
              }}
              className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-slate-600 flex items-center justify-center active:scale-95"
              title="Centrar Parcela"
            >
              <MapIcon size={20} />
            </button>
          </div>

          {treePoints.length === 0 && (
            <div className="absolute top-20 left-6 right-6 bg-red-500/90 text-white p-3 rounded-xl text-[10px] font-bold text-center z-30 animate-bounce">
              ⚠️ NO SE HAN ENCONTRADO ÁRBOLES EN ESTA PARCELA
            </div>
          )}

          {selectedTreeIndex !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 p-6">
              <div className="bg-white rounded-[32px] shadow-2xl animate-in fade-in zoom-in duration-300 w-full max-w-sm border border-white/20 overflow-hidden">
                <div className="p-8">
                  <h4 className="label-caps text-center mb-6">Detalles de Inspección</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Evidencia Fotográfica</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-emerald-500 transition-colors cursor-pointer bg-slate-50">
                          {currentPhoto ? (
                            <div className="relative w-full h-20">
                              <img src={currentPhoto} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                              <button 
                                onClick={(e) => { e.preventDefault(); setCurrentPhoto(null); }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="mx-auto w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                                <Bug size={16} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">TOMAR FOTO</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handlePhotoUpload}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Nota de Campo</label>
                      <textarea 
                        value={currentNote}
                        onChange={(e) => setCurrentNote(e.target.value)}
                        placeholder="Observaciones..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs outline-none focus:border-emerald-500 h-20 resize-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block text-center mb-4">Nivel de Afectación</label>
                    <div className="flex justify-between items-center px-4">
                      <button onClick={() => handleRateTree(0)} className="group flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-emerald-500 rounded-full ring-8 ring-emerald-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center">
                          <Check size={20}/>
                        </div>
                        <span className="text-[8px] font-bold text-emerald-600 uppercase">SANO</span>
                      </button>
                      
                      <button onClick={() => handleRateTree(1)} className="group flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-amber-400 rounded-full ring-8 ring-amber-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center font-bold">!</div>
                        <span className="text-[8px] font-bold text-amber-600 uppercase">LEVE</span>
                      </button>
                      
                      <button onClick={() => handleRateTree(2)} className="group flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-red-600 rounded-full ring-8 ring-red-50 shadow-lg active:scale-75 transition-all text-white flex items-center justify-center font-bold">X</div>
                        <span className="text-[8px] font-bold text-red-600 uppercase">GRAVE</span>
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={() => setSelectedTreeIndex(null)} className="w-full mt-8 text-slate-400 font-bold text-[10px] tracking-widest uppercase py-2">Cancelar</button>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="p-6 space-y-10 pb-20">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Nueva Inspección</h2>
          <p className="text-xs text-slate-400 font-medium">Inicie una revisión de campo geolocalizada</p>
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
            disabled={!selectedFinca || !selectedPlaga}
            className="w-full button-emerald py-5 flex items-center justify-center gap-3 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
          >
            <MapIcon size={20} />
            CARGAR PARCELARIO
          </button>
          
          <button 
            onClick={() => { setIsCreating(false); setShowMap(false); }}
            className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors pb-2 pt-2"
          >
            Cancelar Nueva Revisión
          </button>
        </div>

        {showMap && (
          <div className="space-y-4 pb-10">
            <div className="flex items-center justify-between">
              <h3 className="label-caps">Unidades de Cultivo Disponibles</h3>
            </div>
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
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Revisiones</h2>
        <p className="text-xs text-slate-400 font-medium">Gestión y registro de visitas a campo</p>
      </div>

      <button 
        onClick={() => {
          setIsCreating(true);
          setSelectedFinca("");
          setSelectedPlaga("");
          setShowMap(false);
        }} 
        className="w-full button-emerald py-5 flex items-center justify-center gap-3 shadow-emerald-200 shadow-xl"
      >
        <Plus size={22} />
        <span className="font-bold uppercase tracking-widest text-sm">NUEVA REVISIÓN</span>
      </button>

      <div className="space-y-6 bg-white p-7 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="label-caps text-slate-800">Filtros de Búsqueda</h3>
        
        <div className="space-y-2 relative">
          <select 
            className="w-full border border-slate-100 rounded-xl py-3 px-4 bg-slate-50 focus:border-emerald-500 transition-colors outline-none font-bold text-slate-700 appearance-none" 
            value={selectedFinca} 
            onChange={(e) => setSelectedFinca(e.target.value)}
          >
            <option value="">Todas las Fincas</option>
            {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>

        <div className="space-y-2 relative">
          <select 
            className="w-full border border-slate-100 rounded-xl py-3 px-4 bg-slate-50 focus:border-emerald-500 transition-colors outline-none font-bold text-slate-700 appearance-none" 
            value={selectedPlaga} 
            onChange={(e) => setSelectedPlaga(e.target.value)}
          >
            <option value="">Todas las Plagas</option>
            {plagas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>

        {(selectedFinca || selectedPlaga) && (
          <button 
            onClick={() => { setSelectedFinca(""); setSelectedPlaga(""); }}
            className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors pt-2"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

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
                      <span className="text-[9px] font-bold text-slate-300">
                        {new Date(rev.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
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
    </div>
  );
}
