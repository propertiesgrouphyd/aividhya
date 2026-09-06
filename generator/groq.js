const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const MAX_ATTEMPTS = 3;

const DAY_SCHEMA = {
  type: "object",
  additionalProperties: false,

  properties: {
    day: {
      type: "integer"
    },

    courseDate: {
      type: "string"
    },

    publishAt: {
      type: "string"
    },

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
              type: "string"
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
    },

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
            enum: [0, 1, 2, 3]
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
    },

    aiUpdate: {
      type: "object",
      additionalProperties: false,

      properties: {
        enabled: {
          type: "boolean"
        },

        title: {
          type: "string"
        },

        items: {
          type: "array",

          items: {
            type: "object",
            additionalProperties: false,

            properties: {
              headline: {
                type: "string"
              },

              summary: {
                type: "string"
              },

              source: {
                type: "string"
              }
            },

            required: [
              "headline",
              "summary",
              "source"
            ]
          }
        }
      },

      required: [
        "enabled",
        "title",
        "items"
      ]
    }
  },

  required: [
    "day",
    "courseDate",
    "publishAt",
    "title",
    "introduction",
    "sections",
    "practice",
    "keyTakeaways",
    "mcqs",
    "aiUpdate"
  ]
};

function buildAttemptPrompt(prompt, attempt) {
  if (attempt === 1) {
    return prompt;
  }

  return `${prompt}

FINAL CORRECTION FOR THIS RETRY:

The previous generation did not satisfy the required JSON schema.

You MUST obey these exact structural rules:

- Return ONLY one JSON object.
- Do not omit ANY required property.
- Do not add ANY property that is not in the schema.

IDENTITY:
- day MUST be present.
- courseDate MUST be present.
- publishAt MUST be present.
- The application will overwrite these three values after generation.

LESSON:
- title MUST be a non-empty string.
- introduction MUST be a non-empty string.
- sections MUST contain at least 4 sections.

EVERY SECTION MUST contain:
- heading
- subheading
- paragraphs
- example

PRACTICE:
- practice MUST be an object.
- practice MUST contain:
  - title
  - instruction

KEY TAKEAWAYS:
- keyTakeaways MUST be an array.
- keyTakeaways MUST contain at least 3 strings.

MCQs:
- mcqs MUST contain exactly 5 questions.
- EVERY MCQ MUST contain exactly 4 options.
- NEVER provide 5 options.
- NEVER provide 3 options.
- The options array must contain exactly:
  option 0
  option 1
  option 2
  option 3
- Every MCQ answer must be exactly 0, 1, 2, or 3.
- Every MCQ must contain:
  - question
  - options
  - answer
  - explanation

AI UPDATE:
- aiUpdate MUST ALWAYS be present.
- aiUpdate MUST be an object.
- aiUpdate MUST contain:
  - enabled
  - title
  - items
- If no verified current AI/news information was supplied, use EXACTLY:

"aiUpdate": {
  "enabled": false,
  "title": "AI Update",
  "items": []
}

- NEVER omit aiUpdate.
- NEVER invent news.
- NEVER invent current events.
- NEVER invent sources.
- If no verified current information is available, keep enabled false and items empty.

FINAL CHECK:
Before returning the JSON, verify that these properties all exist:

day
courseDate
publishAt
title
introduction
sections
practice
keyTakeaways
mcqs
aiUpdate

Return ONLY valid JSON.
`;
}

async function requestGroq(prompt) {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set."
    );
  }

  const response = await fetch(
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
            name: "vidhwaan_aividhya_day",

            strict: true,

            schema: DAY_SCHEMA
          }
        },

        messages: [
          {
            role: "system",

            content:
              "You are VIDHWAAN AIVidhya's professional Telugu educational content generator. Follow the JSON schema exactly. Never add extra fields. Never omit required fields. Never use empty required strings. Every MCQ must have exactly four options."
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

export async function generateWithGroq(prompt) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `🤖 Groq generation attempt ${attempt}/${MAX_ATTEMPTS}`
    );

    const attemptPrompt =
      buildAttemptPrompt(
        prompt,
        attempt
      );

    const result =
      await requestGroq(
        attemptPrompt
      );

    if (!result.ok) {
      let parsedError = null;

      try {
        parsedError =
          JSON.parse(result.rawText);
      } catch {
        // Keep raw response below.
      }

      const errorMessage =
        parsedError?.error?.message ||
        result.rawText;

      lastError =
        new Error(
          `Groq API error ${result.status}: ${result.rawText}`
        );

      /*
       * Schema-validation failures are safe
       * to retry because no lesson has been saved.
       */

      if (
        result.status === 400 &&
        (
          parsedError?.error?.code ===
            "json_validate_failed" ||
          errorMessage
            .toLowerCase()
            .includes("schema")
        )
      ) {
        console.log(
          "⚠️ Structured JSON validation failed. Retrying..."
        );

        continue;
      }

      throw lastError;
    }

    let apiResponse;

    try {
      apiResponse =
        JSON.parse(result.rawText);
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

    console.log(
      "✅ Groq returned structured JSON."
    );

    return message.content.trim();
  }

  throw new Error(
    `Groq failed structured JSON generation after ${MAX_ATTEMPTS} attempts.\n${lastError?.message || ""}`
  );
}
