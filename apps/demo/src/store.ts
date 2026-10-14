import {
  applyMiddleware,
  combineReducers,
  createStore,
  type Middleware,
} from '@mini-redux/core';

// ---------- 1. Action ----------
// 带命名前缀（counter/、todos/）避免多个切片之间的 type 撞名
export type AppAction =
  | { type: 'counter/increment' }
  | { type: 'counter/add'; payload: number }
  | { type: 'todos/add'; payload: string }
  | { type: 'todos/toggle'; payload: number };

export const increment = (): AppAction => ({ type: 'counter/increment' });
export const addAmount = (amount: number): AppAction => ({
  type: 'counter/add',
  payload: amount,
});
export const addTodo = (text: string): AppAction => ({ type: 'todos/add', payload: text });
export const toggleTodo = (id: number): AppAction => ({ type: 'todos/toggle', payload: id });

// ---------- 2. 切片 reducer ----------
export interface CounterState {
  value: number;
}

const counterReducer = (state: CounterState = { value: 0 }, action: AppAction): CounterState => {
  switch (action.type) {
    case 'counter/increment':
      return { value: state.value + 1 };
    case 'counter/add':
      return { value: state.value + action.payload };
    default:
      return state;
  }
};

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export interface TodosState {
  items: Todo[];
  nextId: number;
}

const todosReducer = (state: TodosState = { items: [], nextId: 1 }, action: AppAction): TodosState => {
  switch (action.type) {
    case 'todos/add': {
      const todo: Todo = { id: state.nextId, text: action.payload, done: false };
      return { items: [...state.items, todo], nextId: state.nextId + 1 };
    }
    case 'todos/toggle':
      return {
        ...state,
        items: state.items.map((todo) =>
          todo.id === action.payload ? { ...todo, done: !todo.done } : todo,
        ),
      };
    default:
      return state;
  }
};

// ---------- 3. 合并 + 中间件 + store ----------
export interface AppState {
  counter: CounterState;
  todos: TodosState;
}

const rootReducer = combineReducers<AppState, AppAction>({
  counter: counterReducer,
  todos: todosReducer,
});

// logger 中间件：把每次 dispatch 的 action 和更新后的 state 打印到控制台，
// 打开浏览器控制台即可观察完整数据流（演示用途，真实项目可换成持久化 / 上报等中间件）
const logger: Middleware<AppState, AppAction> = (api) => (next) => <T extends AppAction>(
  action: T,
): T => {
  console.log('[logger] dispatch ->', action.type);
  const result = next(action);
  console.log('[logger] next state ->', api.getState());
  return result;
};

// applyMiddleware 返回 createStore 的工厂（mini-redux 目前的 enhancer 用法）
export const store = applyMiddleware(logger)(rootReducer);
