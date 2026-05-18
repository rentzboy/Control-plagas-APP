import { useState, useEffect, useMemo } from "react";
import { 
  APIProvider, 
  Map, 
  useMap, 
  ControlPosition, 
  MapControl 
} from "@vis.gl/react-google-maps";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import { Point } from "../utils/gmlParser";
import { useRef } from "react";

interface MapPlotProps {
  parcelas: any[];
  treePoints?: Point[];
  userLocation?: Point | null;
  selectedTreeIndex?: number | null;
  onSelectTree?: (index: number) => void;
  onLongPressParcela?: () => void;
  onDoubleTapParcela?: (parcela: any) => void;
  ratings?: { [key: number]: any }; 
  showHeatmap?: boolean;
}

function DeckGLOverlay({ layers }: { layers: any[] }) {
  const map = useMap();
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);

  // Initialize overlay instance
  useEffect(() => {
    if (!overlayRef.current) {
      overlayRef.current = new GoogleMapsOverlay({ layers });
    } else {
      overlayRef.current.setProps({ layers });
    }
  }, [layers]);

  // Handle map attachment
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    
    // Use a small delay to ensure map projection is ready
    const timerId = setTimeout(() => {
      try {
        // Double check map and projection availability
        if (map.getProjection()) {
          overlay.setMap(map);
        } else {
          // If still no projection, wait for next idle
          const listener = map.addListener('idle', () => {
             overlay.setMap(map);
             listener.remove();
          });
        }
      } catch (e) {
        console.warn("DeckGL attachment failed:", e);
      }
    }, 200);

    return () => {
      clearTimeout(timerId);
      if (overlay) {
        try {
          overlay.setMap(null);
        } catch (e: any) {
          // Ignore release errors
        }
      }
    };
  }, [map]);

  return null;
}

export default function MapPlot({ 
  parcelas, 
  treePoints = [], 
  userLocation, 
  onSelectTree, 
  onLongPressParcela,
  onDoubleTapParcela,
  ratings = {},
  showHeatmap = false,
  focusLocation
}: MapPlotProps & { focusLocation?: Point | null }) {
  const [center, setCenter] = useState<Point>({ lat: 40.4168, lng: -3.7038 }); 
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    if (focusLocation) {
      setCenter(focusLocation);
      setZoom(18);
    }
  }, [focusLocation]);

  useEffect(() => {
    if (parcelas.length > 0) {
      const first = parcelas[0];
      try {
        const exterior = typeof first.gml_data === 'string' ? JSON.parse(first.gml_data) : first.exterior;
        if (exterior && Array.isArray(exterior) && exterior.length > 0) {
          setCenter({ lat: exterior[0].lat, lng: exterior[0].lng });
          setZoom(18);
        }
      } catch (e) {
        console.error("Error parsing parcela data for map center", e);
      }
    }
  }, [parcelas]);

  // Memoize layers to prevent unnecessary overlay updates
  const layers = useMemo(() => [
    new PathLayer({
      id: 'parcelas-outline',
      data: parcelas,
      getPath: (d: any) => {
        try {
          const ext = typeof d.gml_data === 'string' ? JSON.parse(d.gml_data) : (d.exterior || []);
          if (!Array.isArray(ext)) return [];
          return ext.map((p: any) => [p.lng, p.lat]) as [number, number][];
        } catch (e) {
          return [];
        }
      },
      getColor: [16, 185, 129],
      widthMinPixels: 3,
      widthScale: 1,
      rounded: true,
      pickable: true
    }),
    new HeatmapLayer({
      id: 'pest-heatmap',
      data: treePoints.map((p, i) => {
        const ratingData = ratings[i];
        const rating = typeof ratingData === 'object' ? ratingData.rating : ratingData;
        return { ...p, weight: rating ?? -1 };
      }),
      getPosition: (d: any) => [d.lng, d.lat],
      getWeight: (d: any) => {
        if (d.weight === -1 || d.weight === undefined) return 0;
        // Continuous scale for interpolated values
        // 0 (Sano) -> 0.1
        // 1 (Leve) -> 0.6
        // 2 (Grave) -> 1.0
        if (d.weight <= 1) return 0.1 + (d.weight * 0.5);
        return 0.6 + (Math.min(d.weight - 1, 1) * 0.4);
      },
      radiusPixels: 40,
      visible: showHeatmap && Object.keys(ratings).length > 0
    }),
    new ScatterplotLayer({
      id: 'tree-points',
      data: treePoints.map((p, i) => ({ ...p, index: i })),
      getPosition: (d: any) => [d.lng, d.lat],
      getRadius: 2.5,
      getFillColor: (d: any) => {
        const ratingData = ratings[d.index];
        const rating = typeof ratingData === 'object' ? ratingData.rating : ratingData;
        
        if (rating === undefined || rating === -1) return [148, 163, 184, 180];
        
        // Colors for interpolated values
        if (rating <= 0.5) return [16, 185, 129, 220]; // Greenish
        if (rating <= 1.5) return [251, 191, 36, 220]; // Amber
        return [239, 68, 68, 220]; // Red
      },
      stroked: true,
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      pickable: true,
      onClick: (info) => {
        if (onSelectTree && info.object) {
          onSelectTree(info.object.index);
        }
      }
    }),
    userLocation ? new ScatterplotLayer({
      id: 'user-location',
      data: [userLocation],
      getPosition: d => [d.lng, d.lat],
      getRadius: 6,
      getFillColor: [59, 130, 246],
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 2,
      stroked: true
    }) : null
  ].filter(Boolean), [parcelas, treePoints, userLocation, ratings, onSelectTree]);

  return (
    <div className="w-full h-full relative" id="map-container">
      <Map
        center={center}
        zoom={zoom}
        onCenterChanged={e => setCenter(e.detail.center)}
        onZoomChanged={e => setZoom(e.detail.zoom)}
        style={{ width: "100%", height: "100%" }}
        disableDefaultUI={true}
        gestureHandling={'greedy'}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
      
      {/* Interaction overlay for double tap and long press */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{ zIndex: 1 }}
        onDoubleClick={(e) => {
           // Heuristic for which parcel was double clicked
           // In a real app we'd use deckgl's picking but let's assume we pick the visible one
           if (parcelas.length > 0 && onDoubleTapParcela) {
             onDoubleTapParcela(parcelas[0]);
           }
        }}
        // Long press is harder with standard DOM events, we can use a mouseDown timer
      />
    </div>
  );
}
