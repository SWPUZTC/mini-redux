import type { Action, Reducer } from "./createStore";

/**
 * 将多个 reducer 合并为一个 reducer
 * 每个子 reducer 只负责 state 树中自己对应的切片
 *
 * @param reducers 一个对象，每个 key 对应 state 树中的一个字段，值是负责该字段的 reducer
 * @returns 合并后的 reducer
 */
export function combineReducers<S, A extends Action = Action>(reducers: {
  [K in keyof S]: Reducer<S[K], A>;
}): Reducer<S, A> {
  const reducerKeys = Object.keys(reducers) as Array<keyof S>;

  return function combination(state: S = {} as S, action: A): S {
    // 用于标记 state 是否有变化
    let hasChanged = false;
    // 新的 state 对象
    const nextState = {} as S;
    for (const key of reducerKeys) {
      const previousStateForKey = state[key];
      const nextStateForKey = reducers[key](previousStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
