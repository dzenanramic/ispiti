import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type QuestionType = "tf" | "single" | "cloze" | "cloze_multi" | "matching";
/**
 * `tf` → boolean; `single`/`cloze` → indeks opcije; `cloze_multi` → indeks iz
 * zajedničke banke za svaku prazninu, redom kojim se praznine pojavljuju;
 * `matching` → tačan odgovor se izvodi iz `pairs` (par i je par sa istim
 * indeksom), pa je `correct` za taj tip `true`.
 */
export type CorrectValue = boolean | number | number[];
/** Odgovor učenika: boolean, indeks opcije ili niz indeksa (po praznini/paru). */
export type AnswerValue = boolean | number | number[];
/** Par za povezivanje. */
export type QuestionPair = { left: string; right: string };

export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("teacher"), // teacher | admin
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  schoolYear: text("school_year").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("students_class_idx").on(table.classId)],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    // Kviz se priprema za tačno jedno odjeljenje. Nije ograničenje za
    // historijske sesije (one nose svoj class_id), ali sprečava da se isti
    // test slučajno pokrene u drugom razredu.
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    lesson: text("lesson").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quizzes_teacher_idx").on(table.teacherId),
    index("quizzes_class_idx").on(table.classId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    type: text("type").$type<QuestionType>().notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    correct: jsonb("correct").$type<CorrectValue>().notNull(),
    /** Samo za tip `matching`; kod ostalih tipova prazan niz. */
    pairs: jsonb("pairs").$type<QuestionPair[]>().notNull().default([]),
    points: integer("points").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("questions_quiz_idx").on(table.quizId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    status: text("status").notNull().default("lobby"), // lobby | active | closed
    joinLocked: boolean("join_locked").notNull().default(false),
    durationSeconds: integer("duration_seconds").notNull().default(300),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_class_idx").on(table.classId),
    index("sessions_teacher_idx").on(table.teacherId),
  ],
);

/**
 * Trajna veza učenika i uređaja za jedno odjeljenje. Za razliku od
 * `attempts.device_token` (koji važi samo za jednu sesiju), ovo sprečava da
 * učenik u sljedećem testu izabere drugo ime. Nastavnik može osloboditi
 * uređaj iz konzole testa kad učenik promijeni telefon ili pogriješi.
 */
export const studentDevices = pgTable(
  "student_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    deviceToken: text("device_token").notNull(),
    /**
     * Zadnja IP adresa s koje se uređaj prijavio. Služi samo za provjeru kod
     * nastavnika — nije ključ identiteta jer su u školi uređaji često iza
     * istog NAT-a, a DHCP/VPN mijenja adresu.
     */
    lastIpAddress: text("last_ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("student_devices_class_device_idx").on(table.classId, table.deviceToken),
    uniqueIndex("student_devices_class_student_idx").on(table.classId, table.studentId),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    deviceToken: text("device_token").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("joined"), // joined | submitted
    score: integer("score").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /**
     * Kad je učenik zadnji put sakrio stranicu tokom aktivnog testa (home,
     * app switcher, zaključan ekran…). Test se predaje tek kad se vrati.
     */
    leftAt: timestamp("left_at", { withTimezone: true }),
    leaveCount: integer("leave_count").notNull().default(0),
    /** student | time | left | closed | manual */
    submitReason: text("submit_reason"),
  },
  (table) => [
    uniqueIndex("attempts_session_student_idx").on(table.sessionId, table.studentId),
    uniqueIndex("attempts_session_device_idx").on(table.sessionId, table.deviceToken),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<AnswerValue>().notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    /**
     * Bodovi za ovo pitanje. Kod većine tipova je 0 ili `points` pitanja, a kod
     * povezivanja po jedan bod za svaki tačno spojen par.
     */
    earnedPoints: integer("earned_points").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("answers_attempt_question_idx").on(table.attemptId, table.questionId),
  ],
);

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    value: integer("value").notNull(),
    note: text("note").notNull().default(""),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("grades_student_idx").on(table.studentId)],
);
