"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Raporlar</h1>
        <p className="text-muted-foreground">
          Performans ve finansal raporlar
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raporlama</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Raporlama modülü yakında eklenecek</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

