import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui";
import { DictionaryBrowser } from "@/components/dictionary";
import { getCategories, getLessons } from "@/data";

export default async function DictionaryPage() {
  const categories = await getCategories();
  const words = await getLessons();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 lg:p-8 border border-[#E2E8F0] space-y-2.5 shadow-2xs">
          <Badge variant="default">
            พจนานุกรม
          </Badge>
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0F172A]">
              พจนานุกรมภาษามือไทย
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              ค้นหาคำศัพท์และดูรูปแบบท่าทาง
            </p>
          </div>
        </div>

        {/* Dynamic Dictionary Browser Component with Search & Storage Sync */}
        <DictionaryBrowser
          initialCategories={categories}
          initialWords={words}
        />
      </div>
    </AppLayout>
  );
}
