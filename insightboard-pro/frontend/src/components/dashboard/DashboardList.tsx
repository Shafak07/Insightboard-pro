"use client";

import { Copy, LayoutDashboard, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { toast } from "@/hooks/use-toast";
import {
  createDashboard,
  deleteDashboard,
  duplicateDashboard,
  listDashboards,
  type DashboardListPage,
  type DashboardSummary,
} from "@/lib/dashboards";

const PAGE_SIZE = 12;

function DashboardCard({
  d,
  isDeleting,
  onDuplicate,
  onDelete,
}: {
  d: DashboardSummary;
  isDeleting: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="group transition hover:border-indigo-500/30 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">
            <Link
              href={`/dashboard/builder/${d.id}`}
              prefetch
              className="hover:text-indigo-300"
            >
              {d.title}
            </Link>
          </CardTitle>
          {d.is_public ? (
            <Badge variant="success" className="shrink-0 text-[10px]">
              Public
            </Badge>
          ) : (
            <Badge variant="muted" className="shrink-0 text-[10px]">
              Private
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {d.widget_count} widgets · {d.view_count} views
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button className="flex-1" size="sm" asChild>
          <Link href={`/dashboard/builder/${d.id}`} prefetch>
            Open builder
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onDuplicate(d.id)}
          aria-label="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-red-400"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(d.id);
          }}
          aria-label="Delete"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardList({
  initialData,
}: {
  initialData?: DashboardListPage | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const deletingIdsRef = useRef(new Set<string>());
  const [deletingIds, setDeletingIds] = useState(() => new Set<string>());

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["dashboards"],
    queryFn: ({ pageParam }) => listDashboards(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    initialData: initialData
      ? {
          pages: [initialData],
          pageParams: [1],
        }
      : undefined,
    staleTime: 30_000,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const dash = await createDashboard();
      toast({ title: "Dashboard created", description: "Opening builder…" });
      router.push(`/dashboard/builder/${dash.id}`);
    } catch (e) {
      toast({
        title: "Could not create dashboard",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingIdsRef.current.has(id)) return;
    if (!confirm("Delete this dashboard?")) return;

    deletingIdsRef.current.add(id);
    setDeletingIds(new Set(deletingIdsRef.current));

    try {
      await deleteDashboard(id);
      queryClient.setQueryData<{ pages: DashboardListPage[]; pageParams: number[] }>(
        ["dashboards"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((d) => d.id !== id),
              total: Math.max(0, page.total - 1),
            })),
          };
        }
      );
      toast({ title: "Dashboard deleted" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
        toast({ title: "Dashboard deleted" });
      } else {
        toast({
          title: "Could not delete dashboard",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      deletingIdsRef.current.delete(id);
      setDeletingIds(new Set(deletingIdsRef.current));
    }
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateDashboard(id);
    toast({ title: "Dashboard duplicated" });
    router.push(`/dashboard/builder/${copy.id}`);
  };

  if (isLoading && !items.length) {
    return <DashboardSkeleton count={6} />;
  }

  if (isError) {
    return (
      <p className="text-sm text-red-400">Could not load dashboards. Try refreshing.</p>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-indigo-500/20">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <LayoutDashboard className="mb-4 h-14 w-14 text-indigo-400/70" />
          <h3 className="text-lg font-medium">Create your first dashboard</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Drag charts, metrics, and text into a layout you can share with one
            click.
          </p>
          <Button
            className="mt-6 bg-indigo-600 hover:bg-indigo-500"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="bg-indigo-600 hover:bg-indigo-500"
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New dashboard
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <DashboardCard
            key={d.id}
            d={d}
            isDeleting={deletingIds.has(d.id)}
            onDuplicate={(id) => void handleDuplicate(id)}
            onDelete={(id) => void handleDelete(id)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage ? (
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        ) : null}
      </div>
    </div>
  );
}
