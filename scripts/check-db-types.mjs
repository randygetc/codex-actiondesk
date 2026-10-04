import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
function normalize(source) {
  const file = ts.createSourceFile("database.types.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error("Invalid generated TypeScript.");
  return printer.printFile(file);
}
try {
  const generated = execFileSync("supabase", ["gen", "types", "typescript", "--local"], {
    stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
  });
  const committed = readFileSync(new URL("../src/lib/database.types.ts", import.meta.url), "utf8");
  if (normalize(generated) !== normalize(committed)) {
    process.stderr.write("Database types differ from the local schema. Regenerate src/lib/database.types.ts using the pinned Supabase CLI (2.118.0).\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("Committed database types match the migrated local schema.\n");
  }
} catch {
  process.stderr.write("Database type verification failed. Start the local test database and check the CLI version.\n");
  process.exitCode = 1;
}
