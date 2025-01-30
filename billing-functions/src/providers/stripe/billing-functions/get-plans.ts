export default async function getPlans(stripeClient) {
  const prices = await stripeClient.prices.list({
    expand: ["data.product", "data.tiers"],
  });

  return prices?.data?.map((price: Stripe.Price) => {
    return {
      active: price.active,
      product_name: price.product.name,
      product_description: price.product.description,
      currency: price.currency,
      price: price?.tiers?.[0]?.unit_amount ?? price.unit_amount,
      unit_label: price.product.unit_label,
      id: price.id,
      product_id: price.product.id,
      interval:
        price.type === "one_time" ? "one_time" : price.recurring?.interval,
      metadata: price.product.metadata,
    };
  });
}
