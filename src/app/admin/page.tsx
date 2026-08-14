import Link from "next/link";
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
import { getCategories, getLessons } from "@/data";

export default async function AdminDashboardPage() {
  const categories = await getCategories();
  const lessons = await getLessons();

  return (
    <div className="space-y-8">
      <PageHeader
        badge="ภาพรวมระบบ"
        title="Admin Dashboard"
        description="ศูนย์ควบคุมและจัดการข้อมูลหมวดหมู่ คำศัพท์ และข้อมูลอ้างอิงภาษามือไทย"
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-white border border-[#E2E8F0] shadow-xs">
          <CardHeader>
            <CardDescription className="text-xs text-[#64748B] font-medium">
              หมวดคำศัพท์ทั้งหมด
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-[#0F172A]">{categories.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/admin/categories">
              <Button variant="outline" size="sm" className="w-full font-medium text-[#0F172A]">
                จัดการหมวดหมู่ →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#E2E8F0] shadow-xs">
          <CardHeader>
            <CardDescription className="text-xs text-[#64748B] font-medium">
              คำศัพท์ในระบบ
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-[#0F172A]">{lessons.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/admin/lessons">
              <Button variant="outline" size="sm" className="w-full font-medium text-[#0F172A]">
                จัดการคำศัพท์ →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#E2E8F0] shadow-xs">
          <CardHeader>
            <CardDescription className="text-xs text-[#64748B] font-medium">
              สถานะระบบ AI Pipeline
            </CardDescription>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success">Architecture Ready</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-[#64748B]">
              MediaPipe & DTW Modules พร้อมสำหรับการใช้งานในระบบแล้ว
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#0F172A]">
          ทางลัดการจัดการ
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white border border-[#E2E8F0] shadow-xs">
            <CardHeader>
              <CardTitle className="text-base text-[#0F172A]">หมวดคำศัพท์ (Categories)</CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                เพิ่ม แก้ไข หรือจัดเรียงหมวดหมู่คำศัพท์ภาษามือ
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/admin/categories">
                <Button variant="outline" size="sm" className="font-medium text-[#0F172A]">
                  ไปที่หน้าหมวดคำศัพท์
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#E2E8F0] shadow-xs">
            <CardHeader>
              <CardTitle className="text-base text-[#0F172A]">คำศัพท์และบทเรียน (Lessons)</CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                จัดการรายการคำศัพท์ กำหนดประเภทท่าทาง Static/Dynamic
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/admin/lessons">
                <Button variant="outline" size="sm" className="font-medium text-[#0F172A]">
                  ไปที่หน้าคำศัพท์
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
