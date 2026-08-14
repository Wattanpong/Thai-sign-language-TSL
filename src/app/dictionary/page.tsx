import { AppLayout } from "@/components/layout";
import {
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from "@/components/ui";
import { getCategories, getLessons } from "@/data";

export default async function DictionaryPage() {
  const categories = await getCategories();
  const words = await getLessons();

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <Badge variant="tag">
            คลังคำศัพท์ภาษามือไทย
          </Badge>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
              พจนานุกรมภาษามือไทย
            </h1>
            <p className="text-sm text-[#64748B]">
              ค้นหาและสืบค้นคำศัพท์ภาษามือไทยตามหมวดหมู่เพื่อดูคำอธิบายและลักษณะท่าทาง
            </p>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="space-y-4">
          <div className="max-w-xl">
            <Input
              type="search"
              placeholder="ค้นหาคำศัพท์ เช่น ก, สวัสดี..."
              helperText="ค้นหาจากคำศัพท์ภาษาไทยหรือหมวดหมู่"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F172A] text-white">
              ทั้งหมด ({words.length})
            </span>
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
              >
                {cat.name}
              </span>
            ))}
          </div>
        </div>

        {/* Word Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {words.map((item) => (
            <Card
              key={item.id}
              className="hover:border-[#FFB400] transition-all shadow-xs hover:shadow-sm"
            >
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant={
                      item.gestureType === "dynamic" ? "primary" : "outline"
                    }
                  >
                    {item.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง" : "ท่าทางคงที่"}
                  </Badge>
                  <span className="text-xs text-[#64748B] font-medium">
                    {getCategoryName(item.categoryId)}
                  </span>
                </div>
                <CardTitle className="text-lg text-[#0F172A]">
                  {item.word}
                </CardTitle>
                <CardDescription className="mt-1">
                  {item.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
