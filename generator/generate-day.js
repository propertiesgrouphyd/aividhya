import "../scripts/load-env.js";
import fs from "node:fs";
import path from "node:path";

import { buildPrompt } from "./prompt.js";
import { generateWithGroq } from "./groq.js";
import { validateDayContent } from "./validate-day.js";

const ROOT = process.cwd();

const SYLLABUS_FILE = path.join(
  ROOT,
  "syllabus.json"
);

const CONFIG_FILE = path.join(
  ROOT,
  "config",
  "app-config.json"
);

const DATA_DIR = path.join(
  ROOT,
  "data"
);

function fail(message) {
  console.error("");
  console.error("==============================================");
  console.error(" VIDHWAAN AIVidhya — GENERATION FAILED");
  console.error("==============================================");
  console.error(message);
  console.error("==============================================");
  console.error("");
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch (error) {
    fail(
      `Invalid JSON file:\n${file}\n${error.message}`
    );
  }
}

function getDays(syllabusRoot) {
  if (Array.isArray(syllabusRoot)) {
    return syllabusRoot;
  }

  if (Array.isArray(syllabusRoot?.days)) {
    return syllabusRoot.days;
  }

  fail(
    "syllabus.json does not contain a valid days array."
  );
}

function findLastGeneratedDay() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });

    return 0;
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) =>
      /^day-\d{3}\.json$/.test(file)
    );

  let highest = 0;

  for (const file of files) {
    const match =
      file.match(/^day-(\d{3})\.json$/);

    if (!match) {
      continue;
    }

    const day = Number(match[1]);

    if (day > highest) {
      highest = day;
    }
  }

  return highest;
}

function calculateCourseDate(
  startDate,
  dayNumber
) {
  const [year, month, day] =
    startDate.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    fail(
      `Invalid courseStartDate: ${startDate}`
    );
  }

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(
    date.getUTCDate() + dayNumber - 1
  );

  const resultYear =
    date.getUTCFullYear()
      .toString()
      .padStart(4, "0");

  const resultMonth =
    String(date.getUTCMonth() + 1)
      .padStart(2, "0");

  const resultDay =
    String(date.getUTCDate())
      .padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function createPublishAt(
  courseDate,
  publishTime
) {
  return `${courseDate}T${publishTime}:00+05:30`;
}

function extractJson(text) {
  let cleaned = text.trim();

  /*
   * Some models may still return JSON
   * inside markdown fences despite instructions.
   * Remove ONLY those fences.
   */

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      `Groq did not return valid JSON.\n${error.message}\n\nRAW RESPONSE:\n${text}`
    );
  }
}

async function main() {
  const syllabusRoot =
    readJson(SYLLABUS_FILE);

  const config =
    readJson(CONFIG_FILE);

  const days =
    getDays(syllabusRoot);

  const totalDays =
    Number(config.totalDays);

  if (days.length !== totalDays) {
    fail(
      `Syllabus contains ${days.length} days but config requires ${totalDays}.`
    );
  }

  const lastGeneratedDay =
    findLastGeneratedDay();

  const nextDay =
    lastGeneratedDay + 1;

  console.log("");
  console.log("==============================================");
  console.log(" VIDHWAAN AIVidhya — DAILY AI GENERATOR");
  console.log("==============================================");
  console.log(
    `Last generated day : ${lastGeneratedDay}`
  );
  console.log(
    `Next day           : ${nextDay}`
  );
  console.log(
    `Course total       : ${totalDays}`
  );
  console.log("==============================================");

  if (nextDay > totalDays) {
    console.log("");
    console.log(
      "🎓 All 365 lessons are already generated."
    );
    console.log(
      "Nothing to generate."
    );
    console.log("");
    return;
  }

  const outputFile =
    path.join(
      DATA_DIR,
      `day-${String(nextDay).padStart(3, "0")}.json`
    );

  /*
   * Absolute safety:
   * never overwrite an existing lesson.
   */

  if (fs.existsSync(outputFile)) {
    fail(
      `Safety stop: ${path.basename(outputFile)} already exists.`
    );
  }

  const daySyllabus =
    days.find(
      (item) =>
        Number(item.day) === nextDay
    );

  if (!daySyllabus) {
    fail(
      `Day ${nextDay} was not found in syllabus.json.`
    );
  }

  const courseDate =
    calculateCourseDate(
      config.courseStartDate,
      nextDay
    );

  const publishAt =
    createPublishAt(
      courseDate,
      config.publishTime
    );

  console.log("");
  console.log(
    `📚 Selected syllabus: Day ${nextDay}`
  );

  console.log(
    `📖 Title: ${daySyllabus.title}`
  );

  console.log(
    `📅 Course date: ${courseDate}`
  );

  console.log(
    `⏰ Publish: ${publishAt}`
  );

  console.log("");
  console.log(
    "Sending ONLY this day's syllabus to Groq..."
  );
  console.log("");

  const prompt =
    buildPrompt(daySyllabus);

  let rawResponse;

  try {
    rawResponse =
      await generateWithGroq(
        prompt
      );
  } catch (error) {
    fail(
      `Groq request failed:\n${error.message}`
    );
  }

  let generated;

  try {
    generated =
      extractJson(rawResponse);
  } catch (error) {
    fail(error.message);
  }

  /*
   * The AI is NOT trusted for identity/date metadata.
   * Our application controls these values.
   */

  generated.day =
    nextDay;

  generated.courseDate =
    courseDate;

  generated.publishAt =
    publishAt;

  try {
    validateDayContent(
      generated,
      nextDay
    );
  } catch (error) {
    fail(error.message);
  }

  /*
   * Pretty JSON for long-term readability.
   */

  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      generated,
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log("");
  console.log("==============================================");
  console.log(" ✅ DAILY LESSON GENERATED");
  console.log("==============================================");
  console.log(
    `Day       : ${nextDay}`
  );
  console.log(
    `Date      : ${courseDate}`
  );
  console.log(
    `Output    : ${path.relative(ROOT, outputFile)}`
  );
  console.log(
    `Sections  : ${generated.sections.length}`
  );
  console.log(
    `MCQs      : ${generated.mcqs.length}`
  );
  console.log(
    "Validation: PASSED"
  );
  console.log("==============================================");
  console.log("");
}

main().catch((error) => {
  fail(
    error?.stack ||
    error?.message ||
    String(error)
  );
});
