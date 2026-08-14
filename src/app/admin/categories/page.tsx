import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { getCategories } from "@/data";

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <PageHeader
        badge="จัดการข้อมูล"
        title="หมวดคำศัพท์ (Categories)"
        description="รายการหมวดหมู่คำศัพท์ภาษามือไทยในระบบ"
        action={
          <Button size="sm" variant="amber" className="font-semibold shadow-xs">
            + เพิ่มหมวดหมู่ใหม่
          </Button>
        }
      />

      <Card className="bg-white border border-[#E2E8F0] shadow-xs">
        <CardHeader>
          <CardTitle className="text-base text-[#0F172A]">รายการหมวดหมู่ทั้งหมด</CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            โครงสร้างหมวดหมู่เพื่อจัดกลุ่มคำศัพท์และบทเรียน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[#E2E8F0]">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0F172A]">
                      {cat.name}
                    </span>
                    <Badge variant="outline">ลำดับ {cat.order}</Badge>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-[#64748B]">{cat.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[#0F172A] hover:bg-[#F1F5F9]">
                    แก้ไข
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
