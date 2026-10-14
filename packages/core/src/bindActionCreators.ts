import type { Action, ActionCreator, Dispatch } from "./createStore";

// 把单个 action creator 包装成"调用即 dispatch"的函数
function bindActionCreator<A extends Action, P extends any[]>(
  actionCreator: ActionCreator<A, P>,
  dispatch: Dispatch<A>,
): (...args: P) => A {
  return (...args: P) => dispatch(actionCreator(...args));
}

/**
 * 把 action creator（一个函数，或 { key: creator } 的对象）绑定到 dispatch 上，
 * 返回可以直接调用、自动派发 action 的版本。
 *
 * 传入对象时返回新对象（不改动原对象），非函数属性会被忽略。
 *
 * @param actionCreators 单个 action creator 或 action creator 的对象映射
 * @param dispatch store 的 dispatch 函数
 */
export function bindActionCreators<A extends Action, P extends any[]>(
  actionCreator: ActionCreator<A, P>,
  dispatch: Dispatch<A>,
): (...args: P) => A;
export function bindActionCreators<
  M extends Record<string, ActionCreator<any, any>>,
>(
  actionCreators: M,
  dispatch: Dispatch<any>,
): { [K in keyof M]: (...args: Parameters<M[K]>) => ReturnType<M[K]> };
export function bindActionCreators(
  actionCreators: ActionCreator<any, any> | Record<string, any>,
  dispatch: Dispatch<any>,
): any {
  if (typeof actionCreators === "function") {
    return bindActionCreator(
      actionCreators as ActionCreator<any, any>,
      dispatch,
    );
  }
  if (typeof actionCreators !== "object" || actionCreators === null) {
    throw new Error(
      `bindActionCreators 期待一个对象或函数形式的 actionCreators，实际收到 ${
        actionCreators === null ? "null" : typeof actionCreators
      }。是不是把 "import * as ActionCreators" 写成了 "import ActionCreators"？`,
    );
  }

  const boundActionCreators: Record<string, any> = {};
  for (const key of Object.keys(actionCreators)) {
    const actionCreator = actionCreators[key];
    // 非函数属性（比如 import * as 带进来的其他导出）直接忽略
    if (typeof actionCreator === "function") {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
