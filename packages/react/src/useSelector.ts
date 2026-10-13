import { useSyncExternalStore } from "react";
import { useStore } from "./Provider";

export function useSelector<S, TSelected>(
  selector: (state: S) => TSelected,
): TSelected {
  const store = useStore<S>();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
