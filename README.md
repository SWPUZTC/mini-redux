# mini-redux

# Redux 原理解析

## 三大原则

1. 单一数据源：整个应用的 **state** 保存在一个对象树中（store）
2. state只读：唯一改变 **state** 的方式是触发 action（事件对象）
3. 使用纯函数修改：reducer是纯函数（action, prevState）=> newState，不修改原State，而是返回新的 State 对象

## 核心数据流

用户操作 → dispatch(action) → reducer 计算新 state → store 更新 → 通知订阅者 → UI 重渲染

```text
React 组件（onClick/useEffect 等事件回调）
--> store.dispatch(action)
    -> state = reducer(state, action) <- 纯计算，同步完成
    -> listeners.forEach <- 同步遍历，通知所有订阅者
--> 订阅回调（React 侧，由 react-redux 注册）
    -> 更新 UI 重新渲染
```

# Slice 1 createStore

createStore 本质上就是一个发布/订阅模式：

- 内部维护 state 和一组 listeners
- dispatch(action) 调用 reducer 计算新 state，然后通知所有 listener
- subscribe(listener) 注册监听，返回取消订阅的函数

### 原生 Redux API 对应用法

```js
import { createStore } from 'redux';

// reducer：纯函数 (state, action) => newState
function counterReducer(state = { value: 0 }, action) {
  switch (action.type) {
    case 'counter/increment':
      return { ...state, value: state.value + 1 };
    case 'counter/add':
      return { ...state, value: state.value + action.payload };
    default:
      return state; // 不认识的 action，原样返回
  }
}

// 创建 store：整个应用只有一个
const store = createStore(counterReducer);

// 读取状态
store.getState(); // { value: 0 }

// 改变状态的唯一方式：dispatch 一个 action
store.dispatch({ type: 'counter/increment' });
store.getState(); // { value: 1 }

// 订阅状态变化（返回取消订阅函数）
const unsubscribe = store.subscribe(() => {
  console.log('state 更新了：', store.getState());
});
unsubscribe(); // 不再需要时取消订阅
```

> 文件：packages\core\src\createStore.ts

# Slice 2 Compose 函数

compose 是函数式编程中的经典概念：从右到左组合多个函数，传入一个初始值，每个函数的输出作为下一个函数的输入。

在 Redux 中它用于组合多个 middleware 增强 dispatch：
dispatch = middleware3(middleware2(middleware1(baseDispatch)))

### 原生 Redux API 对应用法

```js
import { createStore, applyMiddleware, compose } from 'redux';
import { thunk } from 'redux-thunk';

// compose：从右到左组合多个 store 增强器
// 这里把 thunk 中间件和 Redux DevTools 扩展组合成一个增强器
const storeEnhancer = compose(
  applyMiddleware(thunk),
  window.__REDUX_DEVTOOLS_EXTENSION__?.() ?? ((f) => f),
);

const store = createStore(reducer, storeEnhancer);

// 等价的嵌套写法（compose 就是帮你拍平这层嵌套）：
// const store = window.__REDUX_DEVTOOLS_EXTENSION__(
//   applyMiddleware(thunk)(createStore),
// )(reducer);
```

> 文件：packages\core\src\compose.ts

# Slice 3 combineReducers

在真实的应用中，我们不会用一个巨大的 reducer 管理所有的 state。combineReducers 的作用就是给定一个 map，它返回一个**新的 reducer**，每次 dispatch 时：

1. 遍历所有子 reducer
2. 用对应的 state 切片调用每个子 reducer
3. 将所有结果合并成一个新的 state 对象

```text
state = { counter: 0, todos: [] }
         ↓ dispatch({ type: 'INCREMENT' })
state = { counter: 1, todos: [] }
```

### 原生 Redux API 对应用法

```js
import { createStore, combineReducers } from 'redux';

function counterReducer(state = { value: 0 }, action) {
  switch (action.type) {
    case 'counter/increment':
      return { ...state, value: state.value + 1 };
    default:
      return state;
  }
}

function todosReducer(state = { items: [] }, action) {
  switch (action.type) {
    case 'todos/add':
      return { items: [...state.items, action.payload] };
    default:
      return state;
  }
}

// 每个子 reducer 只管理自己的 state 切片
const rootReducer = combineReducers({
  counter: counterReducer,
  todos: todosReducer,
});

const store = createStore(rootReducer);

store.getState(); // { counter: { value: 0 }, todos: { items: [] } }
store.dispatch({ type: 'counter/increment' });
store.getState(); // { counter: { value: 1 }, todos: { items: [] } }
```

