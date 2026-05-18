import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Layers, Check, X } from "lucide-react";
import { Finca, GrupoParcelas, Parcela } from "../types";

export default function GruposView() {
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [grupos, setGrupos] = useState<GrupoParcelas[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoParcelas | null>(null);
  const [selectedFinca, setSelectedFinca] = useState<string>("");
  const [newGrupoNombre, setNewGrupoNombre] = useState("");
  const [editGrupoNombre, setEditGrupoNombre] = useState("");
  const [selectedParcelas, setSelectedParcelas] = useState<number[]>([]);

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

  const handleAddGrupo = async () => {
    if (!newGrupoNombre || !selectedFinca) return;
    await fetch("/api/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fincaId: parseInt(selectedFinca), nombre: newGrupoNombre }),
    });
    setNewGrupoNombre("");
    setIsAdding(false);
    fetchData();
  };

  const handleStartEdit = (grupo: GrupoParcelas) => {
    setEditingGrupo(grupo);
    setEditGrupoNombre(grupo.nombre);
    // Find parcelas currently in this group
    const currentParcelas = parcelas
      .filter(p => p.grupo_id === grupo.id)
      .map(p => p.id);
    setSelectedParcelas(currentParcelas);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!editingGrupo || !editGrupoNombre) return;
    setIsSaving(true);

    try {
      // Update group name
      await fetch(`/api/grupos/${editingGrupo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editGrupoNombre }),
      });

      // Update parcelas associations
      // 1. Get all parcelas for this finca
      const fincaParcelas = parcelas.filter(p => p.finca_id === editingGrupo.finca_id);
      
      for (const p of fincaParcelas) {
        const isInSelected = selectedParcelas.includes(p.id);
        const isCurrentlyInGroup = p.grupo_id === editingGrupo.id;

        if (isInSelected && !isCurrentlyInGroup) {
          // Add to group (Partial update is now safe)
          await fetch(`/api/parcelas/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grupoId: editingGrupo.id }),
          });
        } else if (!isInSelected && isCurrentlyInGroup) {
          // Remove from group (Partial update is now safe)
          await fetch(`/api/parcelas/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grupoId: null }),
          });
        }
      }

      setEditingGrupo(null);
      await fetchData();
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Error al guardar los cambios del grupo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Eliminar este grupo de parcelas? Las parcelas asociadas quedarán sin grupo.")) {
      await fetch(`/api/grupos/${id}`, { method: "DELETE" });
      fetchData();
    }
  };

  const toggleParcela = (id: number) => {
    setSelectedParcelas(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Grupos de parcelas</h2>
          <p className="text-xs text-slate-400 font-medium">Organice sus parcelas por sectores</p>
        </div>
        {!isAdding && !editingGrupo && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-7 rounded-[32px] shadow-xl border border-slate-100 mb-8 space-y-5 animate-in slide-in-from-top-2 duration-300">
          <div className="space-y-1">
            <label className="label-caps px-1">Finca Asociada</label>
            <select 
              className="w-full border-b-2 border-slate-100 py-3 bg-white focus:border-emerald-600 outline-none font-bold text-slate-700" 
              value={selectedFinca} 
              onChange={(e) => setSelectedFinca(e.target.value)}
            >
              <option value="">Selección...</option>
              {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label-caps px-1">Nombre del Sector</label>
            <input 
              className="w-full border-b-2 border-slate-100 py-3 focus:border-emerald-600 outline-none font-bold text-slate-700 placeholder:text-slate-200"
              placeholder="Ej. Sector Norte B..."
              value={newGrupoNombre}
              onChange={(e) => setNewGrupoNombre(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setIsAdding(false)} className="px-5 py-2 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
            <button onClick={handleAddGrupo} className="button-emerald text-xs uppercase px-8">Crear Grupo</button>
          </div>
        </div>
      )}

      {editingGrupo && (
        <div className="bg-white p-7 rounded-[32px] shadow-xl border border-slate-100 mb-8 space-y-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center">
            <h3 className="label-caps font-bold text-emerald-600">Editando Sector</h3>
            <button onClick={() => setEditingGrupo(null)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="label-caps px-1">Nombre del Sector</label>
              <input 
                className="w-full border-b-2 border-slate-100 py-3 focus:border-emerald-600 outline-none font-bold text-slate-700"
                value={editGrupoNombre}
                onChange={(e) => setEditGrupoNombre(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="label-caps px-1">Gestionar Parcelas</label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {parcelas.filter(p => p.finca_id === editingGrupo.finca_id).map(parcela => {
                  const otherGroup = parcela.grupo_id && parcela.grupo_id !== editingGrupo.id 
                    ? grupos.find(g => g.id === parcela.grupo_id)
                    : null;
                  
                  return (
                    <div 
                      key={parcela.id} 
                      onClick={() => !isSaving && toggleParcela(parcela.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedParcelas.includes(parcela.id) 
                          ? 'border-emerald-200 bg-emerald-50' 
                          : 'border-slate-100 bg-white hover:bg-slate-50'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${selectedParcelas.includes(parcela.id) ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {parcela.nombre}
                        </span>
                        {otherGroup && !selectedParcelas.includes(parcela.id) && (
                          <span className="text-[10px] text-slate-400">En: {otherGroup.nombre}</span>
                        )}
                      </div>
                      {selectedParcelas.includes(parcela.id) && (
                        <Check size={16} className="text-emerald-600" />
                      )}
                    </div>
                  );
                })}
                {parcelas.filter(p => p.finca_id === editingGrupo.finca_id).length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-400">No hay parcelas creadas en esta finca</div>
                )}
              </div>
            </div>
          </div>
 
          <div className="flex justify-end gap-3 pt-2">
            <button 
              onClick={() => setEditingGrupo(null)} 
              disabled={isSaving}
              className="px-5 py-2 text-slate-400 font-bold text-xs uppercase disabled:opacity-30"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveEdit} 
              disabled={isSaving}
              className="button-emerald text-xs uppercase px-8 disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {fincas.map(finca => {
          const fincaGrupos = grupos.filter(g => g.finca_id === finca.id);
          if (fincaGrupos.length === 0) return null;

          return (
            <div key={finca.id} className="space-y-4">
              <h3 className="label-caps opacity-60 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> {finca.nombre}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {fincaGrupos.map(grupo => {
                  const numParcelas = parcelas.filter(p => p.grupo_id === grupo.id).length;
                  return (
                    <div key={grupo.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-xl flex items-center justify-center">
                          <Layers size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{grupo.nombre}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{numParcelas} Parcelas</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleStartEdit(grupo)} 
                          className="text-slate-300 hover:text-emerald-600 p-2 rounded-xl hover:bg-emerald-50 transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(grupo.id)} 
                          className="text-slate-300 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {grupos.length === 0 && !isAdding && (
          <div className="text-center py-20 opacity-30 select-none">
            <Layers size={64} className="mx-auto mb-2" />
            <p>No hay grupos creados</p>
          </div>
        )}
      </div>
    </div>
  );
}
