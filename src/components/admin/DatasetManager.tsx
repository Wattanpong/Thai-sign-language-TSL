"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DatasetSnapshot,

  TSLDatasetPackage,
  DatasetValidationResult,
  DatasetImportMode,
  DuplicateStrategy,
  DatasetImportSummary,
} from "@/types";
import { getCategories } from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";
import { getAllStoredReferences } from "@/lib/storage/referenceStorage";
import { downloadDatasetJson } from "@/lib/storage/datasetExportService";
import {
  validateDataset,
  createImportPlan,
  importDatasetFromJson,
  DatasetImportPlan,
} from "@/lib/storage/datasetImportService";

import {
  getDatasetSnapshots,
  createDatasetSnapshot,
  restoreDatasetSnapshot,
  factoryResetDataset,
  deleteDatasetSnapshot,
  downloadDatasetSnapshot,
} from "@/lib/storage/datasetBackupService";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  StatisticsCard,
} from "@/components/ui";

export function DatasetManager() {
  // Statistics State
  const [stats, setStats] = useState({
    categoriesCount: 0,
    lessonsCount: 0,
    referencesCount: 0,
    snapshotsCount: 0,
  });
  const [snapshots, setSnapshots] = useState<DatasetSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Notification Toast State
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Export State
  const [exportIncludeSeeds, setExportIncludeSeeds] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawDatasetPackage, setRawDatasetPackage] = useState<TSLDatasetPackage | null>(null);
  const [importMode, setImportMode] = useState<DatasetImportMode>("merge");
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("skip");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<DatasetValidationResult | null>(null);
  const [importPlan, setImportPlan] = useState<DatasetImportPlan | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [lastImportSummary, setLastImportSummary] = useState<DatasetImportSummary | null>(null);

  // Backup State
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [customBackupName, setCustomBackupName] = useState<string>("");

  // Confirmation Modal State (for Restore, Delete Snapshot, Factory Reset)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "restore" | "delete" | "factory_reset";
    snapshotId?: string;
    snapshotName?: string;
    title: string;
    message: string;
    dangerLevel: "normal" | "danger";
  }>({
    isOpen: false,
    type: "restore",
    title: "",
    message: "",
    dangerLevel: "normal",
  });
  const [isModalProcessing, setIsModalProcessing] = useState<boolean>(false);

  // Load live platform statistics & snapshots
  const loadPlatformData = useCallback(async () => {
    try {
      const [cats, les, refs, snaps] = await Promise.all([
        getCategories({ includeInactive: true }),
        getLessons({ includeInactive: true }),
        getAllStoredReferences({ includeSeeds: true }),
        getDatasetSnapshots(),
      ]);

      setStats({
        categoriesCount: cats.length,
        lessonsCount: les.length,
        referencesCount: refs.length,
        snapshotsCount: snaps.length,
      });
      setSnapshots(snaps);
    } catch {
      showNotification("error", "ไม่สามารถโหลดข้อมูลสถิติของระบบได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [cats, les, refs, snaps] = await Promise.all([
          getCategories({ includeInactive: true }),
          getLessons({ includeInactive: true }),
          getAllStoredReferences({ includeSeeds: true }),
          getDatasetSnapshots(),
        ]);
        if (isMounted) {
          setStats({
            categoriesCount: cats.length,
            lessonsCount: les.length,
            referencesCount: refs.length,
            snapshotsCount: snaps.length,
          });
          setSnapshots(snaps);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);


  // Handle Export Dataset
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await downloadDatasetJson(undefined, {
        includeSeeds: exportIncludeSeeds,
      });

      if (res.success) {
        showNotification("success", `✓ ส่งออก Dataset สำเร็จ (${res.filename})`);
      } else {
        showNotification("error", res.error || "ไม่สามารถดาวน์โหลดไฟล์ Dataset ได้");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งออก Dataset";
      showNotification("error", msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection for Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setValidationResult(null);
    setImportPlan(null);
    setLastImportSummary(null);

    try {
      setIsValidating(true);
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setValidationResult({
          isValid: false,
          errors: [{ type: "invalid_json", message: "ไฟล์นำเข้าไม่ใช่รูปแบบ JSON ที่ถูกต้อง" }],
          warnings: [],
          summary: {
            categoriesCount: 0,
            lessonsCount: 0,
            referencesCount: 0,
            validCategoriesCount: 0,
            validLessonsCount: 0,
            validReferencesCount: 0,
          },
        });
        setIsValidating(false);
        return;
      }

      setRawDatasetPackage(parsed as TSLDatasetPackage);

      // Validate dataset
      const val = await validateDataset(parsed, { mode: importMode });
      setValidationResult(val);

      if (val.isValid) {
        // Generate Import Plan
        const plan = await createImportPlan(parsed as TSLDatasetPackage, {
          mode: importMode,
          duplicateStrategy,
        });
        setImportPlan(plan);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดระหว่างอ่านไฟล์";
      showNotification("error", msg);
    } finally {
      setIsValidating(false);
    }
  };

  // Recalculate plan when import options change
  const handleOptionChange = async (mode: DatasetImportMode, strat: DuplicateStrategy) => {
    setImportMode(mode);
    setDuplicateStrategy(strat);

    if (rawDatasetPackage) {
      try {
        setIsValidating(true);
        const val = await validateDataset(rawDatasetPackage, { mode });
        setValidationResult(val);

        if (val.isValid) {
          const plan = await createImportPlan(rawDatasetPackage, {
            mode,
            duplicateStrategy: strat,
          });
          setImportPlan(plan);
        } else {
          setImportPlan(null);
        }
      } catch {
        // ignore
      } finally {
        setIsValidating(false);
      }
    }
  };

  // Reset Import Selection
  const handleCancelImport = () => {
    setUploadedFile(null);
    setRawDatasetPackage(null);
    setValidationResult(null);
    setImportPlan(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!rawDatasetPackage || !importPlan) return;

    try {
      setIsImporting(true);
      const res = await importDatasetFromJson(rawDatasetPackage, {
        mode: importMode,
        duplicateStrategy,
      });

      if (res.summary && res.summary.success) {
        setLastImportSummary(res.summary);
        showNotification(
          "success",
          `✓ นำเข้า Dataset สำเร็จ (เพิ่มหมวดหมู่: ${res.summary.importedCategories}, คำศัพท์: ${res.summary.importedLessons}, References: ${res.summary.importedReferences})`
        );
        handleCancelImport();
        await loadPlatformData();
      } else {
        showNotification("error", res.validation.errors[0]?.message || "การนำเข้า Dataset ล้มเหลว");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า Dataset";
      showNotification("error", msg);
    } finally {
      setIsImporting(false);
    }
  };

  // Create Manual Snapshot
  const handleCreateSnapshot = async () => {
    try {
      setIsCreatingBackup(true);
      const name = customBackupName.trim() || undefined;
      const snap = await createDatasetSnapshot({ name, includeSeeds: true });
      setCustomBackupName("");
      showNotification("success", `✓ สร้าง Backup "${snap.name}" สำเร็จ`);
      await loadPlatformData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้าง Backup";
      showNotification("error", msg);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Download Snapshot
  const handleDownloadSnapshot = async (id: string) => {
    try {
      const res = await downloadDatasetSnapshot(id);
      if (res.success) {
        showNotification("success", "✓ ดาวน์โหลด Backup สำเร็จ");
      } else {
        showNotification("error", res.error || "ไม่สามารถดาวน์โหลด Backup ได้");
      }
    } catch {
      showNotification("error", "เกิดข้อผิดพลาดในการดาวน์โหลด Backup");
    }
  };

  // Open Restore Confirmation Modal
  const openRestoreModal = (snap: DatasetSnapshot) => {
    setConfirmModal({
      isOpen: true,
      type: "restore",
      snapshotId: snap.id,
      snapshotName: snap.name,
      title: "ยืนยันการกู้คืนข้อมูล (Restore Dataset)",
      message: `คุณต้องการกู้คืนข้อมูลจาก Snapshot "${snap.name}" หรือไม่? ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจาก Snapshot นี้ (ระบบจะสร้าง Quick Backup ปัจจุบันไว้ให้อัตโนมัติ)`,
      dangerLevel: "normal",
    });
  };

  // Open Delete Snapshot Modal
  const openDeleteModal = (snap: DatasetSnapshot) => {
    setConfirmModal({
      isOpen: true,
      type: "delete",
      snapshotId: snap.id,
      snapshotName: snap.name,
      title: "ยืนยันการลบ Backup",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบ Backup "${snap.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      dangerLevel: "danger",
    });
  };

  // Open Factory Reset Modal
  const openFactoryResetModal = () => {
    setConfirmModal({
      isOpen: true,
      type: "factory_reset",
      title: "⚠️ ยืนยันการคืนค่าเริ่มต้นโรงงาน (Factory Reset)",
      message:
        "การดำเนินการนี้จะลบข้อมูลคำศัพท์ หมวดหมู่ และ Reference ที่กำหนดเองทั้งหมด แล้วคืนระบบกลับสู่ Seed Dataset มาตรฐานดั้งเดิม (ระบบจะสร้าง Quick Backup ข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อน Reset)",
      dangerLevel: "danger",
    });
  };

  // Confirm Modal Action Handler
  const handleModalConfirm = async () => {
    setIsModalProcessing(true);
    try {
      if (confirmModal.type === "restore" && confirmModal.snapshotId) {
        await restoreDatasetSnapshot(confirmModal.snapshotId);
        showNotification("success", "✓ กู้คืนข้อมูล (Restore) สำเร็จเรียบร้อยแล้ว");
      } else if (confirmModal.type === "delete" && confirmModal.snapshotId) {
        await deleteDatasetSnapshot(confirmModal.snapshotId);
        showNotification("success", "✓ ลบ Snapshot เรียบร้อยแล้ว");
      } else if (confirmModal.type === "factory_reset") {
        await factoryResetDataset({ createBackup: true });
        showNotification("success", "✓ คืนค่าเริ่มต้นโรงงาน (Factory Reset) สำเร็จเรียบร้อยแล้ว");
      }
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      await loadPlatformData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "การดำเนินการล้มเหลว";
      showNotification("error", msg);
    } finally {
      setIsModalProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Notification Toast */}
      {notification && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            notification.type === "success"
              ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
          }`}
        >
          <span>{notification.type === "success" ? "✓" : "✕"}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Overview Statistics Cards */}
      <section aria-labelledby="dataset-stats-heading">
        <h2 id="dataset-stats-heading" className="sr-only">
          สถิติข้อมูลของระบบ
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatisticsCard
            label="หมวดหมู่ (Categories)"
            value={loading ? "-" : stats.categoriesCount}
            description="หมวดหมู่คำศัพท์ทั้งหมดในระบบ"
            icon={<span className="text-base">📁</span>}
          />
          <StatisticsCard
            label="คำศัพท์ (Lessons)"
            value={loading ? "-" : stats.lessonsCount}
            description="คำศัพท์ภาษามือไทยในระบบ"
            icon={<span className="text-base">📖</span>}
          />
          <StatisticsCard
            label="คลังท่าทาง (References)"
            value={loading ? "-" : stats.referencesCount}
            description="ต้นแบบท่าทางอ้างอิงทั้งหมด"
            icon={<span className="text-base">🎥</span>}
          />
          <StatisticsCard
            label="ชุดสำรอง (Backups)"
            value={loading ? "-" : stats.snapshotsCount}
            description="Snapshots ที่บันทึกไว้ในระบบ"
            icon={<span className="text-base">💾</span>}
          />
        </div>
      </section>

      {/* Main 2-Column Section: Export & Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* EXPORT SECTION */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#FFB400] uppercase tracking-wider mb-1">
              <span>📤 Export</span>
            </div>
            <CardTitle>ส่งออก Dataset (Export Dataset)</CardTitle>
            <CardDescription>
              ดาวน์โหลดข้อมูลหมวดหมู่ คำศัพท์ และท่าทางอ้างอิงทั้งหมดของระบบเป็นไฟล์มาตรฐาน JSON
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeSeeds}
                    onChange={(e) => setExportIncludeSeeds(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#FFB400] focus:ring-[#FFB400]"
                  />
                  <span className="text-sm font-medium text-[#1E293B]">
                    รวม Seed References เริ่มต้นในไฟล์ส่งออก (แนะนำ)
                  </span>
                </label>
                <p className="text-xs text-[#64748B] pl-7 leading-relaxed">
                  เมื่อเปิดใช้งาน ไฟล์ Dataset จะประกอบด้วยท่าทางต้นแบบดั้งเดิมของระบบด้วย
                  ทำให้สามารถนำไปติดตั้งบนเครื่องอื่นได้อย่างสมบูรณ์ 100%
                </p>
              </div>

              <div className="text-xs text-[#64748B] space-y-1.5 p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E]">
                <p className="font-semibold">📦 โครงสร้างที่จะถูกส่งออก:</p>
                <p>• Categories: {stats.categoriesCount} รายการ</p>
                <p>• Lessons: {stats.lessonsCount} รายการ</p>
                <p>• References: {stats.referencesCount} ชุดข้อมูลท่าทาง</p>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || loading}
              className="w-full h-11 text-base font-semibold shadow-xs"
            >
              {isExporting ? "กำลังส่งออกข้อมูล..." : "📥 ดาวน์โหลด Dataset (.json)"}
            </Button>
          </CardContent>
        </Card>

        {/* IMPORT SECTION */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3B82F6] uppercase tracking-wider mb-1">
              <span>📥 Import</span>
            </div>
            <CardTitle>นำเข้า Dataset (Import Dataset)</CardTitle>
            <CardDescription>
              อัปโหลดไฟล์ JSON เพื่อนำเข้าหมวดหมู่ คำศัพท์ และ Reference Gestures เข้าสู่ระบบ
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* File Upload Area */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="dataset-file-input"
                />
                <label
                  htmlFor="dataset-file-input"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#CBD5E1] hover:border-[#FFB400] bg-[#F8FAFC] hover:bg-[#FFFBEB]/30 rounded-xl cursor-pointer transition-all text-center group"
                >
                  <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">
                    {isValidating ? "⏳" : "📄"}
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B]">
                    {isValidating
                      ? "กำลังตรวจสอบความถูกต้องของไฟล์..."
                      : uploadedFile
                      ? uploadedFile.name
                      : "คลิกเพื่อเลือกไฟล์ Dataset (.json)"}
                  </span>
                  <span className="text-xs text-[#64748B] mt-1">
                    รองรับเฉพาะไฟล์มาตรฐาน JSON (Version 1.0.0)
                  </span>
                </label>
              </div>

              {/* Last Import Success Summary Banner */}
              {lastImportSummary && (
                <div className="p-3.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs text-[#166534] space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>🎉 นำเข้า Dataset สำเร็จล่าสุด:</span>
                    <button
                      type="button"
                      onClick={() => setLastImportSummary(null)}
                      className="text-[#166534] hover:text-[#14532D]"
                    >
                      ✕
                    </button>
                  </div>
                  <p>• หมวดหมู่: +{lastImportSummary.importedCategories} | คำศัพท์: +{lastImportSummary.importedLessons} | References: +{lastImportSummary.importedReferences}</p>
                </div>
              )}


              {/* Import Mode & Duplicate Options */}
              <div className="space-y-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
                <div>
                  <label className="font-semibold text-[#1E293B] block mb-1.5">
                    โหมดการนำเข้า (Import Mode):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOptionChange("merge", duplicateStrategy)}
                      className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                        importMode === "merge"
                          ? "bg-white border-[#FFB400] text-[#92400E] shadow-xs"
                          : "bg-[#F1F5F9] border-transparent text-[#64748B] hover:bg-white"
                      }`}
                    >
                      <div className="font-bold text-xs">🔀 Merge (รวมข้อมูล)</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">เพิ่มข้อมูลโดยไม่ลบของเดิม</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOptionChange("replace", duplicateStrategy)}
                      className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                        importMode === "replace"
                          ? "bg-white border-[#EF4444] text-[#991B1B] shadow-xs"
                          : "bg-[#F1F5F9] border-transparent text-[#64748B] hover:bg-white"
                      }`}
                    >
                      <div className="font-bold text-xs">🔄 Replace (แทนที่ทั้งหมด)</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">ล้างข้อมูลเก่าและลงใหม่</div>
                    </button>
                  </div>
                </div>

                {importMode === "merge" && (
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <label className="font-semibold text-[#1E293B] block mb-1.5">
                      การจัดการเมื่อพบ ID ซ้ำ (Duplicate Strategy):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOptionChange(importMode, "skip")}
                        className={`p-2 rounded-lg border text-center font-medium text-[11px] transition-all ${
                          duplicateStrategy === "skip"
                            ? "bg-white border-[#FFB400] text-[#92400E] font-bold"
                            : "bg-[#F1F5F9] border-transparent text-[#64748B]"
                        }`}
                      >
                        → ข้าม (Skip)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOptionChange(importMode, "overwrite")}
                        className={`p-2 rounded-lg border text-center font-medium text-[11px] transition-all ${
                          duplicateStrategy === "overwrite"
                            ? "bg-white border-[#FFB400] text-[#92400E] font-bold"
                            : "bg-[#F1F5F9] border-transparent text-[#64748B]"
                        }`}
                      >
                        ↻ เขียนทับ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOptionChange(importMode, "error")}
                        className={`p-2 rounded-lg border text-center font-medium text-[11px] transition-all ${
                          duplicateStrategy === "error"
                            ? "bg-white border-[#EF4444] text-[#991B1B] font-bold"
                            : "bg-[#F1F5F9] border-transparent text-[#64748B]"
                        }`}
                      >
                        ✕ หยุดหากซ้ำ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {uploadedFile && (
              <Button
                variant="outline"
                onClick={handleCancelImport}
                disabled={isImporting}
                className="w-full"
              >
                ยกเลิกไฟล์ที่เลือก
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* IMPORT VALIDATION & PREVIEW PANEL */}
      {validationResult && (
        <Card className={`border-2 ${validationResult.isValid ? "border-[#BBF7D0]" : "border-[#FECACA]"}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{validationResult.isValid ? "✅" : "❌"}</span>
                <CardTitle className="text-lg">
                  {validationResult.isValid ? "ตรวจสอบโครงสร้างสำเร็จ (Validation Passed)" : "พบข้อผิดพลาดใน Dataset"}
                </CardTitle>
              </div>
              <Badge variant={validationResult.isValid ? "success" : "warning"}>
                {validationResult.isValid ? "พร้อมนำเข้า" : "ไม่อนุญาตให้นำเข้า"}
              </Badge>
            </div>

            <CardDescription>
              {validationResult.isValid
                ? "ข้อมูลผ่านการตรวจสอบโครงสร้างและความสัมพันธ์ของ Foreign Keys เรียบร้อยแล้ว"
                : "โปรดตรวจสอบและแก้ไขข้อผิดพลาดต่อไปนี้ก่อนดำเนินการนำเข้า"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Validation Errors List */}
            {validationResult.errors.length > 0 && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#991B1B]">
                  ข้อผิดพลาด ({validationResult.errors.length} รายการ):
                </p>
                <ul className="text-xs text-[#B91C1C] space-y-1 pl-4 list-disc">
                  {validationResult.errors.map((err, idx) => (
                    <li key={idx}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Warnings List */}
            {validationResult.warnings.length > 0 && (
              <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                  คำเตือน ({validationResult.warnings.length} รายการ):
                </p>
                <ul className="text-xs text-[#B45309] space-y-1 pl-4 list-disc">
                  {validationResult.warnings.map((warn, idx) => (
                    <li key={idx}>{warn.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Import Plan Preview Grid */}
            {importPlan && validationResult.isValid && (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  พรีวิวแผนการนำเข้าข้อมูล (Import Preview Plan):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Categories Plan */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">
                      <span>หมวดหมู่ (Categories)</span>
                      <Badge variant="outline">{importPlan.summary.totalIncomingCategories} ในไฟล์</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-[#475569] pt-1">
                      <div className="text-[#166534]">＋ เพิ่มใหม่: {importPlan.summary.categoriesToCreate}</div>
                      <div className="text-[#2563EB]">↻ อัปเดต: {importPlan.summary.categoriesToUpdate}</div>
                      <div className="text-[#64748B]">→ ข้าม: {importPlan.summary.categoriesToSkip}</div>
                      {importMode === "replace" && (
                        <div className="text-[#DC2626]">− ลบของเก่า: {importPlan.summary.categoriesToDelete}</div>
                      )}
                    </div>
                  </div>

                  {/* Lessons Plan */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">
                      <span>คำศัพท์ (Lessons)</span>
                      <Badge variant="outline">{importPlan.summary.totalIncomingLessons} ในไฟล์</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-[#475569] pt-1">
                      <div className="text-[#166534]">＋ เพิ่มใหม่: {importPlan.summary.lessonsToCreate}</div>
                      <div className="text-[#2563EB]">↻ อัปเดต: {importPlan.summary.lessonsToUpdate}</div>
                      <div className="text-[#64748B]">→ ข้าม: {importPlan.summary.lessonsToSkip}</div>
                      {importMode === "replace" && (
                        <div className="text-[#DC2626]">− ลบของเก่า: {importPlan.summary.lessonsToDelete}</div>
                      )}
                    </div>
                  </div>

                  {/* References Plan */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">
                      <span>References</span>
                      <Badge variant="outline">{importPlan.summary.totalIncomingReferences} ในไฟล์</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-[#475569] pt-1">
                      <div className="text-[#166534]">＋ เพิ่มใหม่: {importPlan.summary.referencesToCreate}</div>
                      <div className="text-[#2563EB]">↻ อัปเดต: {importPlan.summary.referencesToUpdate}</div>
                      <div className="text-[#64748B]">→ ข้าม: {importPlan.summary.referencesToSkip}</div>
                      {importMode === "replace" && (
                        <div className="text-[#DC2626]">− ลบของเก่า: {importPlan.summary.referencesToDelete}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={handleCancelImport} disabled={isImporting}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleExecuteImport} disabled={isImporting} className="font-semibold px-6">
                    {isImporting ? "กำลังนำเข้าข้อมูล..." : "🚀 ยืนยันการนำเข้า (Execute Import)"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BACKUP & SNAPSHOT SECTION */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981] uppercase tracking-wider mb-1">
                <span>💾 Backup & Snapshot</span>
              </div>
              <CardTitle>จุดสำรองข้อมูลย้อนหลัง (Dataset Snapshots)</CardTitle>
              <CardDescription>
                สร้างจุดสำรองข้อมูลของระบบได้ทันที หรือกู้คืนข้อมูลย้อนหลังจาก Snapshot ที่ต้องการ
              </CardDescription>
            </div>

            {/* Quick Create Backup Form */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ชื่อ Snapshot (ไม่ระบุได้)"
                value={customBackupName}
                onChange={(e) => setCustomBackupName(e.target.value)}
                className="h-10 px-3 text-xs border border-[#CBD5E1] rounded-xl focus:outline-[#FFB400] bg-white w-48"
              />
              <Button
                onClick={handleCreateSnapshot}
                disabled={isCreatingBackup || loading}
                className="h-10 text-xs font-semibold whitespace-nowrap"
              >
                {isCreatingBackup ? "กำลังสำรอง..." : "＋ สร้าง Backup ตอนนี้"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {snapshots.length === 0 ? (
            <div className="p-8 text-center bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-xl text-xs text-[#64748B]">
              ยังไม่มี Snapshot ที่บันทึกไว้ในระบบ
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">ชื่อ Backup</th>
                    <th className="py-3 px-4">ประเภท</th>
                    <th className="py-3 px-4">วันที่ / เวลา</th>
                    <th className="py-3 px-4 text-center">สถิติ (Cat / Les / Ref)</th>
                    <th className="py-3 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#1E293B]">
                  {snapshots.map((snap) => (
                    <tr key={snap.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                        <div>{snap.name}</div>
                        {snap.description && (
                          <div className="text-[11px] text-[#64748B] font-normal">{snap.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={snap.isAutoBackup ? "default" : "outline"}>
                          {snap.isAutoBackup ? "Auto Backup" : "Manual"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B]">
                        {new Date(snap.createdAt).toLocaleString("th-TH")}
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#475569] font-medium">
                        {snap.dataset.categories.length} / {snap.dataset.lessons.length} /{" "}
                        {snap.dataset.references.length}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openRestoreModal(snap)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                          >
                            กู้คืน
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSnapshot(snap.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors"
                          >
                            ดาวน์โหลด
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(snap)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DANGER ZONE: FACTORY RESET */}
      <Card className="border border-[#FECACA] bg-[#FEF2F2]/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-bold text-[#DC2626] uppercase tracking-wider mb-1">
            <span>⚠️ Danger Zone</span>
          </div>
          <CardTitle className="text-[#991B1B]">คืนค่าเริ่มต้นจากโรงงาน (Factory Reset)</CardTitle>
          <CardDescription className="text-[#7F1D1D]">
            ล้างข้อมูลคำศัพท์ หมวดหมู่ และการตั้งค่าที่กำหนดเองทั้งหมด แล้วกู้คืนกลับเป็น Seed Dataset ดั้งเดิมของระบบ
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[#991B1B] leading-relaxed">
            ระบบจะสร้าง Quick Backup ข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อนทำการ Reset
          </div>
          <Button
            variant="primary"
            onClick={openFactoryResetModal}
            disabled={loading}
            className="font-semibold whitespace-nowrap px-5 bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            🔄 คืนค่า Seed Data เริ่มต้น
          </Button>
        </CardContent>
      </Card>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-2">
              <h3
                id="confirm-modal-title"
                className={`text-lg font-bold ${
                  confirmModal.dangerLevel === "danger" ? "text-[#991B1B]" : "text-[#0F172A]"
                }`}
              >
                {confirmModal.title}
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">{confirmModal.message}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={isModalProcessing}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                onClick={handleModalConfirm}
                disabled={isModalProcessing}
                className={`font-semibold px-5 ${
                  confirmModal.dangerLevel === "danger"
                    ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                    : "bg-[#0F172A] text-white hover:bg-[#FFB400] hover:text-[#0F172A]"
                }`}
              >
                {isModalProcessing ? "กำลังดำเนินการ..." : "ยืนยันดำเนินการ"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
