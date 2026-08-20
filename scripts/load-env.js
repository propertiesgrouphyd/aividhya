import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env");

if (!fs.existsSync(envFile)) {
  throw new Error(
    ".env file not found. Create it before local generation."
  );
}

const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);

for (const line of lines) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const separator = trimmed.indexOf("=");

  if (separator === -1) {
    continue;
  }

  const key = trimmed
    .slice(0, separator)
    .trim();

  let value = trimmed
    .slice(separator + 1)
    .trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (!key) {
    continue;
  }

  /*
   * Never overwrite an environment variable
   * already supplied by the operating system,
   * CI/CD, or GitHub Actions.
   */
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
