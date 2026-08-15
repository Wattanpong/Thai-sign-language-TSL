"use client";

import * as React from "react";
import Link from "next/link";
import { Category, Lesson } from "@/types";
import {
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { getCategories } from "@/lib/storage/categoryStorage";
import { getLessons } from "@/lib/storage/lessonStorage";

interface DictionaryBrowserProps {
  initialCategories: Category[];
  initialWords: Lesson[];
}

export function DictionaryBrowser({
  initialCategories,
  initialWords,
}: DictionaryBrowserProps) {
  const [categories, setCategories] = React.useState<Category[]>(initialCategories);
  const [words, setWords] = React.useState<Lesson[]>(initialWords);
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  // Sync with storage on mount and storage changes
  React.useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [loadedCats, loadedLessons] = await Promise.all([
          getCategories(),
          getLessons(),
        ]);
        if (isMounted) {
          setCategories(loadedCats);
          setWords(loadedLessons);
        }
      } catch {
        // keep initial
      }
    };

    loadData();

    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const getCategoryName = React.useCallback(
    (catId: string) => {
      const cat = categories.find((c) => c.id === catId);
      return cat ? cat.name : catId;
    },
    [categories]
  );

  // Filter words by search term and selected category
  const filteredWords = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return words.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.categoryId === selectedCategory;

      if (!matchesCategory) return false;
      if (!term) return true;

      const wordMatch = item.word.toLowerCase().includes(term);
      const descMatch = item.description?.toLowerCase().includes(term);
      const idMatch = item.id.toLowerCase().includes(term);
      const catName = getCategoryName(item.categoryId).toLowerCase();
      const catMatch = catName.includes(term);

      return wordMatch || descMatch || idMatch || catMatch;
    });
  }, [words, searchTerm, selectedCategory, getCategoryName]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Search & Filter Section */}
      <div className="space-y-3">
        <div className="max-w-xl">
          <Input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาคำศัพท์ เช่น สวัสดี, ขอบคุณ..."
            helperText="พิมพ์คำศัพท์ภาษาไทย คำอธิบาย หรือเลือกหมวดหมู่"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5" role="tablist" aria-label="กรองตามหมวดหมู่">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              selectedCategory === "all"
                ? "bg-[#0F172A] text-white font-medium shadow-xs"
                : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
            }`}
          >
            ทั้งหมด ({words.length})
          </button>
          {categories.map((cat) => {
            const count = words.filter((w) => w.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0F172A] text-white font-medium shadow-xs"
                    : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 text-xs text-[#64748B]">
        <span>
          พบคำศัพท์ <strong className="text-[#0F172A]">{filteredWords.length}</strong> คำ
          {searchTerm && <span> สำหรับคำค้น &quot;{searchTerm}&quot;</span>}
        </span>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="text-xs text-[#0284C7] hover:underline cursor-pointer"
          >
            ล้างคำค้น
          </button>
        )}
      </div>

      {/* Word Cards Grid */}
      {filteredWords.length === 0 ? (
        <div className="p-8 sm:p-10 text-center bg-white rounded-2xl border border-[#E2E8F0] space-y-2.5">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto text-lg">
            🔍
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-semibold text-[#0F172A]">
              ไม่พบคำศัพท์ที่ค้นหา
            </h3>
            <p className="text-xs text-[#64748B]">
              ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
            }}
          >
            แสดงคำศัพท์ทั้งหมด
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredWords.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col justify-between hover:border-[#CBD5E1] transition-colors group"
            >
              <CardHeader className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={
                      item.gestureType === "dynamic" ? "primary" : "outline"
                    }
                  >
                    {item.gestureType === "dynamic" ? "ท่าทางต่อเนื่อง" : "ท่าทางคงที่"}
                  </Badge>
                  <span className="text-xs text-[#94A3B8]">
                    {getCategoryName(item.categoryId)}
                  </span>
                </div>
                <CardTitle className="text-sm sm:text-base text-[#0F172A]">
                  {item.word}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs line-clamp-2">
                  {item.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 flex items-center gap-2">
                <Link href={`/lessons/${item.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs font-medium">
                    ดูบทเรียน
                  </Button>
                </Link>
                <Link href={`/practice?lesson=${item.id}`} className="flex-1">
                  <Button size="sm" className="w-full text-xs font-medium">
                    ฝึกท่าทาง →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
