import { describe, expect, mock, test } from "bun:test";
import {
  applyMiddleware,
  type Action,
  type Middleware,
  type Reducer,
} from "../src/index";

interface CounterState {
  count: number;
}

const counter: Reducer<CounterState, Action> = (state = { count: 0 }, action) =>
  action.type === "increment" ? { count: state.count + 1 } : state;

// 透传中间件：把经过的 action.type 记录到 log。
// 注意回调按 mini-redux Dispatch<A> 的泛型签名写成 <T extends Action>(action: T) => T
function tap(log: string[]): Middleware {
  return () => (next) => <T extends Action>(action: T): T => {
    log.push(action.type);
    return next(action);
  };
}

describe("applyMiddleware", () => {
  test("基础链路：中间件观察到 action 并放行，state 正常更新", () => {
    const log: string[] = [];
    const store = applyMiddleware(tap(log))(counter);
    store.dispatch({ type: "increment" });
    expect(store.getState()).toEqual({ count: 1 });
    expect(log).toEqual(["increment"]);
  });

  test("多个中间件按声明顺序执行，第一个在最外层", () => {
    const order: string[] = [];
    const m1: Middleware = () => (next) => <T extends Action>(action: T): T => {
      order.push("m1");
      return next(action);
    };
    const m2: Middleware = () => (next) => <T extends Action>(action: T): T => {
      order.push("m2");
      return next(action);
    };
    const store = applyMiddleware(m1, m2)(counter);
    store.dispatch({ type: "increment" });
    expect(order).toEqual(["m1", "m2"]);
  });

  test("中间件不调用 next：action 被拦截，reducer 不执行，dispatch 仍返回 action", () => {
    let reducerCalls = 0;
    const counting: Reducer<CounterState, Action> = (state = { count: 0 }, action) => {
      if (action.type === "increment") reducerCalls++;
      return state;
    };
    const gate: Middleware = () => (next) => <T extends Action>(action: T): T =>
      action.type === "blocked" ? action : next(action);

    const store = applyMiddleware(gate)(counting);
    const action = { type: "blocked" };
    const returned = store.dispatch(action);

    expect(reducerCalls).toBe(0);
    expect(returned).toBe(action);
  });

  test("中间件可以修改 action 之后再交给 next", () => {
    const doubler: Middleware = () => (next) => <T extends Action>(action: T): T => {
      if (action.type === "add") {
        return next({ ...action, payload: (action as any).payload * 10 } as T);
      }
      return next(action);
    };
    const summator = (state: { sum: number } = { sum: 0 }, action: any) =>
      action.type === "add" ? { sum: state.sum + action.payload } : state;

    const store = applyMiddleware(doubler)(summator);
    store.dispatch({ type: "add", payload: 2 });
    expect(store.getState()).toEqual({ sum: 20 });
  });

  test("中间件内 api.getState() 读到的是最新 state", () => {
    const seen: number[] = [];
    const peeker: Middleware<CounterState> = (api) => (next) => <T extends Action>(action: T): T => {
      seen.push(api.getState().count);
      return next(action);
    };

    const store = applyMiddleware<CounterState>(peeker)(counter);
    store.dispatch({ type: "increment" });
    store.dispatch({ type: "increment" });

    expect(seen).toEqual([0, 1]); // 每次 dispatch 时看到的是当前（尚未更新）的 state
  });

  test("中间件内 api.dispatch() 经过完整中间件链（thunk 式用法成立）", () => {
    const seen: string[] = [];
    const thunk: Middleware = (api) => (next) => <T extends Action>(action: T): T => {
      if (typeof action === "function") {
        (action as unknown as (dispatch: (a: Action) => Action) => void)(api.dispatch);
        return action;
      }
      seen.push(action.type);
      return next(action);
    };

    const store = applyMiddleware(thunk)(counter);
    const dispatchTwice = (dispatch: (a: Action) => Action) => {
      dispatch({ type: "increment" });
      dispatch({ type: "increment" });
    };
    store.dispatch(dispatchTwice as unknown as Action);

    expect(store.getState()).toEqual({ count: 2 });
    expect(seen).toEqual(["increment", "increment"]); // 内层 dispatch 同样走完了整条链路
  });

  test("包装后的 store 保留 subscribe", () => {
    const store = applyMiddleware(tap([]))(counter);
    const listener = mock(() => {});
    store.subscribe(listener);
    store.dispatch({ type: "increment" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