> 文件：packages\core\src\combineReducers.ts

# Slice 4 applyMiddleware

applyMiddleware 本质上是对 createStore 的增强：

1. 先创建原生 store
2. 用 middleware 包装原始 dispatch
3. 通过 compose 把多个 middleware 串联起来
4. 返回一个增强版的 store

原生 dispatch → middleware1 → middleware2 → middleware3 → 真正的 dispatch
每个 middleware 接收 { getState, dispatch }，返回一个接收 next 的函数，next 指向下一个 middleware 或原生 dispatch。

### 原生 Redux API 对应用法

```js
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import logger from 'redux-logger';

// 多个中间件按顺序增强 dispatch
const store = createStore(
  reducer,
  applyMiddleware(thunk, logger),
);

// thunk：允许 dispatch 一个函数来处理异步逻辑
const fetchUser = (id) => async (dispatch, getState) => {
  dispatch({ type: 'user/loading' });
  const user = await api.getUser(id);
  dispatch({ type: 'user/loaded', payload: user });
};

store.dispatch(fetchUser(1)); // dispatch 的不再是对象，而是函数，被 thunk 截获执行
```

```js
const fetchUser = (id) => async (dispatch, getState) => {
  dispatch({ type: "user/loading" });
  const user = await api.getUser(id);
  dispatch({ type: "user/loaded", payload: user });
};
store.dispatch(fetchUser(1)); // dispatch 的不再是对象，而是函数，被 thunk 截获执行
```

> 文件：packages\core\src\applyMiddleware.ts

# Slice 5 bindActionCreators

bindActionCreators 是一个工具函数，把 action creator（返回 action 对象的函数）和 dispatch 绑定在一起，返回"调用即自动 dispatch"的版本。

作用：让组件（或任何代码）不需要拿到 store/dispatch 也能触发 action，通常配合 connect 的 mapDispatchToProps 或组件 props 注入使用。

支持两种形式：

1. 传入单个 action creator：返回一个包装后的函数
2. 传入 `{ key: creator }` 对象：返回同样结构、每个 creator 都已绑定的新对象（非函数属性会被忽略，比如 `import * as ActionCreators` 带进来的其他导出）

```js
// 绑定前：需要手动 dispatch(actionCreator(...))
store.dispatch(increment());
store.dispatch(addAmount(5));

// 绑定后：直接调用，自动 dispatch
const actions = bindActionCreators({ increment, addAmount }, store.dispatch);
actions.increment();
actions.addAmount(5);
```

### 原生 Redux API 对应用法

```js
import { createStore, bindActionCreators } from 'redux';

// action creator：返回 action 对象的函数
const increment = () => ({ type: 'counter/increment' });
const addAmount = (amount) => ({ type: 'counter/add', payload: amount });

const store = createStore(counterReducer);

// 绑定前：需要手动 dispatch(actionCreator(...))
store.dispatch(increment());
store.dispatch(addAmount(5));

// 绑定后：直接调用即自动 dispatch
const actions = bindActionCreators({ increment, addAmount }, store.dispatch);
actions.increment();
actions.addAmount(5);

// 在 React 项目中的经典用法：配合 connect 注入组件 props
// const mapDispatchToProps = (dispatch) => ({
//   ...bindActionCreators({ increment, addAmount }, dispatch),
// });
```

> 文件：packages\core\src\bindActionCreators.ts

# Slice 6 react-redux

React 绑定层做的事情很简单：

1. Provider：用 React Context 把 store 传递给整棵组件树
2. useSelector：通过 store.subscribe 订阅 state 变化，用 useSyncExternalStore（React 18+ 的并发安全外部状态订阅 API）触发组件重渲染

   Provider (Context) → 组件树 → useSelector(state => state.xxx)
   ↓
   subscribe + useSyncExternalStore
   ↓
   state 变化 → 重渲染

### 原生 react-redux API 对应用法

```jsx
import { Provider, useSelector, useDispatch } from 'react-redux';

// 1. Provider：通过 Context 把 store 注入整棵组件树
ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>,
);

// 2. useSelector：订阅 state 切片，变化时自动重渲染
function CounterPanel() {
  const count = useSelector((state) => state.counter.value);
  const dispatch = useDispatch();

  return (
    <button onClick={() => dispatch({ type: 'counter/increment' })}>
      当前值：{count}
    </button>
  );
}
```

> 文件：packages\react
