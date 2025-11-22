"use client";

import { useQuery } from "@tanstack/react-query";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Loader2 } from "lucide-react";
import { listModels, ModelType, ModelWithProvider } from "@/shared/api/actions";
import { Badge } from "@/shared/components/ui/badge";

export interface ModelSelectorProps {
  /**
   * Type of AI model to filter by (e.g., 'text-to-text', 'text-to-image')
   */
  type: ModelType;

  /**
   * Label to display above the selector
   */
  label: string;

  /**
   * Optional placeholder text
   */
  placeholder?: string;

  /**
   * Currently selected model ID
   */
  value: string | null;

  /**
   * Callback when model selection changes
   */
  onChange: (modelId: string | null) => void;

  /**
   * Optional test ID for the selector
   */
  testId?: string;
}

/**
 * ModelSelector - Reusable component for selecting AI models by type
 *
 * Fetches available models from the backend and displays them in a dropdown.
 * Shows provider information and capabilities for each model.
 */
export function ModelSelector({
  type,
  label,
  placeholder = "Select a model...",
  value,
  onChange,
  testId,
}: ModelSelectorProps) {
  const { data: models = [], isLoading, error } = useQuery<ModelWithProvider[]>({
    queryKey: ["models", type],
    queryFn: () => listModels(type),
  });

  // Find the default model to use as initial selection if no value is set
  const defaultModel = models.find((m) => m.isDefault);

  // If no value is set and we have a default model, use it
  if (!value && defaultModel && models.length > 0) {
    onChange(defaultModel.id);
  }

  return (
    <div>
      <Label htmlFor={`model-${type}`} className="text-sm font-medium mb-2 block">
        {label}
      </Label>

      {error ? (
        <div className="text-sm text-destructive">
          Failed to load models: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading models...</span>
        </div>
      ) : models.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
          No models available for type: {type}
        </div>
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger
            id={`model-${type}`}
            className="h-10"
            data-testid={testId}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({model.providerName})
                  </span>
                  {model.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {value && models.length > 0 && (
        <div className="mt-2">
          {(() => {
            const selectedModel = models.find((m) => m.id === value);
            if (!selectedModel) return null;

            return (
              <div className="text-xs text-muted-foreground">
                <div className="flex gap-2 flex-wrap">
                  {selectedModel.capabilities && selectedModel.capabilities.length > 0 && (
                    <>
                      <span>Capabilities:</span>
                      {selectedModel.capabilities.map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
