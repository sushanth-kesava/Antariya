"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AboutPageContent, getAboutPageContentFromBackend, updateAboutPageContentOnBackend } from "@/lib/api/site-content";
import { uploadProductImagesToBackend } from "@/lib/api/products";

const emptyDraft = (): AboutPageContent => ({
  heroTitle: "Empowering India's Embroidery Industry",
  heroSubtitle: "Transforming how embroidery professionals access premium digital assets, physical supplies, and machine solutions for their growing businesses.",
  storyTitle: "Every Thread Has a Story",
  storyBody: [],
  teamMembers: [
    { name: "Sushanth Kesava", role: "CEO & Founder", email: "", phone: "", bio: "Leading Antariya’s growth strategy, product vision, and brand experience across India.", imageUrl: "" },
    { name: "Asha Rao", role: "Head of Operations", email: "", phone: "", bio: "Driving fulfillment quality, vendor relationships, and day-to-day execution.", imageUrl: "" },
    { name: "Rahul Verma", role: "Product & Design Lead", email: "", phone: "", bio: "Shaping the platform experience and customer-facing product storytelling.", imageUrl: "" },
  ],
  contactEmail: "antariyaofficial@gmail.com",
  contactPhone: "+91 70132 96469",
  whatsapp: "https://wa.me/917013296469",
});

export function SiteContentModule({ token }: { token: string }) {
  const [draft, setDraft] = useState<AboutPageContent>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAboutPageContentFromBackend()
      .then((content) => {
        if (!mounted) return;
        setDraft({
          ...emptyDraft(),
          ...content,
          teamMembers: content.teamMembers?.length ? content.teamMembers : emptyDraft().teamMembers,
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load page content");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const updateTeamMember = (index: number, key: keyof NonNullable<AboutPageContent["teamMembers"]>[number], value: string) => {
    setDraft((current) => {
      const nextMembers = [...(current.teamMembers || [])];
      nextMembers[index] = { ...nextMembers[index], [key]: value };
      return { ...current, teamMembers: nextMembers };
    });
  };

  const addTeamMember = () => {
    setDraft((current) => ({
      ...current,
      teamMembers: [...(current.teamMembers || []), { name: "", role: "", email: "", phone: "", bio: "", imageUrl: "" }],
    }));
  };

  const removeTeamMember = (index: number) => {
    setDraft((current) => ({ ...current, teamMembers: (current.teamMembers || []).filter((_, currentIndex) => currentIndex !== index) }));
  };

  const handleMemberPhotoUpload = async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingIndex(index);
      setError(null);
      const uploaded = await uploadProductImagesToBackend(token, [file]);
      const imageUrl = uploaded[0] || "";
      setDraft((current) => {
        const nextMembers = [...(current.teamMembers || [])];
        nextMembers[index] = { ...nextMembers[index], imageUrl };
        return { ...current, teamMembers: nextMembers };
      });
      setSuccess("Team photo uploaded. Save changes to publish it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload: Partial<AboutPageContent> = {
        teamMembers: (draft.teamMembers || []).map((member) => ({
          name: member.name?.trim() || "",
          role: member.role?.trim() || "",
          email: member.email?.trim() || "",
          phone: member.phone?.trim() || "",
          bio: member.bio?.trim() || "",
          imageUrl: member.imageUrl?.trim() || "",
        })),
      };
      await updateAboutPageContentOnBackend(token, payload);
      setSuccess("Team members updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update content");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> About / Team Content
        </CardTitle>
        <CardDescription>Manage the team cards shown on the public About Us page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {success && <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700">{success}</div>}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading content…
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Team members</p>
                  <p className="text-xs text-muted-foreground">Each card will appear on the public About Us page. You can add, edit, or remove team members here.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTeamMember} className="gap-1">
                  <Plus className="h-4 w-4" /> Add member
                </Button>
              </div>

              {(draft.teamMembers || []).map((member, index) => (
                <div key={`${member.name}-${index}`} className="rounded-xl border border-border bg-background p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Member {index + 1}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTeamMember(index)} className="gap-1 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Full name" value={member.name || ""} onChange={(e) => updateTeamMember(index, "name", e.target.value)} />
                    <Input placeholder="Role" value={member.role || ""} onChange={(e) => updateTeamMember(index, "role", e.target.value)} />
                    <Input placeholder="Email" value={member.email || ""} onChange={(e) => updateTeamMember(index, "email", e.target.value)} />
                    <Input placeholder="Phone" value={member.phone || ""} onChange={(e) => updateTeamMember(index, "phone", e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                        {member.imageUrl ? (
                          <img src={member.imageUrl} alt={member.name || "team member"} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold uppercase">No photo</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Profile photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleMemberPhotoUpload(index, e.target.files?.[0])}
                          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
                        />
                      </div>
                      {member.imageUrl ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateTeamMember(index, "imageUrl", "")} className="shrink-0 text-destructive hover:text-destructive">
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    {uploadingIndex === index ? <p className="text-xs text-muted-foreground">Uploading photo...</p> : null}
                  </div>
                  <Textarea placeholder="Short bio" value={member.bio || ""} onChange={(e) => updateTeamMember(index, "bio", e.target.value)} rows={3} />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleSave()} disabled={saving} className="gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save changes</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
