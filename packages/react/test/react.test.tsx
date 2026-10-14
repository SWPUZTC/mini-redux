import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createStore, type Action } from "@mini-redux/core";
import { Provider, shallowEqual, useDispatch, useSelector, useStore } from "../src/index";

// 注册模拟浏览器环境（happy-dom），让 react-dom 能在 bun test 进程中运行
GlobalRegistrator.register();
// 告诉 React 当前是测试环境（act 的告警开关）
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface CounterState {
  count: number;
}

const counterReducer = (state: CounterState = { count: 0 }, action: Action): CounterState =>
  action.type === "increment" ? { count: state.count + 1 } : state;

// 统一管理挂载的 root，每个用例结束后清理
const mountedRoots: Root[] = [];

afterEach(() => {
  act(() => {
    for (const root of mountedRoots) root.unmount();
  });
  mountedRoots.length = 0;
});

function mount(element: ReactElement): HTMLElement {
  const container = document.createElement("div");
  const root = createRoot(container);
  mountedRoots.push(root);
  act(() => {
    root.render(element);
  });
  return container;
}

describe("Provider / useSelector（真实渲染）", () => {
  test("useSelector 读取选中值，dispatch 后组件自动更新", () => {
    const store = createStore(counterReducer);

    function Counter() {
      const count = useSelector<CounterState, number>((state) => state.count);
      return <div id="count">{count}</div>;
    }

    const container = mount(
      <Provider store={store}>
        <Counter />
      </Provider>,
    );

    expect(container.textContent).toBe("0");

    act(() => {
      store.dispatch({ type: "increment" });
    });
    expect(container.textContent).toBe("1");
  });

  test("state 引用未变化时不会触发重渲染（选择器返回稳定值）", () => {
    const store = createStore(counterReducer);
    let renders = 0;

    function CountView() {
      renders++;
      const count = useSelector<CounterState, number>((state) => state.count);
      return <span>{count}</span>;
    }

    mount(
      <Provider store={store}>
        <CountView />
      </Provider>,
    );
    expect(renders).toBe(1);

    act(() => {
      store.dispatch({ type: "unknown" }); // reducer 返回同一引用
    });
    expect(renders).toBe(1); // 快照没变，不重渲染

    act(() => {
      store.dispatch({ type: "increment" });
    });
    expect(renders).toBe(2);
  });

  test("Provider 更换 store 后，组件切换到新 store 并重新订阅", () => {
    const storeA = createStore(counterReducer);
    const storeB = createStore(counterReducer, { count: 100 });

    function View() {
      const count = useSelector<CounterState, number>((state) => state.count);
      return <div>{count}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <Provider store={storeA}>
          <View />
        </Provider>,
      );
    });
    expect(container.textContent).toBe("0");

    act(() => {
      root.render(
        <Provider store={storeB}>
          <View />
        </Provider>,
      );
    });
    expect(container.textContent).toBe("100");

    act(() => {
      storeA.dispatch({ type: "increment" }); // 旧 store 的变化不应影响视图
    });
    expect(container.textContent).toBe("100");

    act(() => {
      storeB.dispatch({ type: "increment" });
    });
    expect(container.textContent).toBe("101");
  });

  test("组件卸载后取消订阅：后续 dispatch 不再调用选择器", () => {
    const store = createStore(counterReducer);
    let selectorCalls = 0;

    function View() {
      const count = useSelector<CounterState, number>((state) => {
        selectorCalls++;
        return state.count;
      });
      return <div>{count}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <Provider store={store}>
          <View />
        </Provider>,
      );
    });

    act(() => {
      root.unmount();
    });
    const callsAfterUnmount = selectorCalls;
    expect(callsAfterUnmount).toBeGreaterThan(0);

    act(() => {
      store.dispatch({ type: "increment" });
    });
    expect(selectorCalls).toBe(callsAfterUnmount); // 卸载后已无人监听
  });

  test("useStore 在 Provider 之外使用时抛出明确错误", () => {
    function Orphan() {
      useStore();
      return null;
    }

    expect(() => renderToString(<Orphan />)).toThrow("useStore must be used in Provider");
  });
});

