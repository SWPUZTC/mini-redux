import { describe, expect, mock, test } from "bun:test";
import { createStore, type Action } from "../src/index";

type CounterAction = Action & { payload?: number };

const counter = (state = 0, action: CounterAction): number => {
  switch (action.type) {
    case "increment":
      return state + 1;
    case "add":
      return state + (action.payload ?? 0);
    default:
      return state;
  }
};

describe("createStore - 初始化", () => {
  test("不传 preloadedState 时，通过内部 init dispatch 让 reducer 提供初始 state", () => {
    const store = createStore(counter);
    expect(store.getState()).toBe(0);
  });

  test("preloadedState 优先于 reducer 默认值", () => {
    const store = createStore(counter, 42);
    expect(store.getState()).toBe(42);
  });
});

describe("createStore - dispatch / getState", () => {
  test("dispatch 更新 state 并原样返回 action", () => {
    const store = createStore(counter);
    const action = { type: "increment" };
    const returned = store.dispatch(action);
    expect(store.getState()).toBe(1);
    expect(returned).toBe(action);
  });

  test("reducer 能读取 action 的附加字段", () => {
    const store = createStore(counter);
    store.dispatch({ type: "add", payload: 5 });
    expect(store.getState()).toBe(5);
  });
});

describe("createStore - subscribe / unsubscribe", () => {
  test("dispatch 后所有订阅者都被通知", () => {
    const store = createStore(counter);
    const a = mock(() => {});
    const b = mock(() => {});
    store.subscribe(a);
    store.subscribe(b);
    store.dispatch({ type: "increment" });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  test("调用 unsubscribe 后不再收到通知", () => {
    const store = createStore(counter);
    const listener = mock(() => {});
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: "increment" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.dispatch({ type: "increment" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("重复调用同一个 unsubscribe 是幂等的，不影响其它订阅者", () => {
    const store = createStore(counter);
    const first = mock(() => {});
    const second = mock(() => {});
    const unsubscribeFirst = store.subscribe(first);
    store.subscribe(second);

    unsubscribeFirst();
    unsubscribeFirst(); // 第二次调用应该是 no-op

    store.dispatch({ type: "increment" });
    expect(first).toHaveBeenCalledTimes(0);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("两个订阅者各自退订互不干扰", () => {
    const store = createStore(counter);
    const a = mock(() => {});
    const b = mock(() => {});
    const unsubscribeA = store.subscribe(a);
    const unsubscribeB = store.subscribe(b);

    unsubscribeA();
    unsubscribeB();

    store.dispatch({ type: "increment" });
    expect(a).toHaveBeenCalledTimes(0);
    expect(b).toHaveBeenCalledTimes(0);
  });

  test("通知期间新增的订阅者，本轮通知不会调用它", () => {
    const store = createStore(counter);
    const calls: string[] = [];
    let subscribedInner = false;
    store.subscribe(() => {
      calls.push("A");
      if (!subscribedInner) {
        subscribedInner = true;
        store.subscribe(() => calls.push("B"));
      }
    });

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A"]); // B 本轮不生效

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A", "A", "B"]); // 下一轮通知才轮到 B
  });

  test("通知期间退订自己，不会跳过后面的订阅者（快照语义）", () => {
    const store = createStore(counter);
    const calls: string[] = [];
    const unsubscribeA = store.subscribe(() => {
      calls.push("A");
      unsubscribeA();
    });
    store.subscribe(() => calls.push("B"));

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A", "B"]);

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A", "B", "B"]); // A 已退订，之后只剩 B
  });

  test("通知期间退订尚未被调用的订阅者：本轮仍会执行，下一轮不再执行", () => {
    const store = createStore(counter);
    const calls: string[] = [];
    let unsubscribeB: () => void = () => {};
    store.subscribe(() => {
      calls.push("A");
      unsubscribeB();
    });
    unsubscribeB = store.subscribe(() => calls.push("B"));

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A", "B"]); // 快照里 B 还在，本轮仍执行

    store.dispatch({ type: "increment" });
    expect(calls).toEqual(["A", "B", "A"]); // 下一轮 B 已被移除
  });

  test("reducer 返回相同引用时，订阅者依然会被通知（是否重渲染由订阅方判断）", () => {
    const store = createStore((state = { count: 0 }) => state);
    const listener = mock(() => {});
    store.subscribe(listener);
    store.dispatch({ type: "unknown" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("createStore - dispatch 执行期间的守卫（isDispatch）", () => {
  test("reducer 内再次 dispatch 会抛错", () => {
    const store: any = createStore((state: any = 0, action: any) => {
      if (action.type === "outer") store.dispatch({ type: "inner" });
      return state;
    });
    expect(() => store.dispatch({ type: "outer" })).toThrow();
  });

  test("reducer 内调用 getState 会抛错", () => {
    const store: any = createStore((state: any = 0, action: any) => {
      if (action.type === "peek") store.getState();
      return state;
    });
    expect(() => store.dispatch({ type: "peek" })).toThrow();
  });

  test("reducer 内调用 subscribe 会抛错", () => {
    const store: any = createStore((state: any = 0, action: any) => {
      if (action.type === "sub") store.subscribe(() => {});
      return state;
    });
    expect(() => store.dispatch({ type: "sub" })).toThrow();
  });

  test("reducer 内调用 unsubscriber 会抛错", () => {
    let unsubscribe: () => void = () => {};
    const store: any = createStore((state: any = 0, action: any) => {
      if (action.type === "unsub") unsubscribe();
      return state;
    });
    unsubscribe = store.subscribe(() => {});
    expect(() => store.dispatch({ type: "unsub" })).toThrow();
  });

  test("reducer 抛出的异常向上传播，守卫复位后 store 仍可继续使用", () => {
    const store = createStore((state = 0, action: Action) => {
      if (action.type === "boom") throw new Error("reducer 爆炸");
      return state;
    });

    expect(() => store.dispatch({ type: "boom" })).toThrow("reducer 爆炸");

    // try/finally 已复位 isDispatch，后续 dispatch 正常
    expect(() => store.dispatch({ type: "noop" })).not.toThrow();
    expect(store.getState()).toBe(0);
  });
});
