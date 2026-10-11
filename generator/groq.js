
const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const MAX_ATTEMPTS = 3;


/* ============================================================
   CONTENT SCRIPT VALIDATION
============================================================ */

const ALLOWED_SCRIPT_TELUGU = /\p{Script=Telugu}/u;
const ALLOWED_SCRIPT_LATIN = /\p{Script=Latin}/u;
const ALLOWED_SCRIPT_COMMON = /\p{Script=Common}/u;
const ALLOWED_SCRIPT_INHERITED = /\p{Script=Inherited}/u;

function findUnsupportedScript(
  value,
  path = "content"
) {
  if (typeof value === "string") {
    for (const character of value) {
      if (
        !ALLOWED_SCRIPT_TELUGU.test(character) &&
        !ALLOWED_SCRIPT_LATIN.test(character) &&
        !ALLOWED_SCRIPT_COMMON.test(character) &&
        !ALLOWED_SCRIPT_INHERITED.test(character)
      ) {
        return {
          path,
          character,
          codePoint:
            `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`
        };
      }
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (
      let index = 0;
      index < value.length;
      index++
    ) {
      const issue =
        findUnsupportedScript(
          value[index],
          `${path}[${index}]`
        );

      if (issue) {
        return issue;
      }
    }

    return null;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const [key, child]
      of Object.entries(value)
    ) {
      const issue =
        findUnsupportedScript(
          child,
          `${path}.${key}`
        );

      if (issue) {
        return issue;
      }
    }
  }

  return null;
}


function validateContentLanguage(
  content,
  contentType
) {
  const issue =
    findUnsupportedScript(
      content,
      contentType
    );

  if (!issue) {
    return;
  }

  const error =
    new Error(
      `Groq returned unsupported writing-system content at ${issue.path}: ${issue.character} (${issue.codePoint})`
    );

  error.isLanguageValidation = true;

  throw error;
}


/* ============================================================
   LESSON CONTENT VALIDATION
============================================================ */

function validateLessonParagraphs(
  lesson
) {
  if (
    !lesson ||
    typeof lesson !== "object" ||
    Array.isArray(lesson)
  ) {
    throw new Error(
      "Lesson content must be a JSON object."
    );
  }

  if (!Array.isArray(lesson.sections)) {
    throw new Error(
      "Lesson validation failed: sections must be an array."
    );
  }

  for (
    let sectionIndex = 0;
    sectionIndex < lesson.sections.length;
    sectionIndex++
  ) {
    const section =
      lesson.sections[sectionIndex];

    if (
      !section ||
      typeof section !== "object" ||
      Array.isArray(section)
    ) {
      const error =
        new Error(
          `sections[${sectionIndex}] must be a valid object.`
        );

      error.isContentValidation = true;

      throw error;
    }

    if (!Array.isArray(section.paragraphs)) {
      const error =
        new Error(
          `sections[${sectionIndex}].paragraphs must be an array.`
        );

      error.isContentValidation = true;

      throw error;
    }

    if (
      section.paragraphs.length < 1 ||
      section.paragraphs.length > 3
    ) {
      const error =
        new Error(
          `sections[${sectionIndex}].paragraphs must contain 1–3 paragraphs.`
        );

      error.isContentValidation = true;

      throw error;
    }

    for (
      let paragraphIndex = 0;
      paragraphIndex < section.paragraphs.length;
      paragraphIndex++
    ) {
      const paragraph =
        section.paragraphs[paragraphIndex];

      if (
        typeof paragraph !== "string" ||
        paragraph.trim().length === 0
      ) {
        const error =
          new Error(
            `Lesson content validation failed: sections[${sectionIndex}].paragraphs[${paragraphIndex}] must be a non-empty string.`
          );

        error.isContentValidation = true;

        throw error;
      }
    }
  }
}


/* ============================================================
   LESSON SCHEMA
============================================================ */

const LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,

  properties: {
    title: {
      type: "string"
    },

    introduction: {
      type: "string"
    },

    sections: {
      type: "array",
      minItems: 4,

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          heading: {
            type: "string"
          },

          subheading: {
            type: "string"
          },

          paragraphs: {
            type: "array",
            minItems: 1,

            items: {
              type: "string",
              minLength: 1
            }
          },

          example: {
            type: "object",
            additionalProperties: false,

            properties: {
              title: {
                type: "string"
              },

              content: {
                type: "string"
              }
            },

            required: [
              "title",
              "content"
            ]
          }
        },

        required: [
          "heading",
          "subheading",
          "paragraphs",
          "example"
        ]
      }
    },

    practice: {
      type: "object",
      additionalProperties: false,

      properties: {
        title: {
          type: "string"
        },

        instruction: {
          type: "string"
        }
      },

      required: [
        "title",
        "instruction"
      ]
    },

    keyTakeaways: {
      type: "array",
      minItems: 3,

      items: {
        type: "string"
      }
    }
  },

  required: [
    "title",
    "introduction",
    "sections",
    "practice",
    "keyTakeaways"
  ]
};


/* ============================================================
   MCQ SCHEMA
============================================================ */

