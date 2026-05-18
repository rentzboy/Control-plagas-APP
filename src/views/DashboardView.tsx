import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Home, Map as MapIcon, ClipboardCheck, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DashboardStats } from '../types';

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then(res => res.json()).then(setStats);
  }, []);

  if (!stats) return <div className="p-10 text-center animate-pulse">Cargando inteligencia...</div>;

  const totalValue = stats.healthDist.reduce((a, b) => a + b.value, 0);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Centro de Inteligencia</h2>
        <p className="text-xs text-slate-400 font-medium">Resumen analítico de sus explotaciones</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="label-caps text-[8px] mb-1">Fincas</p>
          <p className="text-xl font-bold text-slate-800">{stats.totals.fincas}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="label-caps text-[8px] mb-1">Parcelas</p>
          <p className="text-xl font-bold text-slate-800">{stats.totals.parcelas}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="label-caps text-[8px] mb-1">Revisiones</p>
          <p className="text-xl font-bold text-slate-800">{stats.totals.revisiones}</p>
        </div>
      </div>

      {/* Health Distribution Chart */}
      <div className="card-sleek">
        <h3 className="label-caps mb-6 flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-500" /> Distribución de Salud Global
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.healthDist}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.healthDist.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex justify-around mt-4">
          {stats.healthDist.map(item => (
            <div key={item.name} className="text-center">
               <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color }}></div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.name}</p>
               <p className="text-sm font-bold text-slate-700">{totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Alerts */}
      <div className="space-y-4">
        <h3 className="label-caps">Alertas y Recomendaciones AI</h3>
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-4 items-start">
           <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><AlertTriangle size={20} /></div>
           <div>
             <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">Riesgo de Gomosis detectado</p>
             <p className="text-[10px] text-amber-700 mt-0.5">El patrón de humedad actual en la Parcela Norte favorece la aparición de hongos. Se recomienda inspección.</p>
           </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-4 items-start">
           <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><ShieldCheck size={20} /></div>
           <div>
             <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Sector Este protegido</p>
             <p className="text-[10px] text-emerald-700 mt-0.5">Las últimas 3 revisiones muestran un índice de salud del 98%. Mantener riego actual.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
