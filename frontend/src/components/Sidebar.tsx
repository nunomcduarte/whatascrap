"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  HouseSimple,
  FolderSimple,
  FolderSimpleDashed,
  Plus,
  X,
  CaretRight,
  DotsThree,
  PencilSimple,
  Trash,
  Palette,
  FolderPlus,
  Check,
} from "@phosphor-icons/react";
import { FOLDER_COLORS, type Category } from "@/lib/folders";
import { dotClass } from "./folderColor";

interface SidebarProps {
  categories: Category[];
  total: number;
  uncategorized: number;
  collapsed: boolean;
  onToggle: () => void;
}

interface TreeNode {
  cat: Category;
  children: TreeNode[];
  totalCount: number;
}

function buildTree(cats: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  cats.forEach((c) => map.set(c.name, { cat: c, children: [], totalCount: c.count }));
  const roots: TreeNode[] = [];
  cats.forEach((c) => {
    const node = map.get(c.name)!;
    if (c.parent && map.has(c.parent)) {
      map.get(c.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const accumulate = (n: TreeNode): number => {
    n.totalCount = n.cat.count + n.children.reduce((s, child) => s + accumulate(child), 0);
    return n.totalCount;
  };
  roots.forEach(accumulate);
  return roots;
}

export default function Sidebar({
  categories,
  total,
  uncategorized,
  collapsed,
}: SidebarProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeCategory = sp.get("category");
  const isUncategorized = sp.get("uncategorized") === "1";
  const isAll = !activeCategory && !isUncategorized;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const tree = useMemo(() => buildTree(categories), [categories]);

  const handleCreate = async (parent: string | null = null) => {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Folder name required.");
      return;
    }
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, parent }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create folder.");
      return;
    }
    setName("");
    setCreating(false);
    startTransition(() => router.refresh());
  };

  return (
    <aside
      className={`shrink-0 border-r border-white/[0.06] bg-[#0f0f0f] sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <nav className="py-3 px-2 flex flex-col gap-0.5">
        <SideLink
          href="/"
          active={isAll}
          icon={<HouseSimple size={22} weight={isAll ? "fill" : "regular"} />}
          label="All Videos"
          count={total}
          collapsed={collapsed}
        />
        <SideLink
          href="/?uncategorized=1"
          active={isUncategorized}
          icon={
            <FolderSimpleDashed
              size={22}
              weight={isUncategorized ? "fill" : "regular"}
            />
          }
          label="Uncategorized"
          count={uncategorized}
          collapsed={collapsed}
        />

        <div className="my-3 border-t border-white/[0.06]" />

        {!collapsed && (
          <div className="px-3 pb-1 pt-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
              Folders
            </span>
            <button
              onClick={() => {
                setCreating((c) => !c);
                setError("");
              }}
              aria-label="New folder"
              className="text-zinc-400 hover:text-zinc-50 hover:bg-white/[0.06] rounded-md p-1 transition-colors"
            >
              {creating ? <X size={14} /> : <Plus size={14} weight="bold" />}
            </button>
          </div>
        )}

        {!collapsed && creating && (
          <NewFolderInput
            value={name}
            error={error}
            onChange={setName}
            onSubmit={() => handleCreate(null)}
            onCancel={() => {
              setCreating(false);
              setName("");
              setError("");
            }}
          />
        )}

        <div className="flex flex-col gap-0.5">
          {tree.map((node) => (
            <FolderTreeNode
              key={node.cat.name}
              node={node}
              depth={0}
              activeCategory={activeCategory}
              collapsed={collapsed}
            />
          ))}
          {!collapsed && tree.length === 0 && !creating && (
            <p className="text-xs text-zinc-500 px-3 py-2 leading-relaxed">
              No folders yet. Create one to organize your library.
            </p>
          )}
        </div>
      </nav>
    </aside>
  );
}

function SideLink({
  href,
  active,
  icon,
  label,
  count,
  collapsed,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-4 px-3 py-2 rounded-xl transition-all duration-150 ${
        active
          ? "bg-white/[0.10] text-zinc-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
          : "text-zinc-200 hover:bg-white/[0.06] hover:text-zinc-50"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <span className="shrink-0 text-zinc-200">{icon}</span>
      {!collapsed && (
        <span className="flex-1 text-sm font-medium tracking-tight truncate">
          {label}
        </span>
      )}
      {!collapsed && (
        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

function NewFolderInput({
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "Folder name",
  autoFocus = true,
}: {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="px-2 pb-2 pt-1">
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="w-full bg-[#272727] border border-white/[0.08] rounded-md px-3 py-1.5
                   text-sm text-zinc-50 placeholder:text-zinc-500
                   focus:outline-none focus:border-white/20"
      />
      {error && <p className="text-[11px] text-red-400 mt-1 px-1">{error}</p>}
      <div className="flex gap-1 mt-1.5">
        <button
          onClick={onSubmit}
          className="text-xs bg-zinc-50 text-zinc-950 px-3 py-1 rounded-md
                     hover:bg-zinc-200 active:scale-[0.98] transition-all"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-400 px-3 py-1 hover:text-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FolderTreeNode({
  node,
  depth,
  activeCategory,
  collapsed,
}: {
  node: TreeNode;
  depth: number;
  activeCategory: string | null;
  collapsed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [renameValue, setRenameValue] = useState(node.cat.name);
  const [childName, setChildName] = useState("");
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const active = activeCategory === node.cat.name;
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    setRenameValue(node.cat.name);
  }, [node.cat.name]);

  const refresh = () => router.refresh();

  const handleRename = async () => {
    setError("");
    const next = renameValue.trim();
    if (!next) {
      setError("Name required.");
      return;
    }
    if (next === node.cat.name) {
      setRenaming(false);
      return;
    }
    const res = await fetch(
      `/api/categories/${encodeURIComponent(node.cat.name)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Rename failed.");
      return;
    }
    setRenaming(false);
    if (activeCategory === node.cat.name) {
      router.push(`/?category=${encodeURIComponent(next)}`);
    } else {
      refresh();
    }
  };

  const handleSetColor = async (color: string | null) => {
    setPickingColor(false);
    await fetch(`/api/categories/${encodeURIComponent(node.cat.name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    refresh();
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete folder "${node.cat.name}"? Videos move to Uncategorized; sub-folders become top-level.`
      )
    ) {
      return;
    }
    await fetch(`/api/categories/${encodeURIComponent(node.cat.name)}`, {
      method: "DELETE",
    });
    if (activeCategory === node.cat.name) router.push("/");
    else refresh();
  };

  const handleAddChild = async () => {
    setError("");
    const trimmed = childName.trim();
    if (!trimmed) {
      setError("Name required.");
      return;
    }
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, parent: node.cat.name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create.");
      return;
    }
    setChildName("");
    setAddingChild(false);
    setOpen(true);
    refresh();
  };

  const href = `/?category=${encodeURIComponent(node.cat.name)}`;
  const indent = collapsed ? 0 : depth * 12;

  return (
    <div className="flex flex-col">
      {renaming ? (
        <div style={{ paddingLeft: indent }}>
          <NewFolderInput
            value={renameValue}
            error={error}
            onChange={setRenameValue}
            onSubmit={handleRename}
            onCancel={() => {
              setRenaming(false);
              setRenameValue(node.cat.name);
              setError("");
            }}
            placeholder="Rename folder"
          />
        </div>
      ) : (
        <div
          className={`group relative flex items-stretch rounded-lg transition-colors ${
            active ? "bg-[#272727]" : "hover:bg-white/[0.06]"
          }`}
          style={{ paddingLeft: indent }}
        >
          {!collapsed && hasChildren ? (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Collapse" : "Expand"}
              className="px-1.5 text-zinc-400 hover:text-zinc-100 transition"
            >
              <CaretRight
                size={12}
                weight="bold"
                className={`transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            !collapsed && <span className="w-[22px]" aria-hidden="true" />
          )}

          <Link
            href={href}
            title={collapsed ? node.cat.name : undefined}
            className={`flex-1 flex items-center gap-3 px-2 py-2 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <span
              className={`shrink-0 inline-block h-2.5 w-2.5 rounded-full ${dotClass(
                node.cat.color
              )}`}
              aria-hidden="true"
            />
            <FolderSimple
              size={18}
              weight={active ? "fill" : "regular"}
              className="text-zinc-300 shrink-0"
            />
            {!collapsed && (
              <>
                <span className="flex-1 text-sm font-medium text-zinc-100 tracking-tight truncate">
                  {node.cat.name}
                </span>
                <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                  {node.totalCount}
                </span>
              </>
            )}
          </Link>

          {!collapsed && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setPickingColor(false);
                }}
                aria-label={`Actions for ${node.cat.name}`}
                className="opacity-0 group-hover:opacity-100 px-2 text-zinc-400 hover:text-zinc-50 transition"
              >
                <DotsThree size={18} weight="bold" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-lg bg-[#282828] border border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1.5">
                  {pickingColor ? (
                    <ColorPicker
                      current={node.cat.color}
                      onPick={handleSetColor}
                      onBack={() => setPickingColor(false)}
                    />
                  ) : (
                    <>
                      <MenuItem
                        icon={<PencilSimple size={14} />}
                        label="Rename"
                        onClick={() => {
                          setRenaming(true);
                          setMenuOpen(false);
                        }}
                      />
                      <MenuItem
                        icon={<Palette size={14} />}
                        label="Set color"
                        onClick={() => setPickingColor(true)}
                      />
                      <MenuItem
                        icon={<FolderPlus size={14} />}
                        label="New sub-folder"
                        onClick={() => {
                          setAddingChild(true);
                          setMenuOpen(false);
                          setOpen(true);
                        }}
                      />
                      <div className="my-1 border-t border-white/[0.06]" />
                      <MenuItem
                        icon={<Trash size={14} />}
                        label="Delete"
                        danger
                        onClick={() => {
                          setMenuOpen(false);
                          handleDelete();
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!collapsed && addingChild && (
        <div style={{ paddingLeft: indent + 22 }}>
          <NewFolderInput
            value={childName}
            error={error}
            onChange={setChildName}
            onSubmit={handleAddChild}
            onCancel={() => {
              setAddingChild(false);
              setChildName("");
              setError("");
            }}
            placeholder="Sub-folder name"
          />
        </div>
      )}

      {open && hasChildren && !collapsed && (
        <div className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.cat.name}
              node={child}
              depth={depth + 1}
              activeCategory={activeCategory}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
        danger
          ? "text-red-300 hover:bg-red-500/10"
          : "text-zinc-100 hover:bg-white/[0.06]"
      }`}
    >
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function ColorPicker({
  current,
  onPick,
  onBack,
}: {
  current: string | null;
  onPick: (color: string | null) => void;
  onBack: () => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
          Folder color
        </span>
        <button
          onClick={onBack}
          className="text-[11px] text-zinc-400 hover:text-zinc-100"
        >
          Back
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => onPick(null)}
          aria-label="No color"
          className="relative h-7 w-7 rounded-full bg-zinc-700 ring-1 ring-white/10 hover:scale-110 transition flex items-center justify-center"
        >
          {current === null && <Check size={12} className="text-zinc-200" />}
        </button>
        {FOLDER_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onPick(color)}
            aria-label={`Color ${color}`}
            className={`relative h-7 w-7 rounded-full ring-1 ring-white/10 hover:scale-110 transition flex items-center justify-center ${dotClass(
              color
            )}`}
          >
            {current === color && (
              <Check size={12} className="text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
