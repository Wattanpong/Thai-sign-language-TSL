import { getLessonById } from "@/data";
import { AdminLessonReferenceContainer } from "@/components/admin";

interface ReferencePageProps {
  params: Promise<{
    lessonId: string;
  }>;
}

export default async function AdminLessonReferencePage({
  params,
}: ReferencePageProps) {
  const { lessonId: rawLessonId } = await params;
  let lessonId = rawLessonId || "";
  try {
    lessonId = decodeURIComponent(rawLessonId);
  } catch {
    // fallback to raw
  }

  const lesson = await getLessonById(lessonId);

  return (
    <AdminLessonReferenceContainer
      lessonId={lessonId}
      initialLesson={lesson}
    />
  );
}

