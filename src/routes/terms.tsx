import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Murandasi Shop" },
      {
        name: "description",
        content: "Terms and conditions for using Murandasi Shop.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-sm font-semibold text-accent hover:underline">
        ← Back to Murandasi Shop
      </Link>
      <h1 className="mt-6 text-3xl font-black">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: August 31, 2026
      </p>

      <div className="mt-8 space-y-7 text-sm leading-7 text-foreground">
        <section>
          <h2 className="text-xl font-bold">1. About Murandasi Shop</h2>
          <p className="mt-2">
            Murandasi Shop is an online marketplace for browsing and purchasing
            products. By using this website, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">2. Accounts</h2>
          <p className="mt-2">
            You are responsible for keeping your account information secure and
            for providing accurate information when creating an account or
            placing an order. Google Sign-In may be used to create or access
            your Murandasi Shop account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">3. Orders and payments</h2>
          <p className="mt-2">
            Product prices, availability, and order totals are shown at
            checkout. Payments may be processed through Mobile Money and other
            payment services displayed by Murandasi Shop. An order is
            confirmed after successful payment verification.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">4. Delivery</h2>
          <p className="mt-2">
            Customers must provide an accurate delivery address or location.
            Delivery times may vary by location and product availability.
            Customers should confirm delivery after receiving an order.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">5. Cashback and referrals</h2>
          <p className="mt-2">
            Cashback and referral rewards are subject to the offers and
            conditions displayed on the website. Cashback may require delivery
            confirmation and may expire if the applicable confirmation period
            ends.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">6. Acceptable use</h2>
          <p className="mt-2">
            Do not misuse the website, submit false information, interfere with
            payment processing, or attempt unauthorized access to another
            account or system.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">7. Changes and contact</h2>
          <p className="mt-2">
            We may update these terms when the service changes. Continued use
            of Murandasi Shop after an update means you accept the revised
            terms. For questions, contact Murandasi Shop through the support
            contact provided on the website.
          </p>
        </section>
      </div>
    </main>
  );
}
