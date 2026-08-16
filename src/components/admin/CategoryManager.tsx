"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Category } from "@/types";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  canDeleteCategory,
  generateCategorySlug,
  syncCategories,
} from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
} from "@/components/ui";

interface FormData {
  name: string;
  slug: string;
  description: string;
  order: number;
  isActive: boolean;
}

const initialFormData: FormData = {
  name: "",
  slug: "",
  description: "",
  order: 1,
  isActive: true,
};

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Dialog State
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteCheck, setDeleteCheck] = useState<{
    canDelete: boolean;
    lessonCount: number;
    reason?: string;
  }>({ canDelete: false, lessonCount: 0 });
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const cats = await getCategories({ includeInactive: true });
      const lessons = await getLessons({ includeInactive: true });

      // Compute lesson counts per category
      const counts: Record<string, number> = {};
      cats.forEach((c) => {
        counts[c.id] = lessons.filter((l) => l.categoryId === c.id).length;
      });

      setCategories(cats);
      setLessonCounts(counts);
    } catch {
      showNotification("error", "ไม่สามารถโหลดข้อมูลหมวดหมู่ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      const result = await syncCategories();
      if (result.error) {
        showNotification("error", `Supabase Sync Error: ${result.error}`);
      } else {
        const parts: string[] = [];
        if (result.syncedToCloud > 0) parts.push(`ส่งขึ้น Cloud: ${result.syncedToCloud}`);
        if (result.downloadedFromCloud > 0) parts.push(`ดึงใหม่: ${result.downloadedFromCloud}`);
        if (result.purgedFromLocal > 0) parts.push(`ล้างรายการที่ถูกลบ: ${result.purgedFromLocal}`);
        
        const details = parts.length > 0 ? ` (${parts.join(", ")})` : " (ข้อมูลตรงกันแล้ว)";
        showNotification("success", `Sync หมวดหมู่กับ Supabase สำเร็จ${details}`);
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการ Sync กับ Cloud";
      showNotification("error", `เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const cats = await getCategories({ includeInactive: true });
        const lessons = await getLessons({ includeInactive: true });
        if (!isMounted) return;

        const counts: Record<string, number> = {};
        cats.forEach((c) => {
          counts[c.id] = lessons.filter((l) => l.categoryId === c.id).length;
        });

        setCategories(cats);
        setLessonCounts(counts);
      } catch {
        if (isMounted) {
          showNotification("error", "ไม่สามารถโหลดข้อมูลหมวดหมู่ได้");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);


  // Open Modal for Add
  const handleOpenAdd = () => {
    setFormMode("add");
    setEditingCategory(null);
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.order ?? 0), 0);
    setFormData({
      name: "",
      slug: "",
      description: "",
      order: maxOrder + 1,
      isActive: true,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (category: Category) => {
    setFormMode("edit");
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug || category.id,
      description: category.description || "",
      order: category.order ?? 1,
      isActive: category.isActive !== false,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Delete Confirmation Dialog
  const handleOpenDelete = async (category: Category) => {
    setDeletingCategory(category);
    setIsDeleteOpen(true);
    const check = await canDeleteCategory(category.id);
    setDeleteCheck(check);
  };

  // Handle Form Input Change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "order") {
      setFormData((prev) => ({ ...prev, order: parseInt(value, 10) || 0 }));
    } else {
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        // Auto update slug when adding and typing name
        if (formMode === "add" && name === "name" && !prev.slug) {
          next.slug = generateCategorySlug(value);
        }
        return next;
      });
    }
    setFormError(null);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();

    if (!name) {
      setFormError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (formMode === "add") {
        await addCategory({
          name,
          slug: formData.slug.trim() || undefined,
          description: formData.description.trim(),
          order: formData.order,
          isActive: formData.isActive,
        });
        showNotification("success", `เพิ่มหมวดหมู่ "${name}" สำเร็จ`);
      } else if (editingCategory) {
        await updateCategory({
          ...editingCategory,
          name,
          slug: formData.slug.trim() || editingCategory.slug || editingCategory.id,
          description: formData.description.trim(),
          order: formData.order,
          isActive: formData.isActive,
        });
        showNotification("success", `บันทึกหมวดหมู่ "${name}" สำเร็จ`);
      }

      setIsFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก";
      setFormError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation Submit
  const handleDeleteConfirm = async () => {
    if (!deletingCategory || !deleteCheck.canDelete) return;

    try {
      setIsDeleting(true);
      const res = await deleteCategory(deletingCategory.id);
      if (res.success) {
        showNotification("success", `ลบหมวดหมู่ "${deletingCategory.name}" สำเร็จ`);
        setIsDeleteOpen(false);
        setDeletingCategory(null);
        await loadData();
      } else {
        showNotification("error", res.error || "ไม่สามารถลบหมวดหมู่ได้");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ";
      showNotification("error", errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter Categories by Search Query
  const filteredCategories = categories.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const totalActive = categories.filter((c) => c.isActive !== false).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toast Notification */}

      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-medium transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === "success" ? "✓" : "⚠️"}</span>
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Control Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs shadow-xs font-medium text-[#475569]">
            ทั้งหมด: <span className="font-bold text-[#0F172A]">{categories.length}</span> หมวดหมู่
          </div>
          <div className="bg-white border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs shadow-xs font-medium text-[#475569]">
            เปิดใช้งาน: <span className="font-bold text-emerald-600">{totalActive}</span>
          </div>
          <Badge variant={isSupabaseConfigured() ? "success" : "outline"}>
            {isSupabaseConfigured() ? "☁️ Supabase Connected" : "💾 Local Storage Mode"}
          </Badge>
        </div>

        <div className="flex items-center gap-2.5">
          {isSupabaseConfigured() && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncCloud}
              disabled={isSyncing}
              className="text-xs font-semibold"
            >
              {isSyncing ? "กำลัง Sync..." : "☁️ Sync Cloud"}
            </Button>
          )}

          <Button
            size="sm"
            variant="amber"
            className="font-semibold shadow-xs"
            onClick={handleOpenAdd}
          >
            + เพิ่มหมวดหมู่ใหม่
          </Button>
        </div>
      </div>

      {/* Search Filter Box */}
      <div className="max-w-md">
        <Input
          type="search"
          placeholder="ค้นหาหมวดหมู่..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories Table / List */}
      <Card className="bg-white border border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-[#F1F5F9] pb-4">
          <CardTitle className="text-base text-[#0F172A]">รายการหมวดหมู่ทั้งหมด</CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            จัดการโครงสร้างหมวดหมู่คำศัพท์และบทเรียนภาษามือไทย
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#64748B] animate-pulse">
              กำลังโหลดข้อมูลหมวดหมู่...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
                📁
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {searchQuery ? "ไม่พบหมวดหมู่ที่ตรงกับการค้นหา" : "ยังไม่มีหมวดหมู่ในระบบ"}
              </p>
              <p className="text-xs text-[#64748B]">
                {searchQuery
                  ? "ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง"
                  : "เริ่มต้นโดยการกดปุ่ม 'เพิ่มหมวดหมู่ใหม่' ด้านบน"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {filteredCategories.map((cat) => {
                const count = lessonCounts[cat.id] ?? 0;
                const isActive = cat.isActive !== false;

                return (
                  <div
                    key={cat.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base text-[#0F172A]">
                          {cat.name}
                        </span>
                        <Badge variant="outline">ลำดับ {cat.order}</Badge>
                        <Badge variant={isActive ? "success" : "default"}>
                          {isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                        </Badge>
                        <span className="text-[11px] font-mono text-[#94A3B8] bg-slate-50 px-2 py-0.5 rounded">
                          id: {cat.id}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-[#64748B] line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-[#64748B] pt-1">
                        <span className="flex items-center gap-1 font-medium">
                          📚 คำศัพท์ในหมวด: <strong className="text-[#0F172A]">{count}</strong> คำ
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#0F172A] hover:bg-[#F1F5F9] font-medium text-xs"
                        onClick={() => handleOpenEdit(cat)}
                      >
                        ✏️ แก้ไข
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 font-medium text-xs"
                        onClick={() => handleOpenDelete(cat)}
                      >
                        🗑️ ลบ
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Category Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#0F172A]">
                  {formMode === "add" ? "เพิ่มหมวดหมู่ใหม่" : "แก้ไขหมวดหมู่"}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {formMode === "add"
                    ? "กำหนดชื่อและรายละเอียดของหมวดหมู่เพื่อจัดกลุ่มคำศัพท์"
                    : `แก้ไขข้อมูลหมวดหมู่: ${editingCategory?.name}`}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">
                  ชื่อหมวดหมู่ <span className="text-rose-500">*</span>
                </label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="เช่น ทักทาย พูดคุยเบื้องต้น, ตัวเลข..."
                  required
                />
              </div>

              {/* Slug / ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">
                  รหัสอ้างอิง / Slug (ภาษาอังกฤษหรือตัวเลข)
                </label>
                <Input
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="เช่น greeting-basic, numbers (ถ้าเว้นว่างระบบจะสร้างให้อัตโนมัติ)"
                  disabled={formMode === "edit"}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">คำอธิบาย</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="คำอธิบายรายละเอียดของหมวดหมู่นี้..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] transition-colors"

                />
              </div>

              {/* Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">ลำดับการแสดงผล</label>
                  <Input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleInputChange}
                    min={1}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-[#0F172A] cursor-pointer">
                    เปิดใช้งานหมวดนี้
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="amber"
                  className="font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "กำลังบันทึก..."
                    : formMode === "add"
                    ? "เพิ่มหมวดหมู่"
                    : "บันทึกการแก้ไข"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Dialog */}
      {isDeleteOpen && deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg text-[#0F172A]">ยืนยันการลบหมวดหมู่</h3>
              <p className="text-sm font-semibold text-rose-600">
                &ldquo;{deletingCategory.name}&rdquo;
              </p>
            </div>

            {/* Guard Warning Check */}
            {!deleteCheck.canDelete ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed space-y-2">
                <p className="font-bold flex items-center gap-1">
                  🚫 ไม่สามารถลบหมวดหมู่นี้ได้
                </p>
                <p>{deleteCheck.reason}</p>
                <p className="text-slate-600">
                  กรุณาไปที่หน้า <strong>คำศัพท์และบทเรียน</strong> เพื่อลบหรือย้ายคำศัพท์ {deleteCheck.lessonCount} คำออกก่อน จึงจะสามารถลบหมวดหมู่นี้ได้
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] text-center leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่นี้? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeletingCategory(null);
                }}
                disabled={isDeleting}
              >
                {deleteCheck.canDelete ? "ยกเลิก" : "ปิด"}
              </Button>
              {deleteCheck.canDelete && (
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
