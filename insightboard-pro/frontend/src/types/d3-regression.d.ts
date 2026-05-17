declare module "d3-regression" {
  export interface RegressionGenerator<T> {
    x(accessor: (d: T) => number): RegressionGenerator<T>;
    y(accessor: (d: T) => number): RegressionGenerator<T>;
    (data: T[]): [number, number][] | null;
  }

  export function regressionLinear<T>(): RegressionGenerator<T>;
}
