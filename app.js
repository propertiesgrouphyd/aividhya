(() => {
  "use strict";

  /* =========================================================
     VIDHWAAN AIVidhya
     365-Day AI Learning Frontend
     ========================================================= */

  const COURSE = Object.freeze({
    totalDays: 365,
    startDate: "2026-08-20",
    publishHour: 6,
    timezone: "Asia/Kolkata",
    dataPath: "./data/"
  });

  const state = {
    selectedDay: null,
    selectedLesson: null
  };

  const el = {
    dayGrid: document.getElementById("dayGrid"),
    todayLabel: document.getElementById("todayLabel"),
    dayNavigator: document.getElementById("dayNavigator"),
    lessonView: document.getElementById("lessonView"),
    lessonContainer: document.getElementById("lessonContainer"),
    backButton: document.getElementById("backButton"),
    statusView: document.getElementById("statusView"),
    statusTitle: document.getElementById("statusTitle"),
    statusMessage: document.getElementById("statusMessage"),
    statusBackButton: document.getElementById("statusBackButton")
  };

  /* =========================================================
     DATE ENGINE
     ========================================================= */

  function getISTNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: COURSE.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second)
    };
  }

  function dateOnlyToUTC(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(
      Date.UTC(year, month - 1, day)
    );
  }

  function getCourseDate(dayNumber) {
    const date = dateOnlyToUTC(COURSE.startDate);

    date.setUTCDate(
      date.getUTCDate() + dayNumber - 1
    );

    return date.toISOString().slice(0, 10);
  }

  function getPublishDate(dayNumber) {
    const date = getCourseDate(dayNumber);

    return `${date}T06:00:00+05:30`;
  }

  function isDayUnlocked(dayNumber) {
    const courseDate = getCourseDate(dayNumber);
    const now = getISTNow();

    const today =
      `${now.year.toString().padStart(4, "0")}-` +
      `${now.month.toString().padStart(2, "0")}-` +
      `${now.day.toString().padStart(2, "0")}`;

    if (courseDate < today) {
      return true;
    }

    if (courseDate > today) {
      return false;
    }

    return now.hour >= COURSE.publishHour;
  }

  function getLatestUnlockedDay() {
    let latest = 0;

    for (let day = 1; day <= COURSE.totalDays; day++) {
      if (isDayUnlocked(day)) {
        latest = day;
      } else {
        break;
      }
    }

    return latest;
  }

  function formatCourseDate(dateString) {
    const date = dateOnlyToUTC(dateString);

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatTodayLabel() {
    const now = getISTNow();

    const date = new Date(
      Date.UTC(
        now.year,
        now.month - 1,
        now.day
      )
    );

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  /* =========================================================
     HTML SAFETY
     ========================================================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function textToHTML(value) {
    return escapeHTML(value)
      .replace(/\n\n+/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function showNavigator() {
    state.selectedDay = null;
    state.selectedLesson = null;

    el.lessonView.hidden = true;
    el.statusView.hidden = true;
    el.dayNavigator.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showLessonView() {
    el.dayNavigator.hidden = true;
    el.statusView.hidden = true;
    el.lessonView.hidden = false;
  }

  function showStatus(title, message) {
    el.dayNavigator.hidden = true;
    el.lessonView.hidden = true;
    el.statusView.hidden = false;

    el.statusTitle.textContent = title;
    el.statusMessage.textContent = message;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* =========================================================
     DAY NAVIGATOR
     ========================================================= */

  function renderDayGrid() {
    const latestDay = getLatestUnlockedDay();

    el.dayGrid.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (let day = 1; day <= COURSE.totalDays; day++) {
      const unlocked = day <= latestDay;

      const button = document.createElement("button");

      button.type = "button";
      button.className = "day-circle";

      button.dataset.day = String(day);
      button.setAttribute(
        "aria-label",
        unlocked
          ? `Day ${day}`
          : `Day ${day} — locked`
      );

      if (unlocked) {
        button.classList.add("available");

        if (day === latestDay) {
          button.classList.add("latest");
        }

        button.addEventListener(
          "click",
          () => openLesson(day)
        );
      } else {
        button.classList.add("locked");
        button.disabled = true;
      }

      const number = document.createElement("span");

      number.className = "day-number";
      number.textContent = String(day);

      button.appendChild(number);
      fragment.appendChild(button);
    }

    el.dayGrid.appendChild(fragment);

    updateTodayLabel(latestDay);
  }

  function updateTodayLabel(latestDay) {
    const now = getISTNow();

    const today = formatTodayLabel();

    if (latestDay === 0) {
      el.todayLabel.innerHTML = `
        <span class="today-label-main">
          ${escapeHTML(today)}
        </span>
        <span class="today-label-sub">
          Day 1 opens at 6:00 AM
        </span>
      `;

      return;
    }

    const courseDate = getCourseDate(latestDay);

    if (
      courseDate ===
      `${now.year.toString().padStart(4, "0")}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`
    ) {
      el.todayLabel.innerHTML = `
        <span class="today-label-main">
          ${escapeHTML(today)}
        </span>
        <span class="today-label-sub">
          Day ${latestDay} is available
        </span>
      `;
    } else {
      el.todayLabel.innerHTML = `
        <span class="today-label-main">
          ${escapeHTML(today)}
        </span>
        <span class="today-label-sub">
          Up to Day ${latestDay} available
        </span>
      `;
    }
  }

  /* =========================================================
     LESSON LOADING
     ========================================================= */

  async function openLesson(dayNumber) {
    if (!Number.isInteger(dayNumber)) {
      return;
    }

    if (
      dayNumber < 1 ||
      dayNumber > COURSE.totalDays
    ) {
      return;
    }

    if (!isDayUnlocked(dayNumber)) {
      showStatus(
        "పాఠం ఇంకా అందుబాటులో లేదు",
        "ఈ రోజు పాఠం ఉదయం 6:00 గంటలకు అందుబాటులోకి వస్తుంది."
      );

      return;
    }

    state.selectedDay = dayNumber;

    showLessonView();

    el.lessonContainer.innerHTML = `
      <div class="lesson-loading">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>పాఠం లోడ్ అవుతోంది...</p>
      </div>
    `;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    try {
      const response = await fetch(
        `${COURSE.dataPath}day-${String(dayNumber).padStart(3, "0")}.json`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Lesson file returned HTTP ${response.status}`
        );
      }

      const lesson = await response.json();

      validateLessonIdentity(
        lesson,
        dayNumber
      );

      state.selectedLesson = lesson;

      renderLesson(lesson);

      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });

    } catch (error) {
      console.error(error);

      showStatus(
        "పాఠం అందుబాటులో లేదు",
        `Day ${dayNumber} కోసం పాఠం ఫైల్ ప్రస్తుతం అందుబాటులో లేదు.`
      );
    }
  }

  function validateLessonIdentity(
    lesson,
    requestedDay
  ) {
    if (!lesson || typeof lesson !== "object") {
      throw new Error("Invalid lesson JSON.");
    }

    if (
      Number(lesson.day) !==
      Number(requestedDay)
    ) {
      throw new Error(
        "Lesson day does not match requested day."
      );
    }

    if (
      typeof lesson.title !== "string" ||
      !lesson.title.trim()
    ) {
      throw new Error(
        "Lesson title is missing."
      );
    }
  }

  /* =========================================================
     LESSON RENDERER
     ========================================================= */

  function renderLesson(lesson) {
    const sections = Array.isArray(lesson.sections)
      ? lesson.sections
      : [];

    const takeaways = Array.isArray(
      lesson.keyTakeaways
    )
      ? lesson.keyTakeaways
      : [];

    const mcqs = Array.isArray(lesson.mcqs)
      ? lesson.mcqs
      : [];

    const aiUpdate =
      lesson.aiUpdate &&
      lesson.aiUpdate.enabled === true
        ? lesson.aiUpdate
        : null;

    el.lessonContainer.innerHTML = `
      <article class="lesson-article">

        <div class="lesson-hero">

          <div class="lesson-day-badge">
            DAY ${escapeHTML(lesson.day)}
          </div>

          <h1>
            ${escapeHTML(lesson.title)}
          </h1>

          <div class="lesson-date">
            ${escapeHTML(
              formatCourseDate(lesson.courseDate)
            )}
            · 6:00 AM
          </div>

          ${
            lesson.introduction
              ? `
                <div class="lesson-introduction">
                  ${textToHTML(lesson.introduction)}
                </div>
              `
              : ""
          }

        </div>

        <div class="lesson-body">

          ${sections
            .map(renderSection)
            .join("")}

          ${
            aiUpdate
              ? renderAIUpdate(aiUpdate)
              : ""
          }

          ${
            lesson.practice
              ? renderPractice(lesson.practice)
              : ""
          }

          ${
            takeaways.length
              ? renderTakeaways(takeaways)
              : ""
          }

          ${
            mcqs.length
              ? renderMCQs(mcqs)
              : ""
          }

        </div>

      </article>
    `;

    attachMCQHandlers();
  }

  function renderSection(section, index) {
    if (!section) {
      return "";
    }

    const paragraphs =
      Array.isArray(section.paragraphs)
        ? section.paragraphs
        : [];

    const example = section.example;

    return `
      <section class="lesson-section">

        <div class="section-number">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="section-content">

          <h2>
            ${escapeHTML(section.heading || "")}
          </h2>

          ${
            section.subheading
              ? `
                <div class="section-subheading">
                  ${escapeHTML(
                    section.subheading
                  )}
                </div>
              `
              : ""
          }

          <div class="section-paragraphs">
            ${paragraphs
              .map(
                paragraph =>
                  `<p>${textToHTML(paragraph)}</p>`
              )
              .join("")}
          </div>

          ${
            example
              ? `
                <div class="example-card">

                  <div class="example-label">
                    REAL-WORLD EXAMPLE
                  </div>

                  <h3>
                    ${escapeHTML(
                      example.title || "Example"
                    )}
                  </h3>

                  <p>
                    ${textToHTML(
                      example.content || ""
                    )}
                  </p>

                </div>
              `
              : ""
          }

        </div>

      </section>
    `;
  }

  function renderAIUpdate(aiUpdate) {
    const items = Array.isArray(
      aiUpdate.items
    )
      ? aiUpdate.items
      : [];

    if (!items.length) {
      return "";
    }

    return `
      <section class="ai-update-card">

        <div class="ai-update-label">
          AI UPDATE
        </div>

        <h2>
          ${escapeHTML(
            aiUpdate.title || "AI Update"
          )}
        </h2>

        <div class="ai-update-items">
          ${items
            .map(
              item => `
                <div class="ai-update-item">
                  ${textToHTML(item)}
                </div>
              `
            )
            .join("")}
        </div>

      </section>
    `;
  }

  function renderPractice(practice) {
    return `
      <section class="practice-card">

        <div class="practice-label">
          TRY IT YOURSELF
        </div>

        <h2>
          ${escapeHTML(
            practice.title || "Practice"
          )}
        </h2>

        <p>
          ${textToHTML(
            practice.instruction || ""
          )}
        </p>

      </section>
    `;
  }

  function renderTakeaways(takeaways) {
    return `
      <section class="takeaways-card">

        <div class="takeaways-label">
          KEY TAKEAWAYS
        </div>

        <h2>ఈ రోజు గుర్తుంచుకోవాల్సినవి</h2>

        <ul>
          ${takeaways
            .map(
              item => `
                <li>
                  <span class="takeaway-check">
                    ✓
                  </span>
                  <span>
                    ${textToHTML(item)}
                  </span>
                </li>
              `
            )
            .join("")}
        </ul>

      </section>
    `;
  }

  /* =========================================================
     MCQ RENDERER
     ========================================================= */

  function renderMCQs(mcqs) {
    return `
      <section class="mcq-section">

        <div class="mcq-header">

          <div class="mcq-label">
            PRACTICE
          </div>

          <h2>
            మీ అవగాహనను పరీక్షించుకోండి
          </h2>

          <p>
            సరైన సమాధానాన్ని ఎంచుకోండి.
            తప్పు సమాధానం ఎరుపుగా,
            సరైన సమాధానం ఆకుపచ్చగా కనిపిస్తుంది.
          </p>

        </div>

        <div class="mcq-list">

          ${mcqs
            .map(
              (mcq, questionIndex) =>
                renderMCQ(
                  mcq,
                  questionIndex
                )
            )
            .join("")}

        </div>

      </section>
    `;
  }

  function renderMCQ(mcq, questionIndex) {
    const options = Array.isArray(
      mcq.options
    )
      ? mcq.options
      : [];

    return `
      <article
        class="mcq-card"
        data-question="${questionIndex}"
        data-answer="${Number(
          mcq.answer
        )}"
      >

        <div class="mcq-number">
          QUESTION ${questionIndex + 1}
        </div>

        <h3 class="mcq-question">
          ${escapeHTML(
            mcq.question || ""
          )}
        </h3>

        <div class="mcq-options">

          ${options
            .map(
              (option, optionIndex) => `
                <button
                  type="button"
                  class="mcq-option"
                  data-option="${optionIndex}"
                >

                  <span class="option-letter">
                    ${String.fromCharCode(
                      65 + optionIndex
                    )}
                  </span>

                  <span class="option-text">
                    ${escapeHTML(option)}
                  </span>

                </button>
              `
            )
            .join("")}

        </div>

        <div
          class="mcq-feedback"
          aria-live="polite"
        ></div>

      </article>
    `;
  }

  function attachMCQHandlers() {
    const cards =
      el.lessonContainer.querySelectorAll(
        ".mcq-card"
      );

    cards.forEach(card => {
      const options =
        card.querySelectorAll(
          ".mcq-option"
        );

      options.forEach(button => {
        button.addEventListener(
          "click",
          () => handleMCQAnswer(
            card,
            button
          )
        );
      });
    });
  }

  function handleMCQAnswer(
    card,
    selectedButton
  ) {
    if (
      card.classList.contains(
        "answered"
      )
    ) {
      return;
    }

    const selected =
      Number(
        selectedButton.dataset.option
      );

    const correct =
      Number(
        card.dataset.answer
      );

    const allOptions =
      card.querySelectorAll(
        ".mcq-option"
      );

    const feedback =
      card.querySelector(
        ".mcq-feedback"
      );

    const lesson =
      state.selectedLesson;

    const questionIndex =
      Number(
        card.dataset.question
      );

    const question =
      lesson?.mcqs?.[questionIndex];

    card.classList.add("answered");

    allOptions.forEach(
      button => {
        button.disabled = true;
      }
    );

    if (selected === correct) {
      selectedButton.classList.add(
        "correct"
      );

      card.classList.add(
        "answer-correct"
      );

      feedback.innerHTML = `
        <div class="feedback-title">
          ✓ సరైన సమాధానం
        </div>

        ${
          question?.explanation
            ? `
              <div class="feedback-explanation">
                ${textToHTML(
                  question.explanation
                )}
              </div>
            `
            : ""
        }
      `;

      return;
    }

    selectedButton.classList.add(
      "wrong"
    );

    card.classList.add(
      "answer-wrong"
    );

    const correctButton =
      card.querySelector(
        `.mcq-option[data-option="${correct}"]`
      );

    if (correctButton) {
      correctButton.classList.add(
        "correct"
      );
    }

    feedback.innerHTML = `
      <div class="feedback-title">
        ✕ ఇది సరైన సమాధానం కాదు
      </div>

      <div class="feedback-correct">
        ✓ సరైన సమాధానం:
        ${
          correctButton
            ? escapeHTML(
                correctButton
                  .querySelector(
                    ".option-text"
                  )
                  ?.textContent || ""
              )
            : ""
        }
      </div>

      ${
        question?.explanation
          ? `
            <div class="feedback-explanation">
              ${textToHTML(
                question.explanation
              )}
            </div>
          `
          : ""
      }
    `;
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function bindEvents() {
    if (el.backButton) {
      el.backButton.addEventListener(
        "click",
        showNavigator
      );
    }

    if (el.statusBackButton) {
      el.statusBackButton.addEventListener(
        "click",
        showNavigator
      );
    }

    window.addEventListener(
      "popstate",
      () => {
        showNavigator();
      }
    );
  }

  /* =========================================================
     STARTUP
     ========================================================= */

  function init() {
    if (
      !el.dayGrid ||
      !el.lessonView ||
      !el.lessonContainer
    ) {
      console.error(
        "VIDHWAAN AIVidhya: required DOM elements are missing."
      );

      return;
    }

    bindEvents();

    renderDayGrid();

    el.lessonView.hidden = true;
    el.statusView.hidden = true;
    el.dayNavigator.hidden = false;

    console.log(
      "=============================================="
    );
    console.log(
      " VIDHWAAN AIVidhya — FRONTEND READY"
    );
    console.log(
      "=============================================="
    );
    console.log(
      `Course start : ${COURSE.startDate}`
    );
    console.log(
      `Total days   : ${COURSE.totalDays}`
    );
    console.log(
      `Latest day   : ${getLatestUnlockedDay()}`
    );
    console.log(
      "Unlock time  : 06:00 Asia/Kolkata"
    );
    console.log(
      "=============================================="
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();


/* =========================================================
   VIDHWAAN AIVidhya — NATIVE PWA INSTALL
   ========================================================= */

(() => {
  let deferredInstallPrompt = null;

  const installButton =
    document.getElementById("pwaInstallButton");

  if (!installButton) {
    return;
  }


  /*
   * Chrome / Edge / Android:
   * Browser provides the native install prompt.
   */

  window.addEventListener(
    "beforeinstallprompt",
    event => {

      event.preventDefault();

      deferredInstallPrompt = event;

      installButton.hidden = false;
    }
  );


  /*
   * User taps Install.
   */

  installButton.addEventListener(
    "click",
    async () => {

      if (!deferredInstallPrompt) {
        return;
      }

      const promptEvent =
        deferredInstallPrompt;

      deferredInstallPrompt = null;

      installButton.hidden = true;

      try {

        await promptEvent.prompt();

        const result =
          await promptEvent.userChoice;

        if (
          result &&
          result.outcome === "accepted"
        ) {
          console.log(
            "VIDHWAAN AIVidhya installed."
          );
        }

      } catch (error) {

        console.error(
          "PWA installation failed:",
          error
        );

      }
    }
  );


  /*
   * Installation completed through the browser.
   */

  window.addEventListener(
    "appinstalled",
    () => {

      deferredInstallPrompt = null;

      installButton.hidden = true;

      console.log(
        "VIDHWAAN AIVidhya PWA installation complete."
      );
    }
  );


  /*
   * If already running as an installed PWA,
   * never show the browser install control.
   */

  const isStandalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    installButton.hidden = true;
  }

})();
