import { createContext, use, useContext, type ReactNode } from "react";
import type { Store } from "@mini-redux/core";

const StoreContext = createContext<Store | undefined>(undefined);

export interface ProviderProps<S = any> {
  store: Store<S>;
  children: ReactNode;
}

export function Provider<S = any>({ store, children }: ProviderProps<S>) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore<S = any>(): Store<S> {
  const store = use(StoreContext);
  if (!store) {
    throw new Error("useStore must be used in Provider");
  }
  return store as Store<S>;
}
