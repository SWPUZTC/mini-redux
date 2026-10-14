import { describe, expect, test } from "bun:test";
import { combineReducers, createStore, type Action } from "../src/index";

interface RootState {
  count: number;
  history: string[];
}

const countReducer = (state = 0, action: Action): number =>
  action.type === "increment" ? state + 1 : state;

const historyReducer = (state: string[] = [], action: Action): string[] =>
  action.type === "increment" ? [...state, "increment"] : state;

const rootReducer = combineReducers<RootState>({
  count: countReducer,
  history: historyReducer,
});

describe("combineReducers", () => {
  test("初始化：每个子 reducer 只负责自己的切片，并提供默认值", () => {
    const store = createStore(rootReducer);
    expect(store.getState()).toEqual({ count: 0, history: [] });
  });

  test("dispatch 会路由到每个子 reducer", () => {
    const store = createStore(rootReducer);
    store.dispatch({ type: "increment" });
    expect(store.getState()).toEqual({ count: 1, history: ["increment"] });
  });

  test("所有切片都没有变化时，返回同一个 state 引用", () => {
    const store = createStore(rootReducer);
    const before = store.getState();
    store.dispatch({ type: "unknown-action" });
    expect(store.getState()).toBe(before);
  });

  test("有切片变化时返回新对象，未变化的切片保持原引用", () => {
    const onlyCountChanges = combineReducers<RootState>({
      count: countReducer,
      history: (state: string[] = []) => state, // 永远返回同一引用
    });
    const store = createStore(onlyCountChanges);

    const before = store.getState();
    store.dispatch({ type: "increment" });
    const after = store.getState();

    expect(after).not.toBe(before); // 顶层是新对象
    expect(after.count).toBe(1);
    expect(after.history).toBe(before.history); // 未变化的切片保持引用
  });

  test("preloadedState 生效", () => {
    const store = createStore(rootReducer, { count: 10, history: ["x"] });
    expect(store.getState()).toEqual({ count: 10, history: ["x"] });
  });

  test("子 reducer 返回 undefined 时，抛出带上下文的错误", () => {
    const faulty = (state = 0, action: Action): number =>
      action.type === "erase" ? (undefined as unknown as number) : state;
    const store = createStore(combineReducers<{ n: number }>({ n: faulty }));

    let message = "";
    try {
      store.dispatch({ type: "erase" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('"n"'); // 报错里指出出问题的 key
    expect(message).toContain('"erase"'); // 以及当时的 action type

    // 报错后 store 依然可用（createStore 的守卫已复位）
    expect(() => store.dispatch({ type: "noop" })).not.toThrow();
  });

  test("state 中不属于任何 reducer 的多余 key 会被剔除", () => {
    const store = createStore(rootReducer, {
      count: 1,
      history: ["x"],
      legacy: true,
    } as unknown as RootState);

    const state = store.getState();
    expect(state).toEqual({ count: 1, history: ["x"] });
    expect("legacy" in state).toBe(false);
  });
});
