type JsonSchema = {
  type?: unknown;
  required?: unknown;
  properties?: unknown;
};

export function validateToolInput(schema: Record<string, unknown>, input: unknown): string[] {
  const definition = schema as JsonSchema;
  if (definition.type === "object" && (!input || typeof input !== "object" || Array.isArray(input))) {
    return ["input 必须是对象。"]; 
  }
  const value = input as Record<string, unknown>;
  const errors: string[] = [];
  const required = Array.isArray(definition.required) ? definition.required.filter((item): item is string => typeof item === "string") : [];
  const properties = definition.properties && typeof definition.properties === "object"
    ? definition.properties as Record<string, { type?: unknown }>
    : {};

  for (const key of required) {
    if (!(key in value) || value[key] === undefined || value[key] === null || value[key] === "") errors.push(`input.${key} 是必填字段。`);
  }
  for (const [key, property] of Object.entries(properties)) {
    if (!(key in value) || value[key] === undefined || value[key] === null || typeof property.type !== "string") continue;
    const actual = Array.isArray(value[key]) ? "array" : typeof value[key];
    if (actual !== property.type) errors.push(`input.${key} 必须是 ${property.type}。`);
  }
  return errors;
}
