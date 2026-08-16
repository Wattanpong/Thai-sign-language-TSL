import { AppLayout } from "@/components/layout";
import { PracticeSessionManager } from "@/components/practice";
import { getCategories, getLessons } from "@/data";

export default async function PracticePage() {
  const [categories, lessons] = await Promise.all([
    getCategories(),
    getLessons(),
  ]);

  return (
    <AppLayout>
      <div className="max-w-[1680px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5">
        <PracticeSessionManager
          categories={categories}
          lessons={lessons}
          initialLessonId="hello"
        />
      </div>
    </AppLayout>
  );
}
