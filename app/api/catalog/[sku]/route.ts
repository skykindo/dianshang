import { deleteProduct, getProduct, saveProduct, validateProduct } from "@/lib/catalog-store";
import { parseJsonBody } from "@/lib/http";

export async function PUT(request: Request, context: { params: Promise<{ sku: string }> }) {
  const { sku } = await context.params;
  const current = await getProduct(decodeURIComponent(sku));
  if (!current) return Response.json({ error: { code: "PRODUCT_NOT_FOUND", message: "商品不存在。" } }, { status: 404 });
  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const validated = validateProduct({ ...(parsed.value as object), sku: current.sku });
  if (!validated.ok) return Response.json({ error: { code: "INVALID_PRODUCT", message: validated.message } }, { status: 400 });
  return Response.json({ product: await saveProduct(validated.product) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ sku: string }> }) {
  const { sku } = await context.params;
  const deleted = await deleteProduct(decodeURIComponent(sku));
  if (!deleted) return Response.json({ error: { code: "PRODUCT_NOT_FOUND", message: "商品不存在。" } }, { status: 404 });
  return Response.json({ deleted: true });
}
