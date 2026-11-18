import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { formEncode, membershipColumns, signPayload, verifyStripeSignature } from "./stripe.ts";

Deno.test("formEncode uses Stripe's bracket syntax", () => {
  const s = formEncode({
    mode: "subscription",
    line_items: [{ price: "price_123", quantity: 1 }],
    subscription_data: { metadata: { user_id: "u1" } },
    skipped: undefined,
  });
  assertEquals(
    decodeURIComponent(s),
    "mode=subscription&line_items[0][price]=price_123&line_items[0][quantity]=1&subscription_data[metadata][user_id]=u1",
  );
});

Deno.test("verifyStripeSignature accepts a correct signature and rejects tampering", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1","type":"customer.subscription.updated"}';
  const t = 1_700_000_000;
  const v1 = await signPayload(secret, t, payload);
  const header = `t=${t},v1=${v1}`;
  assert(await verifyStripeSignature(payload, header, secret, t + 10));
  assert(!(await verifyStripeSignature(payload + " ", header, secret, t + 10)), "tampered body");
  assert(!(await verifyStripeSignature(payload, header, "whsec_other", t + 10)), "wrong secret");
  assert(!(await verifyStripeSignature(payload, header, secret, t + 3600)), "replayed too late");
  assert(!(await verifyStripeSignature(payload, null, secret, t)), "missing header");
  assert(await verifyStripeSignature(payload, `t=${t},v1=deadbeef,v1=${v1}`, secret, t), "any v1 may match");
});

Deno.test("membershipColumns reads the period end from either API shape", () => {
  const old = membershipColumns({ id: "sub_1", customer: "cus_1", status: "active", current_period_end: 1_800_000_000 });
  assertEquals(old.current_period_end, new Date(1_800_000_000_000).toISOString());
  const neu = membershipColumns({
    id: "sub_2", customer: "cus_2", status: "past_due", cancel_at_period_end: true,
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_9" } }] },
  });
  assertEquals(neu.current_period_end, new Date(1_800_000_000_000).toISOString());
  assertEquals(neu.price_id, "price_9");
  assertEquals(neu.cancel_at_period_end, true);
});