describe("useDispatch", () => {
  test("返回 store 的 dispatch：点击派发 action 后视图更新", () => {
    const store = createStore(counterReducer);
    let dispatchFromHook: unknown;

    function Button() {
      const dispatch = useDispatch();
      const count = useSelector<CounterState, number>((state) => state.count);
      dispatchFromHook = dispatch;
      return <button onClick={() => dispatch({ type: "increment" })}>{count}</button>;
    }

    const container = mount(
      <Provider store={store}>
        <Button />
      </Provider>,
    );

    act(() => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    expect(container.textContent).toBe("1");
    expect(dispatchFromHook).toBe(store.dispatch); // 就是 store 自己的 dispatch
  });

  test("dispatch 的引用在多次渲染之间保持稳定", () => {
    const store = createStore(counterReducer);
    const seen: unknown[] = [];

    function Probe() {
      const dispatch = useDispatch();
      const count = useSelector<CounterState, number>((state) => state.count);
      seen.push(dispatch);
      return <div>{count}</div>;
    }

    mount(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );

    act(() => {
      store.dispatch({ type: "increment" }); // 触发重渲染
    });

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every((d) => d === seen[0])).toBe(true);
  });
});

describe("useSelector 的 memo 与 equalityFn", () => {
  test("selector 每次返回新对象也安全（同一 state 不重复计算，不陷入循环）", () => {
    const store = createStore(counterReducer);
    let selectorCalls = 0;

    function View() {
      const picked = useSelector<CounterState, { count: number }>((state) => {
        selectorCalls++;
        return { count: state.count };
      });
      return <div>{picked.count}</div>;
    }

    const container = mount(
      <Provider store={store}>
        <View />
      </Provider>,
    );
    expect(container.textContent).toBe("0");
    expect(selectorCalls).toBeLessThanOrEqual(2); // 有界，说明 memo 生效

    act(() => {
      store.dispatch({ type: "increment" });
    });
    expect(container.textContent).toBe("1");
    expect(selectorCalls).toBeLessThanOrEqual(4);
  });

  test("传 shallowEqual 后，浅层相等的选中对象不触发重渲染", () => {
    interface WideState {
      count: number;
      other: number;
    }
    const reducer = (
      state: WideState = { count: 0, other: 0 },
      action: Action,
    ): WideState => (action.type === "incOther" ? { ...state, other: state.other + 1 } : state);

    const store = createStore(reducer);
    let renders = 0;

    function View() {
      renders++;
      const picked = useSelector<WideState, { count: number }>(
        (state) => ({ count: state.count }), // 每次都是新对象
        shallowEqual,
      );
      return <div>{picked.count}</div>;
    }

    const container = mount(
      <Provider store={store}>
        <View />
      </Provider>,
    );
    expect(container.textContent).toBe("0");
    expect(renders).toBe(1);

    act(() => {
      store.dispatch({ type: "incOther" }); // state 引用变了，但 count 没变
    });
    expect(renders).toBe(1); // shallowEqual 判定相等 → 复用旧引用 → 不重渲染
    expect(container.textContent).toBe("0");
  });

  test("selector 变化时立即用新 selector 重新计算（不吃缓存）", () => {
    const store = createStore(counterReducer, { count: 5 });

    function View({ double }: { double: boolean }) {
      const value = useSelector<CounterState, number>((state) =>
        double ? state.count * 2 : state.count,
      );
      return <div>{value}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <Provider store={store}>
          <View double={false} />
        </Provider>,
      );
    });
    expect(container.textContent).toBe("5");

    act(() => {
      root.render(
        <Provider store={store}>
          <View double />
        </Provider>,
      );
    });
    expect(container.textContent).toBe("10"); // 同一份 state + 新 selector → 必须重算
  });
});
