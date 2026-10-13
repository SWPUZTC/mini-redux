type Function = (arg: any[]) => any;

export function compose<R>(...funcs: Array<(arg: any) => R>): (arg: any) => R;
export function compose(...funcs: Array<Function>): Function;
export function compose(...funcs: Array<Function>): Function {
  if (!funcs.length) {
    return (arg: any) => arg;
  }
  if (funcs.length === 1) {
    return funcs[0]!;
  }
  return funcs.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(args)),
  );
}
