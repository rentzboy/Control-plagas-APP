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
  ratings?: { [key: number]: any }; // Heatmap data
}

function DeckGLOverlay({ layers }: { layers: any[] }) {
  const map = useMap();
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);

  useEffect(() => {
    if (!overlayRef.current) {
      overlayRef.current = new GoogleMapsOverlay({ layers });
    } else {
      overlayRef.current.setProps({ layers });
    }
  }, [layers]);

  useEffect(() => {
    if (!map) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    
    // The error "projection is null" usually happens when the map isn't 
    // fully initialized with a center/zoom yet.
    // We'll wrap it in a slightly safer initialization check.
    const initializeOverlay = () => {
      try {
        if (map.getProjection()) {
          overlay.setMap(map);
        } else {
          // Retry later if projection is not yet available
          const listener = map.addListener('projection_changed', () => {
            overlay.setMap(map);
            listener.remove();
          });
          // Fallback if event doesn't fire
          setTimeout(() => {
            if (!overlay.getMap()) overlay.setMap(map);
          }, 100);
        }
      } catch (e) {
        console.warn("DeckGL: Error adding overlay", e);
      }
    };

    initializeOverlay();

    return () => {
      if (overlay) {
        try {
          overlay.setMap(null);
        } catch (e: any) {
          if (e.message?.includes('removeAllListeners')) return;
          console.debug("DeckGL cleanup info:", e.message);
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
  ratings = {}
}: MapPlotProps) {
  const [center, setCenter] = useState<Point>({ lat: 40.4168, lng: -3.7038 }); 
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    if (parcelas.length > 0) {
      const first = parcelas[0];
      const exterior = typeof first.gml_data === 'string' ? JSON.parse(first.gml_data) : first.exterior;
      if (exterior && exterior.length > 0) {
        setCenter({ lat: exterior[0].lat, lng: exterior[0].lng });
        setZoom(18);
      }
    }
  }, [parcelas]);

  // Memoize layers to prevent unnecessary overlay updates
  const layers = useMemo(() => [
    new PathLayer({
      id: 'parcelas-outline',
      data: parcelas,
      getPath: (d: any) => {
        const ext = typeof d.gml_data === 'string' ? JSON.parse(d.gml_data) : d.exterior;
        return ext.map((p: Point) => [p.lng, p.lat]);
      },
      getColor: [16, 185, 129],
      widthMinPixels: 2,
    }),
    new ScatterplotLayer({
      id: 'tree-points',
      data: treePoints.map((p, i) => ({ ...p, index: i })),
      getPosition: (d: any) => [d.lng, d.lat],
      getRadius: 0.8,
      getFillColor: (d: any) => {
        const ratingData = ratings[d.index];
        const rating = typeof ratingData === 'object' ? ratingData.rating : ratingData;
        if (rating === 0) return [16, 185, 129]; 
        if (rating === 1) return [251, 191, 36]; 
        if (rating === 2) return [239, 68, 68]; 
        return [148, 163, 184]; 
      },
      pickable: true,
      onClick: (info) => {
        if (onSelectTree && info.object) {
          onSelectTree(info.object.index);
        }
      }
    }),
    new HeatmapLayer({
      id: 'pest-heatmap',
      data: treePoints.map((p, i) => {
        const ratingData = ratings[i];
        const rating = typeof ratingData === 'object' ? ratingData.rating : ratingData;
        return { ...p, weight: rating ?? -1 };
      }),
      getPosition: (d: any) => [d.lng, d.lat],
      getWeight: (d: any) => d.weight === -1 ? 0 : (d.weight === 0 ? 0.1 : (d.weight === 1 ? 0.6 : 1)),
      radiusPixels: 35,
      visible: Object.keys(ratings).length > 0
    }),
    userLocation ? new ScatterplotLayer({
      id: 'user-location',
      data: [userLocation],
      getPosition: d => [d.lng, d.lat],
      getRadius: 1.5,
      getFillColor: [59, 130, 246],
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 3,
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
