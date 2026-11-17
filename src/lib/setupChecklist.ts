import type { AcademicYearTerms, SchoolLists, Topic } from "../types";
import { OTHER_TOPIC_ID } from "./topicBlocks";

/** Review Center tabs the checklist links to. */
export type SetupTab = "school" | "topics" | "calendar";

export interface SetupStep {
  key: "school" | "categories" | "topics" | "calendar";
  title: string;
  /** Why this step matters, in plain words. */
  why: string;
  done: boolean;
  /** What is there now, or what is missing. */
  status: string;
  tab: SetupTab;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The admin's setup steps on a clean system, in the order they are needed. Each step is checked
 * from the saved data; nothing is ticked by hand and nothing is written.
 */
export function setupSteps(
  lists: SchoolLists | null,
  topics: Topic[],
  calendar: AcademicYearTerms[],
  now: number = Date.now()
): SetupStep[] {
  // 1. School list: sign-up needs a program with a code and at least one section.
  const departments = (lists?.departments || []).filter((d) => !d.retired);
  const programs = departments.flatMap((d) => d.programs.filter((p) => !p.retired));
  const sectionCount = (p: (typeof programs)[number]) =>
    Object.entries(p.sections || {})
      .filter(([year]) => Number(year) <= p.yearLevels)
      .reduce((s, [, letters]) => s + letters.length, 0);
  const sections = programs.reduce((s, p) => s + sectionCount(p), 0);
  const ready = programs.some((p) => p.code && sectionCount(p) > 0);
  const schoolStatus =
    departments.length === 0
      ? "Nothing added yet. Until then, sign-up says registration is not open."
      : programs.length === 0
        ? `${plural(departments.length, "department")}, but no programs yet.`
        : !ready
          ? `${plural(departments.length, "department")}, ${plural(programs.length, "program")}, but no sections yet. Students need a section to sign up.`
          : `${plural(departments.length, "department")}, ${plural(programs.length, "program")}, ${plural(sections, "section")}.`;

  // 2. Categories: done once the admin has saved their own list (until then the built-in one is used).
  const savedCategories = lists?.categories;
  const activeCategories = (savedCategories || []).filter((c) => !c.retired);
  const categoriesDone = !!savedCategories && activeCategories.length > 0;
  const categoriesStatus = categoriesDone
    ? `${plural(activeCategories.length, "category")} in use.`
    : "Still using the built-in categories. Review them and press Save in School Setup.";

  // 3. Topics: at least one active topic besides the fixed "Other".
  const ownTopics = topics.filter((t) => t.id !== OTHER_TOPIC_ID && t.status === "active");
  const topicsStatus =
    ownTopics.length > 0
      ? `${plural(ownTopics.length, "topic")} (plus "Other").`
      : 'Only "Other" so far. Add the topics creators will group their questions under.';

  // 4. Calendar: a school year that includes today or is still to come.
  const current = calendar.find((y) => y.sem2End >= now);
  const calendarStatus = current
    ? `School year ${current.schoolYear} is entered.`
    : calendar.length > 0
      ? "Only past school years are entered. Add the current school year."
      : "No school year entered. Semesters in Analytics need it.";

  return [
    {
      key: "school",
      title: "Departments, programs and sections",
      why: "People pick these when they sign up.",
      done: ready,
      status: schoolStatus,
      tab: "school",
    },
    {
      key: "categories",
      title: "Survey categories",
      why: "Creators choose one for each survey.",
      done: categoriesDone,
      status: categoriesStatus,
      tab: "school",
    },
    {
      key: "topics",
      title: "Survey topics",
      why: "Questions are grouped under topics for Analytics.",
      done: ownTopics.length > 0,
      status: topicsStatus,
      tab: "topics",
    },
    {
      key: "calendar",
      title: "Academic calendar",
      why: "Responses are sorted into school years and semesters.",
      done: !!current,
      status: calendarStatus,
      tab: "calendar",
    },
  ];
}
