"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Wrench } from "lucide-react";

export function ComingSoonModule({
  title,
  description,
  capabilities,
}: {
  title: string;
  description: string;
  capabilities: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              This module is wired into the permission engine. Planned capabilities:
            </p>
            <ul className="space-y-2">
              {capabilities.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary/70" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Access to each action here is already governed by the roles &amp; permissions you
            configure in the Governance module.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
