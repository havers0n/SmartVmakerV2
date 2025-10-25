"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your factory settings have been updated",
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Factory Settings</h1>
        <p className="text-sm text-muted-foreground">Configure API keys, limits, and webhooks</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">API Keys</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="openai-key" className="text-sm font-medium mb-2 block">OpenAI API Key</Label>
            <Input id="openai-key" type="password" placeholder="sk-..." />
          </div>
          <div>
            <Label htmlFor="gemini-key" className="text-sm font-medium mb-2 block">Gemini API Key</Label>
            <Input id="gemini-key" type="password" placeholder="AIza..." />
          </div>
          <div>
            <Label htmlFor="minimax-key" className="text-sm font-medium mb-2 block">MiniMax API Key (Hailuo)</Label>
            <Input id="minimax-key" type="password" placeholder="..." />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </Card>
    </div>
  );
}