const MCQ_SCHEMA = {
  type: "object",
  additionalProperties: false,

  properties: {
    mcqs: {
      type: "array",
      minItems: 5,
      maxItems: 5,

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          question: {
            type: "string"
          },

          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,

            items: {
              type: "string"
            }
          },

          answer: {
            type: "integer",
            enum: [
              0,
              1,
              2,
              3
            ]
          },

          explanation: {
            type: "string"
          }
        },

        required: [
          "question",
          "options",
          "answer",
          "explanation"
        ]
      }
    }
  },

  required: [
    "mcqs"
  ]
};


/* ============================================================
   LESSON RETRY PROMPT
============================================================ */

function buildLessonAttemptPrompt(
  prompt,
  attempt,
  previousError = ""
) {
  if (attempt === 1) {
    return prompt;
  }

  return `${prompt}

FINAL CORRECTION FOR THIS RETRY:

The previous lesson generation failed automated validation.

Validation error:
${previousError || "The generated lesson did not pass content validation."}

Correct the problem and regenerate the COMPLETE lesson.

PARAGRAPH REQUIREMENTS:

- Every section must contain a paragraphs array.
- Each paragraphs array must contain 1–3 paragraphs.
- Every paragraph must be a string.
- Every paragraph must contain meaningful educational content.
- Never return an empty string.
- Never return a string containing only whitespace.
- Never return null, numbers, objects, or arrays as paragraphs.
- Do not leave blank placeholders.
- Review every paragraph before returning the JSON.
- If a paragraph is invalid, replace it with a complete explanation relevant to that section.
- Do not merely repeat the same invalid response.

Use natural, standard Telugu. English/Latin technical terms are allowed where appropriate. Do not use any other writing system.

Return exactly ONE JSON object.

Do NOT include:
- day
- courseDate
- publishAt
- mcqs
- aiUpdate

The application controls those fields separately.

The lesson MUST contain:

- title
- introduction
- sections
- practice
- keyTakeaways

REQUIRED LESSON STRUCTURE:

- sections MUST contain at least 4 sections.
- Every section MUST contain:
  - heading
  - subheading
  - paragraphs
  - example
- Every example MUST contain:
  - title
  - content
- practice MUST contain:
  - title
  - instruction
- keyTakeaways MUST contain at least 3 strings.

Do not add any properties that are not defined by the schema.

Do not return Markdown.

Return ONLY valid JSON.
`;
}


/* ============================================================
   MCQ RETRY PROMPT
============================================================ */

function buildMCQAttemptPrompt(
  prompt,
  attempt
) {
  if (attempt === 1) {
    return prompt;
  }

  return `${prompt}

FINAL CORRECTION FOR THIS RETRY:

Use natural, standard Telugu for all MCQ text. English/Latin technical terms are allowed where appropriate. Do not use any other writing system.

The previous MCQ generation did not pass automated validation.

Return exactly ONE JSON object.

The object MUST contain:

mcqs

MCQ REQUIREMENTS:

- mcqs MUST contain EXACTLY 5 questions.
- NEVER return fewer than 5.
- NEVER return more than 5.
- Every MCQ MUST contain exactly 4 options.
- NEVER provide 3 options.
- NEVER provide 5 options.
- Every MCQ MUST contain:
  - question
  - options
  - answer
  - explanation
- Every question must be a non-empty string.
- Every option must be a non-empty string.
- Every explanation must be a non-empty string.
- answer MUST be exactly:
  0
  1
  2
  or
  3
- Exactly one option must be correct.
- The explanation MUST match the correct answer.
- Questions must test understanding.
- Avoid ambiguous questions.
- Do not create duplicate questions.
- Distribute correct answers naturally.

Do NOT include:
- title
- introduction
- sections
- practice
- keyTakeaways
- day
- courseDate
- publishAt
- aiUpdate

Return ONLY valid JSON.
`;
}


/* ============================================================
   GENERIC GROQ REQUEST
============================================================ */

async function requestGroq(
  prompt,
  schema,
  schemaName,
  systemInstruction
) {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set."
    );
  }

  const response =
    await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: MODEL,

          temperature: 0.2,

          reasoning_effort: "medium",

          response_format: {
            type: "json_schema",

            json_schema: {
              name: schemaName,

              strict: true,

              schema
            }
          },

          messages: [
            {
              role: "system",

              content:
                systemInstruction
            },

            {
              role: "user",

              content: prompt
            }
          ]
        })
      }
    );

  const rawText =
    await response.text();

  return {
    ok: response.ok,
    status: response.status,
    rawText
  };
}


/* ============================================================
   PARSE GROQ RESPONSE
============================================================ */

