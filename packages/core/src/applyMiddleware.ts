import {
  type Action,
  type Reducer,
  type Dispatch,
  type Store,
  createStore,
} from "./createStore";
import { compose } from "./compose";

export interface MiddlewareAPI<S = any, A extends Action = Action> {
  getState(): S;
  dispatch: Dispatch<A>;
}

// 中间件函数类型，接受 API，返回一个接收 next 的函数
export type Middleware<S = any, A extends Action = Action> = (
  api: MiddlewareAPI<S, A>,
) => (next: Dispatch<A>) => Dispatch<A>;

export function applyMiddleware<S, A extends Action = Action>(
  ...middlewares: Array<Middleware<S, A>>
) {
  return function createStoreWithMiddleware(
    reducer: Reducer<S, A>,
    preloadedState?: S,
  ): Store<S, A> {
    const store = createStore(reducer, preloadedState);
    let dispatch: Dispatch<A> = store.dispatch;
    const middlewareAPI: MiddlewareAPI<S, A> = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };
    const chain = middlewares.map((middleware) => middleware(middlewareAPI));
    dispatch = compose<Dispatch<A>>(...chain)(store.dispatch);
    return {
      ...store,
      dispatch,
    };
  };
}
