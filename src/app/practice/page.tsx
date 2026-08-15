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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <PracticeSessionManager

          categories={categories}
          lessons={lessons}
          initialLessonId="hello"
        />
      </div>
    </AppLayout>
  );
}
