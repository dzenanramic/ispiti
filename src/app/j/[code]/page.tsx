import { StudentApp } from "./StudentApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <StudentApp code={code.toUpperCase()} />;
}
