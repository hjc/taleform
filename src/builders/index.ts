import type { Builder } from "../core/builder";
import { adventureMap } from "./adventureMap";
import { awards } from "./awards";
import { ledger } from "./ledger";
import { navigation } from "./navigation";
import { resume } from "./resume";
import { schema } from "./schema";

/**
 * Every builder, in the order they run. A builder may read what an earlier one emitted, so the
 * order is a dependency list: schema validates first, then notes are rewritten, then the views
 * that summarise them (mission note regions, maps) are built last.
 */
export const BUILDERS: Builder[] = [schema, navigation, awards, resume, ledger, adventureMap];
