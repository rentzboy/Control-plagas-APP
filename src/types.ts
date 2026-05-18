export interface Finca {
  id: number;
  nombre: string;
}

export interface GrupoParcelas {
  id: number;
  finca_id: number;
  nombre: string;
}

export interface Parcela {
  id: number;
  finca_id: number;
  grupo_id: number | null;
  nombre: string;
  gml_data: string;
  puntos_json: string; // JSON of Point[]
  total_arboles: number;
  separacion_arboles: number;
  separacion_filas: number;
}

export interface Plaga {
  id: number;
  nombre: string;
}

export interface Revision {
  id: number;
  finca_id: number;
  parcela_id: number;
  plaga_id: number;
  fecha: string;
  datos_puntos_json: string; // JSON of map { treeIndex: rating }
  // Joined fields
  finca_nombre?: string;
  parcela_nombre?: string;
  plaga_nombre?: string;
}

export interface TreeRatingData {
  rating: number; // 0, 1, 2
  note?: string;
  photoUrl?: string; // Future use
}

export interface TreeRating {
  [treeIndex: number]: TreeRatingData | number; 
}

export interface DashboardStats {
  totals: { fincas: number; parcelas: number; revisiones: number };
  healthDist: { name: string; value: number; color: string }[];
}
