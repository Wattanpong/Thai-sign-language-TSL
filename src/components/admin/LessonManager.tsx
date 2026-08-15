"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Lesson, Category, GestureType, DifficultyLevel } from "@/types";
import { getCategories } from "@/lib/storage/categoryStorage";
import {
  getLessons,
  addLesson,
  updateLesson,
  deleteLesson,
} from "@/lib/storage/lessonStorage";
import { getReferencesByLessonId } from "@/lib/storage/referenceStorage";
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

interface LessonFormData {
  word: string;
  categoryId: string;
  description: string;
  gestureType: GestureType;
  difficulty: DifficultyLevel;
  example: string;
  order: number;
  isActive: boolean;
}

const initialLessonFormData: LessonFormData = {
  word: "",
  categoryId: "",
  description: "",
  gestureType: "dynamic",
  difficulty: "beginner",
  example: "",
  order: 1,
  isActive: true,
};

interface ReferenceSummary {
  count: number;
  primaryQualityScore?: number;
  primaryQualityLevel?: string;
}

export function LessonManager() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [referenceMap, setReferenceMap] = useState<Record<string, ReferenceSummary>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedGestureType, setSelectedGestureType] = useState<string>("all");

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState<LessonFormData>(initialLessonFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);
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
      const [cats, les] = await Promise.all([
        getCategories({ includeInactive: true }),
        getLessons({ includeInactive: true }),
      ]);

      setCategories(cats);
      setLessons(les);

      // Load reference summaries asynchronously
      const refSummary: Record<string, ReferenceSummary> = {};
      await Promise.all(
        les.map(async (lesson) => {
          try {
            const refs = await getReferencesByLessonId(lesson.id);
            const primary = refs.find((r) => r.isPrimary) || refs[0];
            refSummary[lesson.id] = {
              count: refs.length,
              primaryQualityScore: primary?.qualityScore,
              primaryQualityLevel: primary?.qualityLevel,
            };
          } catch {
            refSummary[lesson.id] = { count: 0 };
          }
        })
      );
      setReferenceMap(refSummary);
    } catch {
      showNotification("error", "ไม่สามารถโหลดข้อมูลคำศัพท์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const [cats, les] = await Promise.all([
          getCategories({ includeInactive: true }),
          getLessons({ includeInactive: true }),
        ]);
        if (!isMounted) return;

        setCategories(cats);
        setLessons(les);

        const refSummary: Record<string, ReferenceSummary> = {};
        await Promise.all(
          les.map(async (lesson) => {
            try {
              const refs = await getReferencesByLessonId(lesson.id);
              const primary = refs.find((r) => r.isPrimary) || refs[0];
              refSummary[lesson.id] = {
                count: refs.length,
                primaryQualityScore: primary?.qualityScore,
                primaryQualityLevel: primary?.qualityLevel,
              };
            } catch {
              refSummary[lesson.id] = { count: 0 };
            }
          })
        );
        if (!isMounted) return;
        setReferenceMap(refSummary);
      } catch {
        if (isMounted) {
          showNotification("error", "ไม่สามารถโหลดข้อมูลคำศัพท์ได้");
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
    setEditingLesson(null);
    const maxOrder = lessons.reduce((max, l) => Math.max(max, l.order ?? 0), 0);
    const defaultCatId = categories[0]?.id || "";
    setFormData({
      word: "",
      categoryId: defaultCatId,
      description: "",
      gestureType: "dynamic",
      difficulty: "beginner",
      example: "",
      order: maxOrder + 1,
      isActive: true,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (lesson: Lesson) => {
    setFormMode("edit");
    setEditingLesson(lesson);
    setFormData({
      word: lesson.word,
      categoryId: lesson.categoryId,
      description: lesson.description || "",
      gestureType: lesson.gestureType,
      difficulty: lesson.difficulty || "beginner",
      example: lesson.example || "",
      order: lesson.order ?? 1,
      isActive: lesson.isActive !== false,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Delete Dialog
  const handleOpenDelete = (lesson: Lesson) => {
    setDeletingLesson(lesson);
    setIsDeleteOpen(true);
  };

  // Handle Form Change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "order") {
      setFormData((prev) => ({ ...prev, order: parseInt(value, 10) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setFormError(null);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const word = formData.word.trim();
    const categoryId = formData.categoryId.trim();
    const description = formData.description.trim();

    if (!word) {
      setFormError("กรุณากรอกคำศัพท์");
      return;
    }
    if (!categoryId) {
      setFormError("กรุณาเลือกหมวดหมู่");
      return;
    }
    if (!description) {
      setFormError("กรุณากรอกคำอธิบายลักษณะท่าทาง");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (formMode === "add") {
        await addLesson({
          word,
          categoryId,
          description,
          gestureType: formData.gestureType,
          difficulty: formData.difficulty,
          example: formData.example.trim() || undefined,
          order: formData.order,
          isActive: formData.isActive,
        });
        showNotification("success", `เพิ่มคำศัพท์ "${word}" สำเร็จ`);
      } else if (editingLesson) {
        await updateLesson({
          ...editingLesson,
          word,
          categoryId,
          description,
          gestureType: formData.gestureType,
          difficulty: formData.difficulty,
          example: formData.example.trim() || undefined,
          order: formData.order,
          isActive: formData.isActive,
        });
        showNotification("success", `บันทึกคำศัพท์ "${word}" สำเร็จ`);
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

  // Handle Delete Lesson
  const handleDeleteConfirm = async () => {
    if (!deletingLesson) return;

    try {
      setIsDeleting(true);
      await deleteLesson(deletingLesson.id);
      showNotification("success", `ลบคำศัพท์ "${deletingLesson.word}" เรียบร้อยแล้ว`);
      setIsDeleteOpen(false);
      setDeletingLesson(null);
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ";
      showNotification("error", errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to get category name
  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  // Filter Lessons
  const filteredLessons = lessons.filter((lesson) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      lesson.word.toLowerCase().includes(q) ||
      lesson.description.toLowerCase().includes(q) ||
      lesson.id.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "all" || lesson.categoryId === selectedCategory;

    const matchesGesture =
      selectedGestureType === "all" || lesson.gestureType === selectedGestureType;

    return matchesSearch && matchesCategory && matchesGesture;
  });

  const totalActive = lessons.filter((l) => l.isActive !== false).length;

  return (
    <div className="space-y-6">
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs shadow-xs font-medium text-[#475569]">
            คำศัพท์ทั้งหมด: <span className="font-bold text-[#0F172A]">{lessons.length}</span> คำ
          </div>
          <div className="bg-white border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs shadow-xs font-medium text-[#475569]">
            เปิดใช้งาน: <span className="font-bold text-emerald-600">{totalActive}</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="amber"
          className="font-semibold shadow-xs"
          onClick={handleOpenAdd}
        >
          + เพิ่มคำศัพท์ใหม่
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Input
              type="search"
              placeholder="ค้นหาคำศัพท์หรือท่าทาง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB400] transition-colors"
            >
              <option value="all">หมวดหมู่ทั้งหมด ({lessons.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedGestureType}
              onChange={(e) => setSelectedGestureType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB400] transition-colors"
            >
              <option value="all">ทุกประเภทท่าทาง</option>
              <option value="dynamic">ท่าทางต่อเนื่อง (Dynamic)</option>
              <option value="static">ท่าทางคงที่ (Static)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lessons List Card */}
      <Card className="bg-white border border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-[#F1F5F9] pb-4">
          <CardTitle className="text-base text-[#0F172A]">
            รายการคำศัพท์ ({filteredLessons.length})
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            รายการคำศัพท์ภาษามือไทย พร้อมระบบตรวจสอบ Reference Gesture และคะแนนความสมบูรณ์
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#64748B] animate-pulse">
              กำลังโหลดข้อมูลคำศัพท์และ Reference Dataset...
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
                📖
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {searchQuery || selectedCategory !== "all"
                  ? "ไม่พบคำศัพท์ที่ตรงกับเงื่อนไขการค้นหา"
                  : "ยังไม่มีคำศัพท์ในระบบ"}
              </p>
              <p className="text-xs text-[#64748B]">
                {searchQuery || selectedCategory !== "all"
                  ? "ลองปรับตัวกรองหรือคำค้นหาใหม่"
                  : "เริ่มต้นโดยการกดปุ่ม 'เพิ่มคำศัพท์ใหม่'"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {filteredLessons.map((lesson) => {
                const refInfo = referenceMap[lesson.id] ?? { count: 0 };
                const isDynamic = lesson.gestureType === "dynamic";
                const isActive = lesson.isActive !== false;

                return (
                  <div
                    key={lesson.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* Lesson Info */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-lg text-[#0F172A]">
                          {lesson.word}
                        </span>

                        {/* Category Badge */}
                        <Badge variant="outline">
                          {getCategoryName(lesson.categoryId)}
                        </Badge>

                        {/* Gesture Type */}
                        <Badge variant={isDynamic ? "primary" : "outline"}>
                          {isDynamic ? "Dynamic" : "Static"}
                        </Badge>

                        {/* Difficulty */}
                        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-700">
                          {lesson.difficulty || "beginner"}
                        </span>

                        {/* Status */}
                        <Badge variant={isActive ? "success" : "default"}>
                          {isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                        </Badge>

                        <span className="text-[11px] font-mono text-[#94A3B8] bg-slate-50 px-2 py-0.5 rounded">
                          #{lesson.id}
                        </span>
                      </div>

                      <p className="text-xs text-[#64748B] leading-relaxed max-w-2xl">
                        {lesson.description}
                      </p>

                      {/* Reference Gesture Metadata Info */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span>🎥 ต้นแบบอ้างอิง:</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              refInfo.count > 0
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {refInfo.count} ชุด
                          </span>
                        </div>

                        {refInfo.count > 0 && refInfo.primaryQualityScore !== undefined && (
                          <div className="flex items-center gap-1 font-medium text-emerald-700">
                            <span>⭐ คุณภาพต้นแบบหลัก:</span>
                            <span className="font-bold">
                              {refInfo.primaryQualityScore}% ({refInfo.primaryQualityLevel || "Good"})
                            </span>
                          </div>
                        )}

                        {refInfo.count === 0 && (
                          <span className="text-amber-600 text-[11px]">
                            ⚠️ ยังไม่มี Reference Gesture บันทึกไว้
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      <Link href={`/admin/lessons/${lesson.id}/reference`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-semibold text-xs border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100 transition-colors shadow-2xs"
                        >
                          🎥 จัดการ Reference
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#0F172A] hover:bg-[#F1F5F9] font-medium text-xs"
                        onClick={() => handleOpenEdit(lesson)}
                      >
                        ✏️ แก้ไข
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 font-medium text-xs"
                        onClick={() => handleOpenDelete(lesson)}
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

      {/* Add / Edit Lesson Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#0F172A]">
                  {formMode === "add" ? "เพิ่มคำศัพท์ใหม่" : "แก้ไขคำศัพท์"}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {formMode === "add"
                    ? "กำหนดคำศัพท์ หมวดหมู่ และลักษณะท่าทางสำหรับระบบตรวจจับ AI"
                    : `แก้ไขข้อมูลคำศัพท์: ${editingLesson?.word}`}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Word */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">
                  คำศัพท์ภาษามือ <span className="text-rose-500">*</span>
                </label>
                <Input
                  name="word"
                  value={formData.word}
                  onChange={handleInputChange}
                  placeholder="เช่น สวัสดี, ขอบคุณ, ยินดี..."
                  required
                />
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">
                  หมวดหมู่ <span className="text-rose-500">*</span>
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB400] transition-colors"
                >
                  <option value="" disabled>
                    -- เลือกหมวดหมู่ --
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F172A]">
                  คำอธิบายลักษณะท่าทาง <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="อธิบายตำแหน่งมือ การเคลื่อนไหว และข้อสังเกตของท่าทาง..."
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#FFB400] transition-colors"
                />
              </div>

              {/* Gesture Type & Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">ประเภทท่าทาง</label>
                  <select
                    name="gestureType"
                    value={formData.gestureType}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB400]"
                  >
                    <option value="dynamic">ท่าทางต่อเนื่อง (Dynamic)</option>
                    <option value="static">ท่าทางคงที่ (Static)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">ระดับความยาก</label>
                  <select
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB400]"
                  >
                    <option value="beginner">ระดับเริ่มต้น (Beginner)</option>
                    <option value="intermediate">ระดับปานกลาง (Intermediate)</option>
                    <option value="advanced">ระดับสูง (Advanced)</option>
                  </select>
                </div>
              </div>

              {/* Order & Active */}
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
                    id="lessonIsActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                  />
                  <label htmlFor="lessonIsActive" className="text-xs font-semibold text-[#0F172A] cursor-pointer">
                    เปิดใช้งานคำนี้
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
                    ? "เพิ่มคำศัพท์"
                    : "บันทึกการแก้ไข"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Lesson Confirmation Dialog */}
      {isDeleteOpen && deletingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              🗑️
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg text-[#0F172A]">ยืนยันการลบคำศัพท์</h3>
              <p className="text-base font-bold text-rose-600">
                &ldquo;{deletingLesson.word}&rdquo;
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
              <p className="font-semibold text-slate-800">
                ⚠️ ข้อควรทราบเมื่อลบคำศัพท์:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>ข้อมูล Reference Gesture ทั้งหมดของคำศัพท์นี้จะถูกลบออกด้วยอัตโนมัติ</li>
                <li>คำศัพท์นี้จะไม่ปรากฏในหน้าเรียนรู้และการฝึกซ้อมอีกต่อไป</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeletingLesson(null);
                }}
                disabled={isDeleting}
              >
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันการลบคำศัพท์"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
