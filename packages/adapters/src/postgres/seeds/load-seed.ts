import type { Directory, Result } from "@nuvantre/domain";
import seed from "./directories.json";
import { parseSeedDirectories } from "./parse-seed";

/** The curated directory catalogue bundled with the code. */
export const loadSeedDirectories = (): Result<Directory[], string> => parseSeedDirectories(seed);
