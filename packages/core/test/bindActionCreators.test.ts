import { describe, expect, test } from "bun:test";
import {
  applyMiddleware,
  bindActionCreators,
  createStore,
  type Action,
  type Middleware,
} from "../src/index";

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

describe("bindActionCreators", () => {
  test("传入单个 action creator：返回调用即派发的函数", () => {
    const store = createStore(counter);
    const increment = () => ({ type: "increment" });
    const boundIncrement = bindActionCreators(increment, store.dispatch);

    const returned = boundIncrement();

    expect(store.getState()).toBe(1);
    expect(returned).toEqual({ type: "increment" }); // 返回的是 dispatch 的返回值（action 本身）
  });

  test("传入对象映射：全部绑定，参数正确透传", () => {
    const store = createStore(counter);
    const actions = bindActionCreators(
      {
        increment: () => ({ type: "increment" }),
        add: (amount: number) => ({ type: "add", payload: amount }),
      },
      store.dispatch,
    );

    actions.increment();
    actions.add(5);

    expect(store.getState()).toBe(6);
  });

  test("对象里的非函数属性会被忽略，不进入返回值", () => {
    const store = createStore(counter);
    const actions = bindActionCreators(
      // 模拟 import * as actions 的场景：可能混入非函数导出
      { increment: () => ({ type: "increment" }), version: "1.0" } as unknown as {
        increment: () => Action;
      },
      store.dispatch,
    );

    expect(typeof actions.increment).toBe("function");
    expect("version" in actions).toBe(false);
  });

  test("不修改传入的对象，返回包装后的新函数", () => {
    const store = createStore(counter);
    const creator = () => ({ type: "increment" });
    const actionCreators = { increment: creator };

    const bound = bindActionCreators(actionCreators, store.dispatch);

    expect(actionCreators.increment).toBe(creator); // 原对象原样未动
    expect(bound.increment).not.toBe(creator); // 返回的是新函数
  });

  test("传入 null / 基础类型时抛出明确错误", () => {
    const store = createStore(counter);
    expect(() => bindActionCreators(null as any, store.dispatch)).toThrow("对象或函数");
    expect(() => bindActionCreators(42 as any, store.dispatch)).toThrow("对象或函数");
  });

  test("绑定的是传入的 dispatch：中间件包装过的 dispatch 同样生效", () => {
    const log: string[] = [];
    const tap: Middleware = () => (next) => <T extends Action>(action: T): T => {
      log.push(action.type);
      return next(action);
    };
    const store = applyMiddleware(tap)(counter);

    const actions = bindActionCreators(
      { increment: () => ({ type: "increment" }) },
      store.dispatch,
    );
    actions.increment();

    expect(store.getState()).toBe(1);
    expect(log).toEqual(["increment"]); // action 走完了中间件链
  });
});
