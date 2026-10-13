export interface Action<T = any> {
  type: T;
}

// 返回的action函数
export type ActionCreator<A, P extends any[]> = (...args: P) => A;

// Reducer 是纯函数：(prev, action) => new
export type Reducer<S = any, A extends Action = Action> = (
  state: S | undefined,
  action: A,
) => S;

// Dispatch
export type Dispatch<A extends Action = Action> = <T extends A>(action: T) => T;

export type Unsubscribe = () => void;

// Store 的完整接口
export interface Store<S = any, A extends Action = Action> {
  dispatch: Dispatch<A>;
  getState(): S;
  subscribe(listener: () => void): Unsubscribe;
}

/**
 * 创建一个 Redux store 来持有应用的完整 state 树。
 * 整个应用应该只有一个 store。
 *
 * @param reducer 一个根据当前 state 和 action 返回新 state 的纯函数
 * @param preloadedState 可选的初始 state
 * @returns 一个包含 dispatch、getState、subscribe 方法的 store 对象
 */
export function createStore<S, A extends Action = Action>(
  reducer: Reducer<S, A>,
  preloadedState?: S,
): Store<S, A> {
  // 初始化状态
  let state: S = preloadedState as S;
  // 订阅者列表
  let listeners: Array<() => void> = [];
  // 标记表示当前是否正在dispatch，防止在 reducer 中执行 dispatch，造成状态的级联更新
  let isDispatch = false;

  function getState(): S {
    if (isDispatch) {
      throw new Error("当前还存在reducer未执行完毕，获取的状态不为最新状态");
    }
    return state;
  }

  function subscribe(listener: () => void): Unsubscribe {
    if (isDispatch) {
      throw new Error("当前还存在reducer未执行完毕");
    }
    // 防止在订阅函数中执行清理函数
    let isSubscribed = true;
    listeners.push(listener);
    return function unsubcsribe() {
      if (!isSubscribed) return;
      if (isDispatch) {
        throw new Error("当前还存在reducer未执行完毕");
      }
      isSubscribed = false;
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    };
  }

  function dispatch<T extends A>(action: T): T {
    if (isDispatch) {
      throw new Error("当前还存在reducer未执行完毕");
    }
    try {
      isDispatch = true;
      // 调用 reducer 计算新 state
      state = reducer(state, action);
    } finally {
      isDispatch = false;
    }
    // 采用当前的快照
    const snapshot = listeners.slice();
    // 通知所有监听器
    snapshot.forEach((listener) => listener());
    return action;
  }

  // 初始化 state：让reducer 返回一个初始 state
  dispatch({ type: "@@INIT" } as A);

  return {
    dispatch,
    getState,
    subscribe,
  };
}
