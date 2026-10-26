// Bottom grid: description & delivery details, refund policy, authorization.

export default function ProductDetailCards({
  product,
}: {
  product: {
    description: string;
    delivery_details: string;
    refund_policy: string;
    ownership_note: string;
  };
}) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-2 text-sm font-bold">📝 Description &amp; delivery details</h2>
        <p className="whitespace-pre-line text-xs leading-relaxed text-gray-300">
          {product.description || "No description provided."}
        </p>
        {product.delivery_details && (
          <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-gray-400">
            <span className="font-semibold text-white">Delivery details: </span>
            {product.delivery_details}
          </p>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-2 text-sm font-bold">↩️ Refund policy</h2>
          <p className="text-xs leading-relaxed text-gray-300">{product.refund_policy}</p>
        </div>
        {product.ownership_note && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-2 text-sm font-bold">✅ Authorization</h2>
            <p className="text-xs leading-relaxed text-gray-300">{product.ownership_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
