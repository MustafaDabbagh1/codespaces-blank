import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

interface Store {
  id: number;
  name: string;
  tenantId: number;
  isActive: boolean;
}

interface StoreContextType {
  selectedStoreId: number | null;
  setSelectedStoreId: (id: number | null) => void;
  stores: Store[];
  selectedStore: Store | undefined;
  isMultiStore: boolean;
}

const StoreContext = createContext<StoreContextType>({
  selectedStoreId: null,
  setSelectedStoreId: () => {},
  stores: [],
  selectedStore: undefined,
  isMultiStore: false,
});

export function StoreProvider({ stores, children }: { stores: Store[]; children: ReactNode }) {
  const { user } = useAuth();
  const activeStores = stores.filter(s => s.isActive);
  const isMultiStore = activeStores.length > 1;

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    if (activeStores.length === 0) return null;
    if (activeStores.length === 1) return activeStores[0].id;
    const saved = localStorage.getItem(`ppd_store_${user?.tenantId}`);
    if (saved === "all") return null;
    if (saved) {
      const parsed = parseInt(saved);
      if (activeStores.some(s => s.id === parsed)) return parsed;
    }
    if (user?.storeId && activeStores.some(s => s.id === user.storeId)) return user.storeId;
    return null;
  });

  useEffect(() => {
    if (user?.tenantId) {
      localStorage.setItem(`ppd_store_${user.tenantId}`, selectedStoreId ? String(selectedStoreId) : "all");
    }
  }, [selectedStoreId, user?.tenantId]);

  useEffect(() => {
    if (activeStores.length === 0) return;
    if (activeStores.length === 1 && selectedStoreId !== activeStores[0].id) {
      setSelectedStoreId(activeStores[0].id);
      return;
    }
    if (selectedStoreId === null) return;
    if (activeStores.some(s => s.id === selectedStoreId)) return;
    const saved = localStorage.getItem(`ppd_store_${user?.tenantId}`);
    if (saved === "all") { setSelectedStoreId(null); return; }
    if (saved) {
      const parsed = parseInt(saved);
      if (activeStores.some(s => s.id === parsed)) { setSelectedStoreId(parsed); return; }
    }
    if (user?.storeId && activeStores.some(s => s.id === user.storeId)) { setSelectedStoreId(user.storeId); return; }
    setSelectedStoreId(null);
  }, [activeStores, selectedStoreId, user?.storeId, user?.tenantId]);

  const selectedStore = activeStores.find(s => s.id === selectedStoreId);

  return (
    <StoreContext.Provider value={{ selectedStoreId, setSelectedStoreId, stores: activeStores, selectedStore, isMultiStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreContext() {
  return useContext(StoreContext);
}
