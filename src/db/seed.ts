import { config } from "dotenv";
import { randomUUID } from "node:crypto";

config({ path: ".env.local" });
config();

import { eq } from "drizzle-orm";

async function main() {
  const { db, client } = await import("./index");
  const schema = await import("./schema");
  const { hashPassword } = await import("../lib/auth");
  const { currentSchoolYear } = await import("../lib/format");

  const reset = process.argv.includes("--reset");

  if (reset) {
    console.log("Brišem postojeće podatke…");
    await db.delete(schema.answers);
    await db.delete(schema.attempts);
    await db.delete(schema.sessions);
    await db.delete(schema.grades);
    await db.delete(schema.questions);
    await db.delete(schema.quizzes);
    await db.delete(schema.students);
    await db.delete(schema.classes);
    await db.delete(schema.teachers);
  } else {
    const existing = await db
      .select({ id: schema.teachers.id })
      .from(schema.teachers)
      .limit(1);
    if (existing.length > 0) {
      console.log("Baza već ima podatke. Pokreni sa --reset da je obrišeš i ponovo napuniš.");
      await client.end();
      return;
    }
  }

  const schoolYear = currentSchoolYear();

  const [admin] = await db
    .insert(schema.teachers)
    .values({
      email: "admin@ispiti.local",
      passwordHash: await hashPassword("admin123"),
      name: "Administrator",
      role: "admin",
    })
    .returning();

  const [teacher] = await db
    .insert(schema.teachers)
    .values({
      email: "profesor@ispiti.local",
      passwordHash: await hashPassword("profesor123"),
      name: "Prof. Ajdin Crnkić",
      role: "teacher",
    })
    .returning();

  const [class3] = await db
    .insert(schema.classes)
    .values({ teacherId: teacher.id, name: "3. razred", schoolYear })
    .returning();

  const [class4] = await db
    .insert(schema.classes)
    .values({ teacherId: teacher.id, name: "4. razred", schoolYear })
    .returning();

  const names3 = [
    "Amina Begić",
    "Tarik Čengić",
    "Lejla Dedić",
    "Hamza Fazlić",
    "Ema Ganić",
    "Adnan Hodžić",
    "Sara Ibrahimović",
    "Kenan Jusufović",
    "Merjem Kadić",
    "Faruk Ljeljak",
    "Nejra Mehmedović",
    "Emir Nuhanović",
    "Ajla Osmanović",
    "Benjamin Pašić",
    "Džejla Salihović",
    "Haris Šabanović",
    "Lamija Topić",
    "Muhamed Vuković",
    "Hana Zukić",
    "Jusuf Žunić",
  ];

  const names4 = [
    "Aida Alispahić",
    "Bakir Brkić",
    "Dina Ćosić",
    "Ehlimana Delić",
    "Faris Đulović",
    "Hajra Halilović",
    "Iman Isaković",
    "Kemal Karić",
    "Maida Kovačević",
    "Nedim Mahmutović",
    "Omer Mujić",
    "Rabija Nurkić",
    "Samir Omerović",
    "Tajra Pirija",
    "Una Ramić",
    "Vedad Softić",
    "Zerina Šehović",
    "Adna Tufekčić",
    "Bilal Velić",
    "Selma Zahirović",
  ];

  const students3 = await db
    .insert(schema.students)
    .values(names3.map((name) => ({ classId: class3.id, name })))
    .returning();

  const students4 = await db
    .insert(schema.students)
    .values(names4.map((name) => ({ classId: class4.id, name })))
    .returning();

  const [quiz1] = await db
    .insert(schema.quizzes)
    .values({
      teacherId: teacher.id,
      title: "Uvod u hadiske znanosti",
      lesson: "Lekcija 1 — definicija i dijelovi hadisa",
    })
    .returning();

  const quiz1Questions = await db
    .insert(schema.questions)
    .values([
      {
        quizId: quiz1.id,
        position: 0,
        type: "tf",
        prompt: "Hadis je riječ, djelo ili odobrenje Poslanika ﷺ.",
        options: [],
        correct: true,
      },
      {
        quizId: quiz1.id,
        position: 1,
        type: "single",
        prompt: "Koji su osnovni dijelovi hadisa?",
        options: ["Isnad i matn", "Sened i šerh", "Matn i tefsir", "Isnad i fikh"],
        correct: 0,
      },
      {
        quizId: quiz1.id,
        position: 2,
        type: "cloze",
        prompt: "Lanac prenosilaca hadisa naziva se _____.",
        options: ["isnad", "matn", "šerh", "tefsir"],
        correct: 0,
      },
      {
        quizId: quiz1.id,
        position: 3,
        type: "single",
        prompt: "Šta znači arapska riječ «إسناد» (isnād)?",
        options: [
          "Lanac prenosilaca",
          "Tekst hadisa",
          "Tumačenje hadisa",
          "Vrsta hadisa",
        ],
        correct: 0,
      },
      {
        quizId: quiz1.id,
        position: 4,
        type: "cloze",
        prompt: "Koja arapska riječ označava tekst hadisa? _____",
        options: ["متن", "إسناد", "شرح", "تفسير"],
        correct: 0,
      },
    ])
    .returning();

  const [quiz2] = await db
    .insert(schema.quizzes)
    .values({
      teacherId: teacher.id,
      title: "Vrste hadisa prema broju prenosilaca",
      lesson: "Lekcija 2 — mutevatir, ahad i podjele",
    })
    .returning();

  const quiz2Questions = await db
    .insert(schema.questions)
    .values([
      {
        quizId: quiz2.id,
        position: 0,
        type: "single",
        prompt:
          "Hadis koji prenosi veliki broj prenosilaca na svakom nivou naziva se:",
        options: ["mutevatir", "ahad", "sahih", "hasen"],
        correct: 0,
      },
      {
        quizId: quiz2.id,
        position: 1,
        type: "tf",
        prompt: "Ahad hadis prenosi jedan ili mali broj prenosilaca.",
        options: [],
        correct: true,
      },
      {
        quizId: quiz2.id,
        position: 2,
        type: "cloze",
        prompt: "Hadis prekinut na nivou tabi'ina naziva se _____.",
        options: ["mursel", "munqati'", "mudallas", "mawdu'"],
        correct: 0,
      },
      {
        quizId: quiz2.id,
        position: 3,
        type: "single",
        prompt: "Koja vrsta hadisa ima najviši stepen pouzdanosti?",
        options: ["mutevatir", "ahad", "mursel", "mawdu'"],
        correct: 0,
      },
      {
        quizId: quiz2.id,
        position: 4,
        type: "tf",
        prompt: "Mawdu' je izmišljeni hadis.",
        options: [],
        correct: true,
      },
    ])
    .returning();

  const [quiz3] = await db
    .insert(schema.quizzes)
    .values({
      teacherId: teacher.id,
      title: "Ponavljanje — hadiski termini",
      lesson: "Lekcije 1 i 2",
    })
    .returning();

  await db.insert(schema.questions).values([
    {
      quizId: quiz3.id,
      position: 0,
      type: "cloze",
      prompt: "Tekst hadisa naziva se _____.",
      options: ["matn", "isnad", "sened", "šerh"],
      correct: 0,
    },
    {
      quizId: quiz3.id,
      position: 1,
      type: "single",
      prompt: "Ko prenosi hadis od Poslanika ﷺ do tabi'ina?",
      options: ["Sahabija", "Tabi'in", "Tebe-tabi'in", "Imam"],
      correct: 0,
    },
    {
      quizId: quiz3.id,
      position: 2,
      type: "tf",
      prompt: "Sahih hadis je najviši stepen pouzdanosti poslije mutevatira.",
      options: [],
      correct: true,
    },
    {
      quizId: quiz3.id,
      position: 3,
      type: "single",
      prompt: "Šta proučava ilm al-hadis?",
      options: [
        "Prenosioce i tekst hadisa",
        "Samo tekst hadisa",
        "Samo arapsku gramatiku",
        "Tefsir Kur'ana",
      ],
      correct: 0,
    },
    {
      quizId: quiz3.id,
      position: 4,
      type: "tf",
      prompt: "Hadis i sunnet su potpuno isto značenje.",
      options: [],
      correct: false,
    },
  ]);

  // Deterministički „slučajni" rezultati za demo tabelu.
  function seededScore(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  async function seedClosedSession(
    classId: string,
    quizId: string,
    questionsForQuiz: typeof quiz1Questions,
    code: string,
    daysAgo: number,
    studentList: typeof students4,
  ) {
    const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startedAt.getTime() + 5 * 60 * 1000);
    const [session] = await db
      .insert(schema.sessions)
      .values({
        quizId,
        classId,
        teacherId: teacher.id,
        code,
        status: "closed",
        durationSeconds: 300,
        startedAt,
        endsAt,
        closedAt: endsAt,
        createdAt: startedAt,
      })
      .returning();

    for (let index = 0; index < studentList.length; index += 1) {
      const student = studentList[index];
      // Dva učenika su bila odsutna.
      if (index >= studentList.length - 2) continue;

      const [attempt] = await db
        .insert(schema.attempts)
        .values({
          sessionId: session.id,
          studentId: student.id,
          deviceToken: `seed-${session.id}-${student.id}`,
          token: randomUUID(),
          status: "submitted",
          joinedAt: startedAt,
          submittedAt: new Date(startedAt.getTime() + 3 * 60 * 1000),
        })
        .returning();

      let score = 0;
      const answerRows = questionsForQuiz.map((question, qIndex) => {
        const skill = 0.4 + seededScore(index * 10 + qIndex + daysAgo) * 0.55;
        const isCorrect =
          seededScore(index * 97 + qIndex * 13 + daysAgo * 31 + 3) < skill;
        if (isCorrect) score += 1;
        let value: boolean | number;
        if (question.type === "tf") {
          value = isCorrect ? (question.correct as boolean) : !(question.correct as boolean);
        } else {
          const options = question.options as string[];
          const correct = question.correct as number;
          value = isCorrect ? correct : (correct + 1) % Math.max(options.length, 1);
        }
        return {
          attemptId: attempt.id,
          questionId: question.id,
          value,
          isCorrect,
          updatedAt: startedAt,
        };
      });

      await db.insert(schema.answers).values(answerRows);
      await db
        .update(schema.attempts)
        .set({ score })
        .where(eq(schema.attempts.id, attempt.id));
    }
  }

  await seedClosedSession(class4.id, quiz1.id, quiz1Questions, "HADIS1", 7, students4);
  await seedClosedSession(class4.id, quiz2.id, quiz2Questions, "HADIS2", 3, students4);
  await seedClosedSession(class3.id, quiz2.id, quiz2Questions, "HADIS3", 9, students3);

  // Jedna otvorena sesija za testiranje učeničkog toka.
  await db.insert(schema.sessions).values({
    quizId: quiz1.id,
    classId: class3.id,
    teacherId: teacher.id,
    code: "TEST22",
    status: "lobby",
    durationSeconds: 300,
  });

  // Demo ocjene: po dvije ocjene za prvu polovinu 4. razreda.
  for (let index = 0; index < 8; index += 1) {
    const student = students4[index];
    await db.insert(schema.grades).values([
      {
        studentId: student.id,
        classId: class4.id,
        term: "1. polugodište",
        value: 2 + (index % 4),
        note: "Usmeno ispitivanje",
        createdBy: teacher.id,
      },
      {
        studentId: student.id,
        classId: class4.id,
        term: "1. polugodište",
        value: 3 + (index % 3),
        note: "Test 1 i 2",
        createdBy: teacher.id,
      },
    ]);
  }

  console.log("Seed završen.");
  console.log("Admin:    admin@ispiti.local / admin123");
  console.log("Profesor: profesor@ispiti.local / profesor123");
  console.log("Otvorena sesija za test: kod TEST22 (3. razred)");
  console.log(`Admin ID: ${admin.id}`);

  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
