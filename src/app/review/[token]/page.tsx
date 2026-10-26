import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let failed = false;
  const review = await prisma.reviewRequest
    .findUnique({ where: { reviewToken: token }, select: { id: true } })
    .catch(() => {
      failed = true;
      return null;
    });
  const invalid = !failed && !review;
  const { name: shopName } = await getBranding();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {failed
            ? "Something went wrong on our end"
            : invalid
              ? "This review link isn't valid"
              : `Thank you for choosing ${shopName}!`}
        </h1>
        <p className="text-sm text-gray-600">
          {failed
            ? "Please try this link again in a few minutes."
            : invalid
              ? "The link may be mistyped or expired. Please contact the shop if you'd like to leave feedback."
              : "We appreciate your business and your feedback."}
        </p>
      </div>
    </main>
  );
}
