export type Resolvable<T, Relations extends keyof T> = T & {
  _relations: {
    [key in Relations]: key extends keyof T
      ? T[key] extends Array<unknown>
        ? Array<string>
        : string
      : never;
  };
};

export default Resolvable;
