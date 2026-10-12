import { getProduct, listProducts, saveProduct, validateProduct } from "@/lib/catalog-store";
import { parseJsonBody } from "@/lib/http";

export async function GET() { return Response.json({ products: await listProducts() }); }

export async function POST(request: Request) {
  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const validated = validateProduct(parsed.value);
  if (!validated.ok) return Response.json({ error: { code: "INVALID_PRODUCT", message: validated.message } }, { status: 400 });
  if (await getProduct(validated.product.sku)) return Response.json({ error: { code: "PRODUCT_EXISTS", message: "SKU 已存在。" } }, { status: 409 });
  return Response.json({ product: await saveProduct(validated.product) }, { status: 201 });
}
