import type { Dispatch } from "@mini-redux/core";
import { useStore } from "./Provider";

export function useDispatch(): Dispatch {
  return useStore().dispatch;
}
