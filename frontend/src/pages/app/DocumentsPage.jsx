"use client";

import { FileText, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dokümanlar</h1>
          <p className="text-muted-foreground">
            Hasta dokümanları ve onam formları
          </p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Dosya Yükle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doküman Yönetimi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Doküman yönetimi modülü yakında eklenecek</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