function parseGroqResponse(
  result
) {
  let parsedError = null;

  try {
    parsedError =
      JSON.parse(
        result.rawText
      );
  } catch {
    // Keep raw response below.
  }

  if (!result.ok) {
    const errorMessage =
      parsedError?.error?.message ||
      result.rawText;

    const error =
      new Error(
        `Groq API error ${result.status}: ${result.rawText}`
      );

    error.isSchemaValidation =
      result.status === 400 &&
      (
        parsedError?.error?.code ===
          "json_validate_failed" ||
        errorMessage
          .toLowerCase()
          .includes("schema")
      );

    throw error;
  }

  let apiResponse;

  try {
    apiResponse =
      JSON.parse(
        result.rawText
      );
  } catch {
    throw new Error(
      "Groq returned an invalid API response."
    );
  }

  const message =
    apiResponse?.choices?.[0]?.message;

  if (!message) {
    throw new Error(
      "Groq response did not contain a message."
    );
  }

  if (
    typeof message.content !== "string" ||
    !message.content.trim()
  ) {
    throw new Error(
      "Groq response did not contain JSON content."
    );
  }

  return message.content.trim();
}


/* ============================================================
   LESSON GENERATION
============================================================ */

export async function generateLessonWithGroq(
  prompt
) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `🤖 Groq lesson generation attempt ${attempt}/${MAX_ATTEMPTS}`
    );

    const attemptPrompt =
      buildLessonAttemptPrompt(
        prompt,
        attempt,
        lastError?.message || ""
      );

    try {
      const result =
        await requestGroq(
          attemptPrompt,
          LESSON_SCHEMA,
          "vidhwaan_aividhya_lesson",
          "You are VIDHWAAN AIVidhya's professional Telugu educational lesson generator. Generate natural, standard Telugu. English/Latin technical terms are allowed where appropriate; do not use any other writing system. Follow the JSON schema exactly. Never add extra fields. Never omit required fields. Every paragraph must be a meaningful, non-empty string. Never return empty or whitespace-only paragraphs. Do not generate MCQs, aiUpdate, day, courseDate, or publishAt."
        );

      const content =
        parseGroqResponse(
          result
        );

      let parsedContent;

      try {
        parsedContent =
          JSON.parse(content);
      } catch {
        const error =
          new Error(
            "Groq lesson response was not valid JSON."
          );

        error.isContentValidation = true;

        throw error;
      }

      validateContentLanguage(
        parsedContent,
        "lesson"
      );

      validateLessonParagraphs(
        parsedContent
      );

      console.log(
        "✅ Groq lesson generation succeeded."
      );

      console.log(
        "✅ Lesson paragraph validation passed."
      );

      return content;

    } catch (error) {
      lastError = error;

      const retryable =
        error?.isSchemaValidation ||
        error?.isLanguageValidation ||
        error?.isContentValidation;

      if (
        retryable &&
        attempt < MAX_ATTEMPTS
      ) {
        console.log(
          `⚠️ Lesson validation failed on attempt ${attempt}/${MAX_ATTEMPTS}. Retrying...`
        );

        console.log(
          `Reason: ${error.message}`
        );

        continue;
      }

      if (
        retryable &&
        attempt === MAX_ATTEMPTS
      ) {
        console.error(
          "❌ Lesson validation failed after all attempts."
        );
      }

      throw error;
    }
  }

  throw new Error(
    `Groq lesson generation failed after ${MAX_ATTEMPTS} attempts.\n${
      lastError?.message || ""
    }`
  );
}


/* ============================================================
   MCQ GENERATION
============================================================ */

export async function generateMCQsWithGroq(
  prompt
) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `🤖 Groq MCQ generation attempt ${attempt}/${MAX_ATTEMPTS}`
    );

    const attemptPrompt =
      buildMCQAttemptPrompt(
        prompt,
        attempt
      );

    try {
      const result =
        await requestGroq(
          attemptPrompt,
          MCQ_SCHEMA,
          "vidhwaan_aividhya_mcqs",
          "You are VIDHWAAN AIVidhya's professional Telugu examination-question generator. Generate exactly five high-quality MCQs in natural, standard Telugu based only on the supplied lesson. English/Latin technical terms are allowed where appropriate; do not use any other writing system. Follow the JSON schema exactly. Every MCQ must have exactly four options and exactly one correct answer. Never add extra fields."
        );

      const content =
        parseGroqResponse(
          result
        );

      const parsedContent =
        JSON.parse(content);

      validateContentLanguage(
        parsedContent,
        "mcqs"
      );

      console.log(
        "✅ Groq MCQ generation succeeded."
      );

      return content;

    } catch (error) {
      lastError = error;

      if (
        (
          error?.isSchemaValidation ||
          error?.isLanguageValidation
        ) &&
        attempt < MAX_ATTEMPTS
      ) {
        console.log(
          "⚠️ MCQ validation failed. Retrying..."
        );

        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Groq MCQ generation failed after ${MAX_ATTEMPTS} attempts.\n${
      lastError?.message || ""
    }`
  );
}


/* ============================================================
   BACKWARD-COMPATIBILITY EXPORT
============================================================ */

/*
 * This export is intentionally retained temporarily so that
 * any external code importing generateWithGroq does not fail
 * immediately.
 *
 * New generation flow should use:
 *
 * generateLessonWithGroq()
 * generateMCQsWithGroq()
 */

export async function generateWithGroq(
  prompt
) {
  return generateLessonWithGroq(
    prompt
  );
}
