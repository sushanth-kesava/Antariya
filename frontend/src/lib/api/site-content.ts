import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

export type TeamMemberContent = {
  name: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  imageUrl: string;
};

export type AboutPageContent = {
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyBody: string[];
  teamMembers: TeamMemberContent[];
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  updatedBy?: string;
};

export async function getAboutPageContentFromBackend(): Promise<AboutPageContent> {
  const response = await fetch(`${API_BASE_URL}/site-content/about`, {
    credentials: "include",
  });
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load about page content");
  }

  return (data.content || {}) as AboutPageContent;
}

export async function updateAboutPageContentOnBackend(token: string, payload: Partial<AboutPageContent>): Promise<AboutPageContent> {
  const response = await fetch(`${API_BASE_URL}/site-content/about`, {
    credentials: "include",
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to update about page content");
  }

  return (data.content || {}) as AboutPageContent;
}
