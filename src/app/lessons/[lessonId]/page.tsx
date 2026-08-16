import { AppLayout } from "@/components/layout";
import { LessonDetailView } from "@/components/lessons";
import { getLessonById, getCategoryById } from "@/data";

interface LessonDetailPageProps {
  params: Promise<{
    lessonId: string;
  }>;
}

export default async function LessonDetailPage({
  params,
}: LessonDetailPageProps) {
  const { lessonId: rawLessonId } = await params;
  let lessonId = rawLessonId || "";
  try {
    lessonId = decodeURIComponent(rawLessonId);
  } catch {
    // fallback to raw
  }

  const initialLesson = await getLessonById(lessonId);
  const initialCategory = initialLesson ? await getCategoryById(initialLesson.categoryId) : null;

  return (
    <AppLayout>
      <LessonDetailView
        lessonId={lessonId}
        initialLesson={initialLesson}
        initialCategory={initialCategory}
      />
    </AppLayout>
  );
}
