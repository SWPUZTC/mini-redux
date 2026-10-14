import { describe, expect, test } from "bun:test";
import { compose } from "../src/index";

describe("compose", () => {
  test("不传任何函数时返回恒等函数", () => {
    const identity = compose();
    const obj = { a: 1 };
    expect(identity(obj)).toBe(obj);
    expect(identity(3)).toBe(3);
  });

  test("只传一个函数时直接返回它", () => {
    const fn = (n: number) => n + 1;
    expect(compose(fn)).toBe(fn);
  });

  test("组合顺序是从右到左", () => {
    const addOne = (n: number) => n + 1;
    const double = (n: number) => n * 2;
    expect(compose(addOne, double)(3)).toBe(7); // addOne(double(3))
    expect(compose(double, addOne)(3)).toBe(8); // double(addOne(3))
  });

  test("三个函数：compose(f, g, h)(x) === f(g(h(x)))", () => {
    const f = (s: string) => `f(${s})`;
    const g = (s: string) => `g(${s})`;
    const h = (s: string) => `h(${s})`;
    expect(compose(f, g, h)("x")).toBe("f(g(h(x)))");
  });

  test("最先被执行（最右）的函数接收全部参数", () => {
    const sum = (a: number, b: number) => a + b;
    const times10 = (n: number) => n * 10;
    expect(compose(times10, sum)(1, 2)).toBe(30);
  });

  test("组合本身不会提前执行任何函数", () => {
    let calls = 0;
    const spy = (n: number) => {
      calls++;
      return n;
    };
    const composed = compose(spy, spy);
    expect(calls).toBe(0); // 仅组合，未调用
    composed(1);
    expect(calls).toBe(2); // 调用时两个函数各执行一次
  });
});
