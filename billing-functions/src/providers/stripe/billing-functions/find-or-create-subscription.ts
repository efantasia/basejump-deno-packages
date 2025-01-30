import {Stripe} from "../../../../deps.ts";
import {stripeSubscriptionToBasejumpSubscription} from "./stripe-utils.ts";
import {BASEJUMP_BILLING_DATA_UPSERT} from "../../../../lib/upsert-data.ts";

export async function findOrCreateSubscription(
    stripeClient: Stripe.Client,
    {customerId, subscriptionId, accountId, defaultPlanId, defaultTrialDays}
): Promise<BASEJUMP_BILLING_DATA_UPSERT["subscription"]> {
    if (!customerId) {
        throw new Error("customerId is required");
    }

    // if we have the subscription ID, we can just return it
    if (subscriptionId) {
        const subscription = await stripeClient.subscriptions.retrieve(
            subscriptionId, {expand: ["items.data.price.product"]}
        );
        if (subscription) {
            const productName = subscription.items.data[0].price?.product?.name;
            return stripeSubscriptionToBasejumpSubscription(accountId, subscription, productName);
        }
    }

    if (!customerId) {
        throw new Error("customerId is required");
    }

    //If we don't have it, we can search for the metadata
    const customerSubscriptions = await stripeClient.subscriptions.list({
        customer: customerId,
        expand: ["data.plan.product"],
    });

    if (customerSubscriptions.data.length > 0) {
        // check to see if we have any that are for this account
        const subscription = customerSubscriptions.data.find(
            (s) => s.metadata?.basejump_account_id === accountId
        );
        if (subscription) {
            const productName = subscription.plan?.product?.name;
            return stripeSubscriptionToBasejumpSubscription(accountId, subscription, productName);
        }
    }

    // nope, so we need to try and create it
    if (!defaultPlanId) {
        return;
    }

    const price = await stripeClient.prices.retrieve(defaultPlanId);

    // if the price doesn't exist, or price is not free and there is no trial period, return
    // this is because we can't create the subscription without a payment method
    if (!price || (price.unit_amount > 0 && !defaultTrialDays)) {
        return;
    }

    const newSubscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{price: defaultPlanId}],
        expand: ["latest_invoice.payment_intent", "plan.product"],
        trial_period_days: Number(defaultTrialDays),
        metadata: {
            basejump_account_id: accountId,
        },
    });
    const productName = newSubscription.plan?.product?.name;

    return stripeSubscriptionToBasejumpSubscription(accountId, newSubscription, productName);
}
