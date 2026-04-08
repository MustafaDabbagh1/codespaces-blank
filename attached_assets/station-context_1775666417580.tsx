import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useStoreContext } from "@/contexts/store-context";

interface Station {
  id: number;
  name: string;
  storeId: number;
  tenantId: number;
  defaultTerminalId: number | null;
  isActive: boolean;
}

interface StationContextType {
  selectedStationId: number | null;
  setSelectedStationId: (id: number | null) => void;
  stations: Station[];
  selectedStation: Station | undefined;
  isMultiStation: boolean;
}

const StationContext = createContext<StationContextType>({
  selectedStationId: null,
  setSelectedStationId: () => {},
  stations: [],
  selectedStation: undefined,
  isMultiStation: false,
});

export function StationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { selectedStoreId } = useStoreContext();

  const { data: rawStations = [] } = useQuery<Station[]>({
    queryKey: [`/api/merchant/stations?storeId=${selectedStoreId}`],
    enabled: !!selectedStoreId,
  });

  const activeStations = rawStations.filter(s => s.isActive);
  const isMultiStation = activeStations.length >= 2;

  const storageKey = selectedStoreId ? `ppd_station_${user?.tenantId}_${selectedStoreId}` : null;

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedStoreId) {
      setSelectedStationId(null);
      return;
    }

    if (activeStations.length === 0) {
      setSelectedStationId(null);
      return;
    }

    if (activeStations.length === 1) {
      setSelectedStationId(activeStations[0].id);
      return;
    }

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved);
        if (activeStations.some(s => s.id === parsed)) {
          setSelectedStationId(parsed);
          return;
        }
      }
    }

    setSelectedStationId(activeStations[0].id);
  }, [selectedStoreId, activeStations.map(s => s.id).join(","), storageKey]);

  useEffect(() => {
    if (storageKey && selectedStationId !== null) {
      localStorage.setItem(storageKey, String(selectedStationId));
    }
  }, [selectedStationId, storageKey]);

  const selectedStation = activeStations.find(s => s.id === selectedStationId);

  return (
    <StationContext.Provider value={{ selectedStationId, setSelectedStationId, stations: activeStations, selectedStation, isMultiStation }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStationContext() {
  return useContext(StationContext);
}
