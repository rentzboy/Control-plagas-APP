import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ChevronRight, Home, Layers, X, Check } from "lucide-react";
import { Finca, GrupoParcelas } from "../types";

export default function FincasView() {
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [grupos, setGrupos] = useState<GrupoParcelas[]>([]);
  const [newFincaNombre, setNewFincaNombre] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addingGrupoToFinca, setAddingGrupoToFinca] = useState<number | null>(null);
  const [newGrupoNombre, setNewGrupoNombre] = useState("");
  const [editingFincaId, setEditingFincaId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [deletingFincaId, setDeletingFincaId] = useState<number | null>(null);
  const [deletingGrupoId, setDeletingGrupoId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rf, rg] = await Promise.all([
      fetch("/api/fincas"),
      fetch("/api/grupos")
    ]);
    setFincas(await rf.json());
    setGrupos(await rg.json());
  };

  const handleAddFinca = async () => {
    if (!newFincaNombre) return;
    await fetch("/api/fincas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newFincaNombre }),
    });
    setNewFincaNombre("");
    setIsAdding(false);
    fetchData();
  };

  const handleAddGrupo = async (fincaId: number) => {
    if (!newGrupoNombre) return;
    await fetch("/api/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fincaId, nombre: newGrupoNombre }),
    });
    setNewGrupoNombre("");
    setAddingGrupoToFinca(null);
    fetchData();
  };

  const startRename = (finca: Finca) => {
    setEditingFincaId(finca.id);
    setEditNombre(finca.nombre);
  };

  const handleRename = async () => {
    if (!editingFincaId || !editNombre) return;
    await fetch(`/api/fincas/${editingFincaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editNombre }),
    });
    setEditingFincaId(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/fincas/${id}`, { method: "DELETE" });
    setDeletingFincaId(null);
    fetchData();
  };

  const handleDeleteGrupo = async (id: number) => {
    await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    setDeletingGrupoId(null);
    fetchData();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Mis Fincas</h2>
          <p className="text-xs text-slate-400 font-medium">Gestione sus explotaciones agrícolas</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
        >
          <Plus size={20} />
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-emerald-100 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <label className="label-caps mb-2 block">Nombre de la Finca</label>
          <input 
            autoFocus
            className="w-full border-b-2 border-emerald-600 py-3 text-lg font-semibold focus:outline-none placeholder:text-slate-200"
            placeholder="Ej. La Esperanza..."
            value={newFincaNombre}
            onChange={(e) => setNewFincaNombre(e.target.value)}
          />
          <div className="flex justify-end mt-6 gap-3">
            <button onClick={() => setIsAdding(false)} className="px-5 py-2 text-slate-400 font-bold text-sm">CANCELAR</button>
            <button onClick={handleAddFinca} className="button-emerald text-sm uppercase px-6">Crear Finca</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {fincas.map((finca) => {
          const fincaGrupos = grupos.filter(g => g.finca_id === finca.id);
          return (
            <div key={finca.id} className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 flex items-center justify-between group border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-bold text-lg">
                    {finca.nombre.charAt(0)}
                  </div>
                  <div>
                    {editingFincaId === finca.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          autoFocus
                          className="border-b-2 border-emerald-600 bg-transparent font-bold text-slate-800 outline-none"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        />
                        <button onClick={handleRename} className="text-emerald-600 p-1"><Check size={16}/></button>
                        <button onClick={() => setEditingFincaId(null)} className="text-slate-300 p-1"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-base font-bold text-slate-800 block leading-tight">{finca.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">ID: REF-{finca.id.toString().padStart(4, '0')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setAddingGrupoToFinca(finca.id)}
                    className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    title="Añadir Sector"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => startRename(finca)}
                    className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    title="Renombrar"
                  >
                    <Edit2 size={16} />
                  </button>
                  {deletingFincaId === finca.id ? (
                    <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
                      <button onClick={() => handleDelete(finca.id)} className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">CONFIRMAR</button>
                      <button onClick={() => setDeletingFincaId(null)} className="p-1 text-slate-300"><X size={16}/></button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeletingFincaId(finca.id)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Grupos/Sectores List */}
              <div className="bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="label-caps opacity-40">Sectores / Grupos</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{fincaGrupos.length}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  {fincaGrupos.map(g => (
                    <div key={g.id} className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-100/50 group/item">
                      <div className="flex items-center gap-2">
                        <Layers size={10} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">{g.nombre}</span>
                      </div>
                      {deletingGrupoId === g.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteGrupo(g.id)} className="text-[8px] font-bold text-red-600 px-2 py-0.5 border border-red-100 rounded bg-red-50">BORRAR</button>
                          <button onClick={() => setDeletingGrupoId(null)} className="p-1 text-slate-300"><X size={10}/></button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingGrupoId(g.id)}
                          className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {fincaGrupos.length === 0 && !addingGrupoToFinca && (
                    <p className="text-[10px] text-slate-300 italic px-2">Sin sectores definidos</p>
                  )}
                </div>

                {addingGrupoToFinca === finca.id && (
                  <div className="bg-white p-3 rounded-2xl border border-emerald-200 mt-2 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2">
                      <input 
                        autoFocus
                        placeholder="Nombre del sector..."
                        className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none"
                        value={newGrupoNombre}
                        onChange={(e) => setNewGrupoNombre(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddGrupo(finca.id)}
                      />
                      <button onClick={() => setAddingGrupoToFinca(null)} className="p-1 text-slate-300"><X size={14}/></button>
                      <button onClick={() => handleAddGrupo(finca.id)} className="bg-emerald-600 text-white p-1 rounded-lg"><Plus size={14}/></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {fincas.length === 0 && !isAdding && (
          <div className="text-center py-20 opacity-30 select-none">
            <Home size={64} className="mx-auto mb-2" />
            <p>No tienes fincas cargadas</p>
          </div>
        )}
      </div>
    </div>
  );
}
