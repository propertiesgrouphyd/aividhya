function fail(message) {
  throw new Error(`Day JSON validation failed: ${message}`);
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${field} must be a non-empty string.`);
  }
}

function requireArray(value, field, minimum = 1) {
  if (!Array.isArray(value)) {
    fail(`${field} must be an array.`);
  }

  if (value.length < minimum) {
    fail(`${field} must contain at least ${minimum} item(s).`);
  }
}

export function validateDayContent(content, expectedDay) {
  if (!content || typeof content !== "object") {
    fail("Root content must be an object.");
  }

  /*
   * Basic identity
   */

  if (Number(content.day) !== Number(expectedDay)) {
    fail(
      `day must be ${expectedDay}, received ${content.day}.`
    );
  }

  requireString(content.courseDate, "courseDate");
  requireString(content.publishAt, "publishAt");
  requireString(content.title, "title");
  requireString(content.introduction, "introduction");

  /*
   * Sections
   */

  requireArray(content.sections, "sections", 4);

  content.sections.forEach((section, index) => {
    if (!section || typeof section !== "object") {
      fail(`sections[${index}] must be an object.`);
    }

    requireString(
      section.heading,
      `sections[${index}].heading`
    );

    if (
      section.subheading !== undefined &&
      section.subheading !== null
    ) {
      requireString(
        section.subheading,
        `sections[${index}].subheading`
      );
    }

    requireArray(
      section.paragraphs,
      `sections[${index}].paragraphs`,
      1
    );

    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      requireString(
        paragraph,
        `sections[${index}].paragraphs[${paragraphIndex}]`
      );
    });

    if (!section.example || typeof section.example !== "object") {
      fail(`sections[${index}].example must be an object.`);
    }

    requireString(
      section.example.title,
      `sections[${index}].example.title`
    );

    requireString(
      section.example.content,
      `sections[${index}].example.content`
    );
  });

  /*
   * Practice
   */

  if (!content.practice || typeof content.practice !== "object") {
    fail("practice must be an object.");
  }

  requireString(
    content.practice.title,
    "practice.title"
  );

  requireString(
    content.practice.instruction,
    "practice.instruction"
  );

  /*
   * Key takeaways
   */

  requireArray(
    content.keyTakeaways,
    "keyTakeaways",
    3
  );

  content.keyTakeaways.forEach((item, index) => {
    requireString(
      item,
      `keyTakeaways[${index}]`
    );
  });

  /*
   * MCQs
   */

  if (!Array.isArray(content.mcqs)) {
    fail("mcqs must be an array.");
  }

  if (content.mcqs.length !== 5) {
    fail(
      `mcqs must contain exactly 5 questions. Found ${content.mcqs.length}.`
    );
  }

  content.mcqs.forEach((mcq, index) => {
    if (!mcq || typeof mcq !== "object") {
      fail(`mcqs[${index}] must be an object.`);
    }

    requireString(
      mcq.question,
      `mcqs[${index}].question`
    );

    if (!Array.isArray(mcq.options)) {
      fail(
        `mcqs[${index}].options must be an array.`
      );
    }

    if (mcq.options.length !== 4) {
      fail(
        `mcqs[${index}] must contain exactly 4 options.`
      );
    }

    const normalizedOptions = mcq.options.map(
      (option, optionIndex) => {
        requireString(
          option,
          `mcqs[${index}].options[${optionIndex}]`
        );

        return option.trim().toLowerCase();
      }
    );

    if (
      new Set(normalizedOptions).size !==
      normalizedOptions.length
    ) {
      fail(
        `mcqs[${index}] contains duplicate options.`
      );
    }

    if (
      !Number.isInteger(mcq.answer) ||
      mcq.answer < 0 ||
      mcq.answer > 3
    ) {
      fail(
        `mcqs[${index}].answer must be an integer from 0 to 3.`
      );
    }

    requireString(
      mcq.explanation,
      `mcqs[${index}].explanation`
    );
  });

  /*
   * AI Update
   *
   * It may be disabled when no verified news
   * is supplied.
   */

  if (
    !content.aiUpdate ||
    typeof content.aiUpdate !== "object"
  ) {
    fail("aiUpdate must be an object.");
  }

  if (typeof content.aiUpdate.enabled !== "boolean") {
    fail("aiUpdate.enabled must be boolean.");
  }

  requireString(
    content.aiUpdate.title,
    "aiUpdate.title"
  );

  if (!Array.isArray(content.aiUpdate.items)) {
    fail("aiUpdate.items must be an array.");
  }

  if (!content.aiUpdate.enabled) {
    if (content.aiUpdate.items.length !== 0) {
      fail(
        "aiUpdate is disabled, therefore items must be empty."
      );
    }
  }

  /*
   * Final validation
   */

  return {
    valid: true,
    day: Number(expectedDay),
    mcqCount: content.mcqs.length,
    sectionCount: content.sections.length
  };
}
