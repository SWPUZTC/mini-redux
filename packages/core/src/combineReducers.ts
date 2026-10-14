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
      // 子 reducer 不允许返回 undefined：区分不了"想忽略 action"和"写错了"
      if (typeof nextStateForKey === "undefined") {
        throw new Error(
          `slice reducer "${String(key)}" 在处理 action "${String(action?.type)}" 时返回了 undefined。` +
            `要忽略该 action 请显式返回原 state；要表示空值请返回 null。`,
        );
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    // state 里出现不属于任何 reducer 的多余 key 时也视为有变化，
    // 返回的 nextState 会把多余的 key 剔除掉
    hasChanged =
      hasChanged ||
      reducerKeys.length !== Object.keys(state as Record<string, unknown>).length;
    return hasChanged ? nextState : state;
  };
}
