import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useStore } from "./Provider";

export function useSelector<S, TSelected>(
  selector: (state: S) => TSelected,
  equalityFn: (left: TSelected, right: TSelected) => boolean = Object.is,
): TSelected {
  const store = useStore<S>();

  const selectFromState = useMemo(() => {
    let hasMemo = false;
    let lastState: S;
    let lastSelected: TSelected;

    return (state: S): TSelected => {
      if (!hasMemo) {
        hasMemo = true;
        lastState = state;
        lastSelected = selector(state);
        return lastSelected;
      }
      if (Object.is(lastState, state)) {
        return lastSelected; // 同一份 state，直接复用
      }
      const nextSelected = selector(state);
      if (equalityFn(lastSelected, nextSelected)) {
        lastState = state; // 记住新 state，但保留旧引用 → 不触发重渲染
        return lastSelected;
      }
      lastState = state;
      lastSelected = nextSelected;
      return nextSelected;
    };
  }, [selector, equalityFn]);

  const getSnapshot = useCallback(
    () => selectFromState(store.getState()),
    [store, selectFromState],
  );

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
