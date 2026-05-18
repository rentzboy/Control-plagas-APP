import proj4 from "proj4";

// Define the UTM 30N projection (EPSG:25830)
// This is common for Spain mainland
proj4.defs("EPSG:25830", "+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs");

export interface Point {
  lat: number;
  lng: number;
}

export interface ParcelaData {
  nombre: string;
  exterior: Point[];
  area?: number;
}

export async function parseGML(gmlString: string): Promise<ParcelaData[]> {
  try {
    // Basic cleanup of the string to avoid common XML parser issues
    const cleanGML = gmlString.trim()
      .replace(/^[\uFEFF\uFFFE]/, '') // Remove BOM
      .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;'); // Escape raw ampersands

    if (!cleanGML.startsWith('<')) {
      // Try to parse as plain TXT coordinates (one point per line: X Y)
      const lines = cleanGML.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const points: Point[] = [];
      for (const line of lines) {
        const parts = line.split(/[\s,;]+/).map(Number).filter(n => !isNaN(n));
        if (parts.length >= 2) {
          const p = processPosList(`${parts[0]} ${parts[1]}`)[0];
          if (p) points.push(p);
        }
      }
      if (points.length >= 3) {
        return [{
          nombre: "Importación TXT",
          exterior: points
        }];
      }
      console.error("El archivo no parece ser un XML/GML válido ni un listado de coordenadas TXT");
      return [];
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanGML, "text/xml");
    
    // Check for parse errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      console.error("Error parsing XML details:", parserError[0].textContent);
      return [];
    }

    const parcels: ParcelaData[] = [];

    // Improved node finding using iterative search
    const getNodesByLocalName = (root: Node, name: string): Element[] => {
      const results: Element[] = [];
      const lowerName = name.toLowerCase();
      const traverse = (node: Node) => {
        if (node.nodeType === 1) { // Element
          const el = node as Element;
          const localName = el.localName || el.nodeName.split(':').pop();
          if (localName?.toLowerCase() === lowerName) {
            results.push(el);
          }
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
      };
      traverse(root);
      return results;
    };

    const cadastralParcels = getNodesByLocalName(xmlDoc, "CadastralParcel");
    
    if (cadastralParcels.length === 0) {
      const polygons = getNodesByLocalName(xmlDoc, "Polygon");
      polygons.forEach((poly, i) => {
        const posLists = getNodesByLocalName(poly, "posList");
        const coords = getNodesByLocalName(poly, "coordinates");
        const textCoords = (posLists[0]?.textContent || coords[0]?.textContent || "").trim();
        
        if (textCoords) {
          const wgs84Points = processPosList(textCoords);
          if (wgs84Points.length > 0) {
            parcels.push({
              nombre: `Objeto ${i + 1}`,
              exterior: wgs84Points
            });
          }
        }
      });
      return parcels;
    }

    for (const parcel of cadastralParcels) {
      const labelNodes = getNodesByLocalName(parcel, "label");
      const label = labelNodes[0]?.textContent || "Parcela";
      const geometries = getNodesByLocalName(parcel, "geometry");
      
      for (const geom of geometries) {
        const posLists = getNodesByLocalName(geom, "posList");
        const coordsNodes = getNodesByLocalName(geom, "coordinates");
        const allCoords = [...posLists, ...coordsNodes];

        for (const rawCoords of allCoords) {
          const coordString = rawCoords.textContent?.trim() || "";
          if (!coordString) continue;

          const wgs84Points = processPosList(coordString);
          if (wgs84Points.length > 0) {
            parcels.push({
              nombre: label,
              exterior: wgs84Points,
              area: 0
            });
          }
        }
      }
    }

    return parcels;
  } catch (e: any) {
    console.error("Critical error in parseGML:", e.message || e);
    return [];
  }
}

function processPosList(coordString: string): Point[] {
  const pointsRaw = coordString.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  const utmPoints: [number, number][] = [];
  
  // Handle x,y or x,y,z
  // Some GMLs use 3D coordinates (x,y,z)
  // We need to guess if it's 2D or 3D by the total count
  // But usually posList has a dimensionality attribute. 
  // Here we'll try to be smart or default to 2D first.
  // Spanish GMLs are usually 2D or 3D.
  
  // Simple heuristic: if we have roughly enough for 2D, we try 2D.
  // Actually, Cadastre GMLs are almost always 2D or 3D.
  // Let's check for pairs first.
  
  for (let i = 0; i < pointsRaw.length - 1; i += 2) {
    // If the next point looks like a Z (very small or very large compared to UTM)
    // this is tricky. But most Spanish UTM X are around 200k-700k and Y around 4M.
    utmPoints.push([pointsRaw[i], pointsRaw[i + 1]]);
    
    // If it's 3D, skip the third coordinate
    // We check if the next number looks like a coordinate or a Z.
    // If pointsRaw.length is multiple of 3, it's likely 3D.
    if (pointsRaw.length % 3 === 0 && pointsRaw.length % 2 !== 0) {
      i += 1; 
    }
  }

  return utmPoints.map(p => {
    // Basic validation: Spanish UTM coordinates are usually > 1000
    // If they are < 180, they might already be WGS84
    if (Math.abs(p[0]) < 180 && Math.abs(p[1]) < 180) {
      return { lat: p[1], lng: p[0] };
    }
    const [lng, lat] = proj4("EPSG:25830", "WGS84", p);
    return { lat, lng };
  });
}

// Utility to check if a point is in a polygon (Ray-casting)
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate tree points
export function generateTreePoints(
  polygon: Point[],
  totalTrees: number,
  spacingTrees: number, // in meters
  spacingRows: number   // in meters
): Point[] {
  if (polygon.length < 3) return [];

  // Helper to get distance in meters between two lat/lng
  const getDistance = (p1: Point, p2: Point) => {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Convert polygon to UTM for easier grid generation
  const utmPolygon = polygon.map(p => {
    const [x, y] = proj4("WGS84", "EPSG:25830", [p.lng, p.lat]);
    return { x, y };
  });

  // Get bounding box in UTM
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  utmPolygon.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const treePoints: Point[] = [];
  
  // Grid in UTM
  for (let y = minY + spacingRows / 2; y < maxY; y += spacingRows) {
    for (let x = minX + spacingTrees / 2; x < maxX; x += spacingTrees) {
      if (treePoints.length >= totalTrees) break;

      // Check if (x, y) is in utmPolygon
      let inside = false;
      for (let i = 0, j = utmPolygon.length - 1; i < utmPolygon.length; j = i++) {
        const xi = utmPolygon[i].x, yi = utmPolygon[i].y;
        const xj = utmPolygon[j].x, yj = utmPolygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }

      if (inside) {
        const [lng, lat] = proj4("EPSG:25830", "WGS84", [x, y]);
        treePoints.push({ lat, lng });
      }
    }
    if (treePoints.length >= totalTrees) break;
  }

  return treePoints;
}
