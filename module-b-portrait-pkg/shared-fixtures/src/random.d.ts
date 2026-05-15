export type Rng = () => number;
export declare function makeRng(seed: number): Rng;
export declare function randInt(rng: Rng, min: number, max: number): number;
export declare function pick<T>(rng: Rng, arr: readonly T[]): T;
export declare function pickWeighted<T>(rng: Rng, items: readonly {
    value: T;
    weight: number;
}[]): T;
export declare function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[];
export declare function gauss(rng: Rng, mean: number, sd: number): number;
export declare function clipInt(value: number, min: number, max: number): number;
export declare function chance(rng: Rng, p: number): boolean;
export declare function pseudoId(prefix: string, index: number): string;
