"use client";

import { MessageSquare, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">İletişim</h1>
          <p className="text-muted-foreground">
            SMS, WhatsApp ve e-posta yönetimi
          </p>
        </div>
        <Button>
          <Send className="mr-2 h-4 w-4" />
          Mesaj Gönder
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İletişim Merkezi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>İletişim modülü yakında eklenecek</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

