"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FolderTree, Plus, Trash2, ChevronRight, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import {
  getCategoryTree,
  createCategoryOnBackend,
  updateCategoryOnBackend,
  deleteCategoryOnBackend,
  CategoryNode,
  CreateCategoryPayload,
} from "@/lib/api/categories";
import { useToast } from "@/hooks/use-toast";

type CategoriesModuleProps = {
  token: string;
  has: (permission: string) => boolean;
};

export function CategoriesModule({ token }: CategoriesModuleProps) {
  const { toast } = useToast();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CreateCategoryPayload>({
    name: "",
    description: "",
    icon: "Shirt",
    parentId: null,
    order: 0,
    active: true,
    showInNav: true,
  });

  useEffect(() => {
    loadTree();
  }, []);

  async function loadTree() {
    setLoading(true);
    try {
      setTree(await getCategoryTree());
    } catch {
      toast({ title: "Error", description: "Failed to load categories", variant: "destructive" });
    }
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      toast({ title: "Missing name", description: "Category name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await createCategoryOnBackend(token, form);
      if (result.success) {
        toast({ title: "Created", description: `Category "${form.name}" added` });
        setShowForm(false);
        setForm({ name: "", description: "", icon: "Shirt", parentId: null, order: 0, active: true, showInNav: true });
        loadTree();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create category", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleToggleActive(cat: CategoryNode) {
    const result = await updateCategoryOnBackend(token, cat.id, { active: !cat.active });
    if (result.success) loadTree();
  }

  async function handleToggleNav(cat: CategoryNode) {
    const result = await updateCategoryOnBackend(token, cat.id, { showInNav: !cat.showInNav });
    if (result.success) loadTree();
  }

  async function handleDelete(cat: CategoryNode) {
    const hasChildren = (cat.children || []).length > 0;
    const msg = hasChildren
      ? `Delete "${cat.name}" AND its ${cat.children!.length} sub-categories? Products will be un-categorized (not deleted).`
      : `Delete "${cat.name}"? Products in it will be un-categorized (not deleted).`;
    if (!confirm(msg)) return;
    const result = await deleteCategoryOnBackend(token, cat.id, hasChildren);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      loadTree();
    } else {
      toast({ title: "Cannot delete", description: result.message, variant: "destructive" });
    }
  }

  // Flatten roots for the "parent" dropdown in the create form.
  const flatForParent: { id: string; label: string }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const n of nodes) {
      flatForParent.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name}` });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);

  function renderNode(cat: CategoryNode, depth: number) {
    const hasChildren = (cat.children || []).length > 0;
    const isOpen = expanded.has(cat.id);
    return (
      <div key={cat.id}>
        <div
          className="flex items-center justify-between rounded-lg border px-3 py-2.5 mb-1.5 hover:bg-muted/40 transition-colors"
          style={{ marginLeft: depth * 20 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button onClick={() => toggleExpand(cat.id)} className="text-muted-foreground shrink-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="font-medium truncate">{cat.name}</span>
            <span className="text-xs text-muted-foreground font-mono shrink-0">/{cat.slug}</span>
            <Badge variant="secondary" className="text-xs shrink-0">{cat.productCount} products</Badge>
            {!cat.active && <Badge variant="outline" className="text-xs shrink-0">Hidden</Badge>}
            {!cat.showInNav && <Badge variant="outline" className="text-xs shrink-0">Not in nav</Badge>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5" title="Active">
              <Switch checked={cat.active} onCheckedChange={() => handleToggleActive(cat)} />
            </div>
            <button
              className="text-destructive hover:text-destructive/80"
              onClick={() => handleDelete(cat)}
              title="Delete category"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {hasChildren && isOpen && cat.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderTree className="h-6 w-6" /> Category Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Organize products into a nested category tree. Changes reflect across the storefront and navigation.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> New Category
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Create Category</CardTitle>
            <CardDescription>Add a top-level category or a sub-category under an existing one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Anime Collection" />
              </div>
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.parentId || ""}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                >
                  <option value="">— Top-level (no parent) —</option>
                  {flatForParent.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.active !== false} onCheckedChange={(c) => setForm({ ...form, active: c })} />
                <Label className="cursor-pointer">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.showInNav !== false} onCheckedChange={(c) => setForm({ ...form, showInNav: c })} />
                <Label className="cursor-pointer">Show in navigation</Label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create Category"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading categories...</div>
      ) : tree.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-1">No categories yet.</p>
            <p className="text-xs text-muted-foreground">
              Run <code className="bg-muted px-1 rounded">npm run db:migrate-categories</code> to seed the tree, or create one above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            {tree.map((root) => renderNode(root, 0))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
