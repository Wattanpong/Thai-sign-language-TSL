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
  const { lessonId } = await params;
  const lesson = await getLessonById(lessonId);

  return (
    <AdminLessonReferenceContainer
      lessonId={lessonId}
      initialLesson={lesson}
    />
  );
}

