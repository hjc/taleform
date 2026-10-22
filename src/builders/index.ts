import type { Builder } from "../core/builder";
import { adventureMap } from "./adventureMap";
import { navigation } from "./navigation";

/**
 * Every builder, in the order they run. A builder may read what an earlier one emitted,
 * so order is a dependency list: navigation rewrites notes before maps read them.
 */
export const BUILDERS: Builder[] = [navigation, adventureMap];
