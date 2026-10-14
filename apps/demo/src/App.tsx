import { useState, type FormEvent } from 'react';
import { Provider, shallowEqual, useDispatch, useSelector } from '@mini-redux/react';
import {
  addAmount,
  addTodo,
  increment,
  store,
  toggleTodo,
  type AppState,
  type Todo,
} from './store';

function CounterPanel() {
  const count = useSelector<AppState, number>((state) => state.counter.value);
  const dispatch = useDispatch();

  return (
    <section>
      <h2>计数器</h2>
      <p>当前值：{count}</p>
      <button onClick={() => dispatch(increment())}>+1</button>{' '}
      <button onClick={() => dispatch(addAmount(5))}>+5</button>
    </section>
  );
}

function StatsPanel() {
  // 选择器返回新对象 —— 搭配 shallowEqual，只有数值真正变化时才重渲染
  const stats = useSelector<AppState, { total: number; done: number }>(
    (state) => ({
      total: state.todos.items.length,
      done: state.todos.items.filter((todo) => todo.done).length,
    }),
    shallowEqual,
  );

  return (
    <p>
      共 {stats.total} 项，已完成 {stats.done} 项
    </p>
  );
}

function TodosPanel() {
  const todos = useSelector<AppState, Todo[]>((state) => state.todos.items);
  const dispatch = useDispatch();
  const [text, setText] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    dispatch(addTodo(trimmed));
    setText('');
  };

  return (
    <section>
      <h2>待办列表</h2>
      <form onSubmit={submit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="输入新的待办..."
        />
        <button type="submit">添加</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li
            key={todo.id}
            onClick={() => dispatch(toggleTodo(todo.id))}
            style={{
              cursor: 'pointer',
              textDecoration: todo.done ? 'line-through' : 'none',
            }}
          >
            {todo.text}
          </li>
        ))}
      </ul>
      <StatsPanel />
    </section>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Mini Redux Demo</h1>
        <CounterPanel />
        <TodosPanel />
      </div>
    </Provider>
  );
}
